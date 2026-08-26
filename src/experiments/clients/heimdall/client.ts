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
results.write("run_id,client_id,query_id,result_id,client_receive_epoch_ms,payload_hash,result_monotonic_ns,window_id,client_role,latency_operation\n");
const clientId = String(clientIndex);
const stagedReuse = config.experiment.clientArrivalMode === "staged-reuse";
const clientRole = clientIndex === 0 ? "cold" as const : "reuse" as const;
const websocket = new WebSocket(config.urls.heimdall, "solid-stream-aggregator-protocol", { perMessageDeflate: false });
websocket.once("open", () => {
    const payload = JSON.stringify({ query, type: "live", client_id: clientId }); const registration = stagedReuse ? raw.markRegistrationIssued(clientRole) : undefined; const start = registration || raw.now(); websocket.send(payload); const end = raw.now(); const messageId = sha256(payload);
    raw.write({ operation: "websocket_message", startEpochMs: start.epochMs, endEpochMs: end.epochMs, startMonotonicNs: start.monotonicNs, endMonotonicNs: end.monotonicNs });
    fs.writeFileSync(path.join(outputDirectory, `client-${clientIndex}-messages.csv`), "run_id,client_id,query_id,message_id,client_send_epoch_ms\n" + [runId, clientIndex, queryId, messageId, start.epochMs].join(",") + "\n");
});
websocket.on("message", (data) => {
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
    const payloadHash = sha256(payload);
    const windowId = resultWindowId(payload);
    try {
        const message = JSON.parse(payload.toString()) as { type?: string; query_id?: string; client_id?: string };
        if (message.type === "query_ready") {
            if (message.query_id !== queryId || message.client_id !== clientId) throw new Error("Unexpected Heimdall query_ready acknowledgement.");
            raw.markReady("Heimdall query_ready ACK received after shared query pipeline and all upstream subscriptions are established");
            return;
        }
        if (stagedReuse && isControlMessage(message)) return;
    } catch { /* Result payloads are not required to be JSON acknowledgements. */ }
    if (stagedReuse && !isGenuineResult(payload)) return;
    if (stagedReuse && !replayStarted()) return;
    let first: ReturnType<RawInstrumentation["observeFirstResult"]>;
    try { first = raw.observeFirstResult({ resultId: payloadHash, payloadHash, windowId }); } catch (error) { console.error(`Heimdall client ${clientIndex}: ${(error as Error).message}`); void shutdown(1); return; }
    const received = raw.now();
    results.write([runId, clientIndex, queryId, payloadHash, received.epochMs, payloadHash, received.monotonicNs, windowId, stagedReuse ? clientRole : "", first.latencyOperation].join(",") + "\n");
});
websocket.on("error", (error) => { console.error(`Heimdall client ${clientIndex}: ${error.message}`); void shutdown(1); });
let shuttingDown = false;
const shutdown = async (exitCode = 0) => { if (shuttingDown) return; shuttingDown = true; websocket.close(); await monitor.stop(); await raw.close(); await new Promise<void>((resolve) => results.end(resolve)); process.exit(exitCode); };
process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);

function isControlMessage(message: { type?: string; status?: string }): boolean {
    return Boolean(message.type || message.status);
}

function isGenuineResult(payload: Buffer): boolean {
    if (!payload.toString().trim()) return false;
    try {
        const parsed = JSON.parse(payload.toString()) as any;
        if (typeof parsed === "string") return parsed.trim().length > 0;
        return parsed && typeof parsed === "object" && !isControlMessage(parsed);
    } catch {
        return true;
    }
}

function resultWindowId(payload: Buffer): string | undefined {
    try {
        const parsed = JSON.parse(payload.toString()) as any;
        return parsed?.window_id || parsed?.windowId || parsed?.event_id || parsed?.eventId;
    } catch {
        return undefined;
    }
}

function replayStarted(): boolean {
    return fs.existsSync(path.join(outputDirectory, "staged-replay-start.json"));
}
