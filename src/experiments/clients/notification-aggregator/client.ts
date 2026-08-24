import * as fs from "fs";
import * as path from "path";
import { WebSocket } from "ws";
import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { RDFStream, RSPEngine, RSPQLParser } from "rsp-js";
import { loadExperimentConfig } from "../../config/config";
import { buildActivityIndexQuery } from "../../config/query";
import { monitorCurrentProcess } from "../../monitoring/process-monitor";
import { clientRuntime } from "../shared/runtime";

const N3 = require("n3");
const parser = new N3.Parser();
const config = loadExperimentConfig();
const { clientIndex, outputDirectory } = clientRuntime();
const monitor = monitorCurrentProcess(path.join(outputDirectory, `client-${clientIndex}-resource.csv`), config.experiment.resourceSamplingIntervalMs);
const timings = fs.createWriteStream(path.join(outputDirectory, `client-${clientIndex}-timings.csv`), { flags: "w" });
const results = fs.createWriteStream(path.join(outputDirectory, `client-${clientIndex}-results.csv`), { flags: "w" });
timings.write("metric,valueMs\n"); results.write("timestamp,result\n");
const sockets: WebSocket[] = [];

async function run(): Promise<void> {
    const query = buildActivityIndexQuery(config.streams);
    const engine = new RSPEngine(query);
    const emitter = engine.register();
    const streams = new RSPQLParser().parse(query).s2r.map((stream: { stream_name: string }) => stream.stream_name);
    emitter.on("RStream", (event: any) => {
        for (const item of event.bindings.values()) results.write(`${Date.now()},${JSON.stringify(item.value)}\n`);
    });
    for (const name of streams) {
        const ldes = new LDESinLDP(name, new LDPCommunication());
        const metadata = await ldes.readMetadata();
        const bucketStrategy = metadata.getQuads(name + "#BucketizeStrategy", "https://w3id.org/tree#path", null, null)[0].object.value;
        subscribe(engine.getStream(name) as RDFStream, bucketStrategy);
    }
}

function subscribe(stream: RDFStream, bucketStrategy: string): void {
    const socket = new WebSocket(config.urls.notificationAggregator, "solid-stream-notifications-aggregator", { perMessageDeflate: false });
    sockets.push(socket);
    socket.once("open", () => socket.send(JSON.stringify({ subscribe: [stream.name] })));
    socket.on("message", (data) => {
        const started = Date.now();
        try {
            const store = new N3.Store();
            parser.parse(JSON.parse(data.toString()).event, (error: Error | null, quad: any) => { if (error) throw error; if (quad) store.addQuad(quad); });
            const value = store.getQuads(null, bucketStrategy, null, null)[0].object.value;
            const parsedAt = Date.now();
            timings.write(`time_to_preprocess_event,${parsedAt - started}\n`);
            for (const quad of store.getQuads(null, null, null, null)) stream.add(quad, Date.parse(value));
            timings.write(`time_to_add_event_to_rsp_engine,${Date.now() - parsedAt}\n`);
        } catch (error) { console.error(`Notification client ${clientIndex}: ${(error as Error).message}`); }
    });
    socket.on("error", (error) => console.error(`Notification client ${clientIndex}: ${error.message}`));
}

const shutdown = async () => { sockets.forEach((socket) => socket.close()); await monitor.stop(); timings.end(); results.end(); process.exit(0); };
process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);
run().catch((error) => { console.error(error); process.exitCode = 1; });
