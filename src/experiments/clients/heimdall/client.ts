import * as fs from "fs";
import * as path from "path";
import { WebSocket } from "ws";
import { loadExperimentConfig } from "../../config/config";
import { buildActivityIndexQuery } from "../../config/query";
import { monitorCurrentProcess } from "../../monitoring/process-monitor";
import { clientRuntime } from "../shared/runtime";
import { RawInstrumentation, sha256 } from "../shared/instrumentation";

const config = loadExperimentConfig();
const { clientIndex, outputDirectory, runId } = clientRuntime();
const query = buildActivityIndexQuery(config.streams); const queryId = sha256(query);
const raw = new RawInstrumentation(outputDirectory, { runId, approach: "heimdall", clientId: String(clientIndex), queryId });
const monitor = monitorCurrentProcess(path.join(outputDirectory, `client-${clientIndex}-resource.csv`), config.experiment.resourceSamplingIntervalMs);
const results = fs.createWriteStream(path.join(outputDirectory, `client-${clientIndex}-results.csv`), { flags: "w" });
results.write("run_id,client_id,query_id,result_id,client_receive_epoch_ms\n");
const websocket = new WebSocket(config.urls.heimdall, "solid-stream-aggregator-protocol", { perMessageDeflate: false });
websocket.once("open", () => {
    const payload = JSON.stringify({ query, type: "live" }); const start = raw.now(); websocket.send(payload); const end = raw.now(); const messageId = sha256(payload);
    raw.write({ operation: "websocket_message", startEpochMs: start.epochMs, endEpochMs: end.epochMs, startMonotonicNs: start.monotonicNs, endMonotonicNs: end.monotonicNs });
    fs.writeFileSync(path.join(outputDirectory, `client-${clientIndex}-messages.csv`), "run_id,client_id,query_id,message_id,client_send_epoch_ms\n" + [runId, clientIndex, queryId, messageId, start.epochMs].join(",") + "\n");
});
websocket.on("message", (data) => { const payload = Buffer.isBuffer(data) ? data : Buffer.from(data as any); results.write([runId, clientIndex, queryId, sha256(payload), Date.now()].join(",") + "\n"); });
websocket.on("error", (error) => { console.error(`Heimdall client ${clientIndex}: ${error.message}`); void shutdown(1); });
const shutdown = async (exitCode = 0) => { websocket.close(); await monitor.stop(); await raw.close(); results.end(); process.exit(exitCode); };
process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);
