import * as fs from "fs";
import * as path from "path";
import { WebSocket } from "ws";
import { LDESinLDP, LDPCommunication } from "@treecg/versionawareldesinldp";
import { RDFStream, RSPEngine, RSPQLParser } from "rsp-js";
import { loadExperimentConfig } from "../../config/config";
import { buildActivityIndexQuery } from "../../config/query";
import { monitorCurrentProcess } from "../../monitoring/process-monitor";
import { clientRuntime } from "../shared/runtime";
import { ClientRole, MAX_OUT_OF_ORDERNESS_MS, RawInstrumentation, sha256 } from "../shared/instrumentation";

const N3 = require("n3");
const parser = new N3.Parser();
const config = loadExperimentConfig();
const { clientIndex, outputDirectory, runId } = clientRuntime();
const query = buildActivityIndexQuery(config.streams);
const queryId = sha256(query);
const stagedArrival = config.experiment.clientArrivalMode === "staged-reuse";
const clientRole: ClientRole | undefined = stagedArrival ? (clientIndex === 0 ? "cold" : "join") : undefined;
const raw = new RawInstrumentation(outputDirectory, { runId, approach: "notification-aggregator", clientId: String(clientIndex), queryId });
const monitor = monitorCurrentProcess(path.join(outputDirectory, `client-${clientIndex}-resource.csv`), config.experiment.resourceSamplingIntervalMs);
const results = fs.createWriteStream(path.join(outputDirectory, `client-${clientIndex}-results.csv`), { flags: "w" });
results.write("run_id,client_id,query_id,result_id,client_receive_epoch_ms,payload_hash,result_monotonic_ns,window_id,client_role,latency_operation\n");
let resultId = 0;
const sockets: WebSocket[] = [];

async function run(): Promise<void> {
    const engine = new RSPEngine(query, {
        max_delay: MAX_OUT_OF_ORDERNESS_MS,
        metrics: { run_id: runId, approach: "notification-aggregator", client_id: String(clientIndex), query_id: queryId },
        onMetric: (event, metric) => raw.rspMetric(event, metric),
    });
    const emitter = engine.register();
    emitter.on("RStream", (event: any) => {
        for (const item of event.bindings.values()) {
            if (stagedArrival && !replayStarted()) continue;
            const payload = JSON.stringify(item.value);
            const payloadHash = sha256(payload);
            const resultIdentifier = String(resultId++);
            let first: ReturnType<RawInstrumentation["observeFirstResult"]>;
            try {
                first = raw.observeFirstResult({ resultId: resultIdentifier, payloadHash, windowId: item.window_id || item.windowId });
            } catch (error) {
                console.error(`Notification client ${clientIndex}: ${(error as Error).message}`);
                void shutdown(1);
                return;
            }
            const received = raw.now();
            results.write([runId, clientIndex, queryId, resultIdentifier, received.epochMs, payloadHash, received.monotonicNs, item.window_id || item.windowId, clientRole || "", first.latencyOperation].join(",") + "\n");
        }
    });
    const streams = new RSPQLParser().parse(query).s2r.map((stream: { stream_name: string }) => stream.stream_name);
    const subscriptions: Promise<void>[] = [];
    let registrationMarked = !stagedArrival;
    for (const name of streams) {
        const ldes = new LDESinLDP(name, new LDPCommunication());
        const metadata = await raw.measure("stream_discovery", { streamId: name }, () => ldes.readMetadata());
        const bucketStrategy = metadata.getQuads(name + "#BucketizeStrategy", "https://w3id.org/tree#path", null, null)[0].object.value;
        if (!registrationMarked) { raw.markRegistrationIssued(clientRole); registrationMarked = true; }
        subscriptions.push(subscribe(engine.getStream(name) as RDFStream, bucketStrategy));
    }
    await Promise.all(subscriptions);
    raw.markReady("All three aggregator subscription acknowledgements received");
}

function subscribe(stream: RDFStream, bucketStrategy: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(config.urls.notificationAggregator, "solid-stream-notifications-aggregator", { perMessageDeflate: false });
        sockets.push(socket);
        socket.once("open", () => {
            const start = raw.now();
            socket.send(JSON.stringify({ subscribe: [stream.name] }), (error) => {
                const end = raw.now();
                raw.write({ operation: "stream_subscription", streamId: stream.name, startEpochMs: start.epochMs, endEpochMs: end.epochMs, startMonotonicNs: start.monotonicNs, endMonotonicNs: end.monotonicNs });
                if (error) reject(error);
            });
        });
        socket.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === "subscription_ready") {
                    if (message.stream !== stream.name) { reject(new Error(`Unexpected subscription_ready stream ${message.stream}`)); return; }
                    resolve();
                    return;
                }
                if (typeof message.event !== "string") throw new Error("Unexpected notification-aggregator message before an event payload.");
                const eventId = message.object || message.id || message.eventUrl;
                const start = raw.now();
                const store = new N3.Store();
                parser.parse(message.event, (error: Error | null, quad: any) => { if (error) throw error; if (quad) store.addQuad(quad); });
                const value = store.getQuads(null, bucketStrategy, null, null)[0].object.value;
                const end = raw.now();
                raw.write({ operation: "parsing_timestamp_extraction", eventId, streamId: stream.name, startEpochMs: start.epochMs, endEpochMs: end.epochMs, startMonotonicNs: start.monotonicNs, endMonotonicNs: end.monotonicNs });
                for (const quad of store.getQuads(null, null, null, null)) stream.add(quad, Date.parse(value), eventId);
            } catch (error) {
                console.error(`Notification client ${clientIndex}: ${(error as Error).message}`);
            }
        });
        socket.on("error", reject);
    });
}

let shuttingDown = false;
const shutdown = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    sockets.forEach((socket) => socket.close());
    await monitor.stop();
    await raw.close();
    await new Promise<void>((resolve) => results.end(resolve));
    process.exit(exitCode);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
run().catch((error) => { console.error(error); void shutdown(1); });

function replayStarted(): boolean {
    return fs.existsSync(path.join(outputDirectory, "staged-replay-start.json"));
}
