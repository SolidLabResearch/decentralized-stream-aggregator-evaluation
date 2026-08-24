import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import axios from "axios";
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
let server: http.Server | undefined;

async function run(): Promise<void> {
    const query = buildActivityIndexQuery(config.streams);
    const engine = new RSPEngine(query);
    const emitter = engine.register();
    emitter.on("RStream", (event: any) => {
        for (const item of event.bindings.values()) results.write(`${Date.now()},${JSON.stringify(item.value)}\n`);
    });
    server = http.createServer((request, response) => handleNotification(request, response, engine));
    const port = await listen(server);
    const streams = new RSPQLParser().parse(query).s2r.map((stream: { stream_name: string }) => stream.stream_name);
    for (const streamName of streams) await subscribe(streamName, port);
}

async function handleNotification(request: http.IncomingMessage, response: http.ServerResponse, engine: RSPEngine): Promise<void> {
    if (request.method !== "POST") { response.writeHead(405); response.end(); return; }
    let body = "";
    request.on("data", (chunk) => { body += chunk.toString(); });
    request.on("end", async () => {
        try {
            const notification = JSON.parse(body) as { object: string; target: string };
            const lastSlash = notification.target.lastIndexOf("/");
            const ldesLocation = notification.target.substring(0, notification.target.lastIndexOf("/", lastSlash - 1) + 1);
            const fetchStart = Date.now();
            const event = await axios.get(notification.object);
            timings.write(`time_to_fetch_notification,${Date.now() - fetchStart}\n`);
            const ldes = new LDESinLDP(ldesLocation, new LDPCommunication());
            const metadata = await ldes.readMetadata();
            const bucketStrategy = metadata.getQuads(ldesLocation + "#BucketizeStrategy", "https://w3id.org/tree#path", null, null)[0].object.value;
            const preprocessingStart = Date.now();
            const store = new N3.Store();
            parser.parse(event.data, (error: Error | null, quad: any) => { if (error) throw error; if (quad) store.addQuad(quad); });
            const timestamp = Date.parse(store.getQuads(null, bucketStrategy, null, null)[0].object.value);
            const stream = engine.getStream(ldesLocation) as RDFStream;
            const parsedAt = Date.now();
            timings.write(`time_to_preprocess_event,${parsedAt - preprocessingStart}\n`);
            for (const quad of store.getQuads(null, null, null, null)) stream.add(quad, timestamp);
            timings.write(`time_to_add_event_to_rsp_engine,${Date.now() - parsedAt}\n`);
            response.writeHead(200); response.end("200 - OK");
        } catch (error) { console.error(`Without-aggregator client ${clientIndex}: ${(error as Error).message}`); response.writeHead(400); response.end("400 - Bad Request"); }
    });
}

function listen(httpServer: http.Server): Promise<number> {
    return new Promise((resolve, reject) => { httpServer.once("error", reject); httpServer.listen(0, () => resolve((httpServer.address() as { port: number }).port)); });
}

async function subscribe(streamName: string, port: number): Promise<void> {
    const metadata = await axios.get(streamName);
    const store = new N3.Store();
    parser.parse(metadata.data, (error: Error | null, quad: any) => { if (error) throw error; if (quad) store.addQuad(quad); });
    const inbox = streamName + store.getQuads(null, "http://www.w3.org/ns/ldp#inbox", null)[0].object.value;
    const head = await axios.head(inbox);
    const link = (head.headers.link as string | undefined)?.split(",").map((part) => part.trim()).find((part) => part.includes('rel="http://www.w3.org/ns/solid/terms#storageDescription"'));
    if (!link) throw new Error(`No Solid storage description advertised by ${inbox}.`);
    const storageDescription = link.split(";")[0].trim().slice(1, -1);
    const description = await axios.get(storageDescription);
    const descriptionStore = new N3.Store();
    parser.parse(description.data, (error: Error | null, quad: any) => { if (error) throw error; if (quad) descriptionStore.addQuad(quad); });
    const subscriptionServer = descriptionStore.getQuads(null, "http://www.w3.org/ns/solid/notifications#subscription", null)[0].object.value;
    await axios.post(subscriptionServer, {
        "@context": ["https://www.w3.org/ns/solid/notification/v1"], type: "http://www.w3.org/ns/solid/notifications#WebhookChannel2023",
        topic: inbox, sendTo: `${config.urls.clientCallbackHost}:${port}/`
    }, { headers: { "Content-Type": "application/ld+json" } });
}

const shutdown = async () => { if (server) await new Promise<void>((resolve) => server!.close(() => resolve())); await monitor.stop(); timings.end(); results.end(); process.exit(0); };
process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);
run().catch((error) => { console.error(error); process.exitCode = 1; });
