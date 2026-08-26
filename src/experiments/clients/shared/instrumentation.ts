import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export const RSP_JS_EVALUATION_SHA = "45112d2955b99796d234747db34bd6804939e69a";
export const HEIMDALL_EVALUATION_SHA = "aa4a674ca03c7eb5a0e0e626ea5a8b3d190a9fef";
export const MAX_OUT_OF_ORDERNESS_MS = 30_000;

export type Operation = "service_discovery" | "stream_discovery" | "query_reuse_check" |
    "service_authentication" | "service_authorization" | "query_registration" |
    "stream_subscription" | "websocket_message" | "event_retrieval" |
    "parsing_timestamp_extraction" | "rsp_insertion" | "r2r_first_result" | "window_query_processing" |
    "result_delivery" | "registration_to_first_result" | "cold_registration_to_first_result" |
    "reuse_registration_to_first_result" | "join_registration_to_first_result";
export type ClientRole = "cold" | "reuse" | "join";

export interface Context { runId: string; approach: string; clientId: string; queryId: string; }
export interface Timing extends Partial<Pick<Context, "queryId">> {
    eventId?: string; streamId?: string; operation: Operation; startEpochMs: number;
    endEpochMs: number; startMonotonicNs: bigint; endMonotonicNs: bigint;
    windowId?: string; windowFromMs?: number; windowToMs?: number; windowSize?: number;
    clientRole?: ClientRole;
}

const timingHeader = "run_id,approach,client_id,query_id,event_id,stream_id,window_id,window_from_ms,window_to_ms,window_size,operation,start_epoch_ms,end_epoch_ms,start_monotonic_ns,end_monotonic_ns,duration_ms,client_role\n";
const oooHeader = "run_id,approach,client_id,query_id,event_id,stream_id,out_of_order,lateness_ms,within_bound,max_out_of_orderness_ms\n";

function csv(value: string | number | boolean | bigint | undefined): string {
    const text = value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Appends raw, unaggregated client observations. Epoch conversion is anchored once to hrtime. */
export class RawInstrumentation {
    private readonly timings: fs.WriteStream;
    private readonly ooo: fs.WriteStream;
    private readonly epochAnchorMs = Date.now();
    private readonly monotonicAnchorNs = process.hrtime.bigint();
    private readyAt?: { epochMs: number; monotonicNs: bigint; boundary: string };
    private registrationIssuedAt?: { epochMs: number; monotonicNs: bigint; clientRole?: ClientRole };
    private firstResultObserved = false;
    private firstResultObservation?: { epochMs: number; monotonicNs: bigint; clientRole?: ClientRole; latencyOperation: Operation };

    public constructor(private readonly outputDirectory: string, public readonly context: Context) {
        this.timings = fs.createWriteStream(path.join(outputDirectory, `client-${context.clientId}-operations.csv`), { flags: "w" });
        this.ooo = fs.createWriteStream(path.join(outputDirectory, `client-${context.clientId}-out-of-order.csv`), { flags: "w" });
        this.timings.write(timingHeader); this.ooo.write(oooHeader);
    }

    public now(): { epochMs: number; monotonicNs: bigint } { return { epochMs: Date.now(), monotonicNs: process.hrtime.bigint() }; }
    public epochFor(monotonicNs: bigint): number { return this.epochAnchorMs + Number(monotonicNs - this.monotonicAnchorNs) / 1_000_000; }
    public measure<T>(operation: Operation, details: Pick<Timing, "eventId" | "streamId">, fn: () => Promise<T>): Promise<T> {
        const start = this.now();
        return fn().then((value) => { this.write({ ...details, operation, startEpochMs: start.epochMs, endEpochMs: Date.now(), startMonotonicNs: start.monotonicNs, endMonotonicNs: process.hrtime.bigint() }); return value; });
    }
    public write(timing: Timing): void {
        const duration = Number(timing.endMonotonicNs - timing.startMonotonicNs) / 1_000_000;
        this.timings.write([this.context.runId, this.context.approach, this.context.clientId, timing.queryId ?? this.context.queryId, timing.eventId, timing.streamId, timing.windowId, timing.windowFromMs, timing.windowToMs, timing.windowSize, timing.operation, timing.startEpochMs, timing.endEpochMs, timing.startMonotonicNs, timing.endMonotonicNs, duration, timing.clientRole].map(csv).join(",") + "\n");
    }
    public rspMetric(event: string, metric: any): void {
        if (event === "out_of_order_event") {
            this.ooo.write([this.context.runId, this.context.approach, this.context.clientId, this.context.queryId, metric.event_id, metric.stream_id, metric.out_of_order, metric.lateness_ms, metric.within_bound, metric.max_out_of_orderness_ms].map(csv).join(",") + "\n");
        } else if (event === "rsp_insertion" || event === "r2r_first_result" || event === "window_query_processing") {
            const start = BigInt(metric.start_monotonic_ns); const end = BigInt(metric.end_monotonic_ns);
            this.write({ operation: event, eventId: metric.event_id, streamId: metric.stream_id, windowId: metric.window_id, windowFromMs: metric.window_from_ms, windowToMs: metric.window_to_ms, windowSize: metric.window_size, startEpochMs: this.epochFor(start), endEpochMs: this.epochFor(end), startMonotonicNs: start, endMonotonicNs: end });
        }
    }
    public markReady(boundary: string): void {
        if (this.readyAt) throw new Error(`Client ${this.context.clientId} readiness was recorded twice.`);
        this.readyAt = { ...this.now(), boundary };
        const marker = path.join(this.outputDirectory, `client-${this.context.clientId}-ready.json`);
        fs.writeFileSync(`${marker}.tmp`, JSON.stringify({ ...this.context, boundary, ready_epoch_ms: this.readyAt.epochMs, ready_monotonic_ns: this.readyAt.monotonicNs.toString() }) + "\n");
        fs.renameSync(`${marker}.tmp`, marker);
    }
    public markRegistrationIssued(clientRole?: ClientRole): { epochMs: number; monotonicNs: bigint } {
        if (this.registrationIssuedAt) throw new Error(`Client ${this.context.clientId} registration was recorded twice.`);
        const now = this.now();
        this.registrationIssuedAt = { ...now, clientRole };
        const marker = path.join(this.outputDirectory, `client-${this.context.clientId}-registration.json`);
        fs.writeFileSync(`${marker}.tmp`, JSON.stringify({ ...this.context, client_role: clientRole, registration_epoch_ms: now.epochMs, registration_monotonic_ns: now.monotonicNs.toString() }) + "\n");
        fs.renameSync(`${marker}.tmp`, marker);
        return now;
    }
    public observeFirstResult(result: { resultId?: string; windowId?: string; payloadHash?: string } = {}): { epochMs: number; monotonicNs: bigint; clientRole?: ClientRole; latencyOperation: Operation } {
        if (this.firstResultObserved) return this.firstResultObservation!;
        if (!this.readyAt && !this.registrationIssuedAt) throw new Error(`Client ${this.context.clientId} received a result before registration.`);
        const end = this.now();
        const staged = this.registrationIssuedAt?.clientRole !== undefined;
        const start = staged ? this.registrationIssuedAt! : this.readyAt!;
        if (end.monotonicNs < start.monotonicNs) throw new Error(`Client ${this.context.clientId} first result preceded registration.`);
        const clientRole = this.registrationIssuedAt?.clientRole;
        const latencyOperation: Operation = clientRole === "cold" ? "cold_registration_to_first_result" : clientRole === "reuse" ? "reuse_registration_to_first_result" : clientRole === "join" ? "join_registration_to_first_result" : "registration_to_first_result";
        this.write({ operation: latencyOperation, clientRole, windowId: result.windowId, eventId: result.resultId, startEpochMs: start.epochMs, endEpochMs: end.epochMs, startMonotonicNs: start.monotonicNs, endMonotonicNs: end.monotonicNs });
        const marker = path.join(this.outputDirectory, `client-${this.context.clientId}-first-result.ready`);
        fs.writeFileSync(`${marker}.tmp`, `${this.context.runId},${this.context.clientId},${end.epochMs},${end.monotonicNs}\n`);
        fs.renameSync(`${marker}.tmp`, marker);
        const detailMarker = path.join(this.outputDirectory, `client-${this.context.clientId}-first-result.json`);
        fs.writeFileSync(`${detailMarker}.tmp`, JSON.stringify({ ...this.context, client_role: clientRole, latency_operation: latencyOperation, result_id: result.resultId, payload_hash: result.payloadHash, window_id: result.windowId, result_epoch_ms: end.epochMs, result_monotonic_ns: end.monotonicNs.toString(), registration_epoch_ms: start.epochMs, registration_monotonic_ns: start.monotonicNs.toString() }) + "\n");
        fs.renameSync(`${detailMarker}.tmp`, detailMarker);
        this.firstResultObserved = true;
        this.firstResultObservation = { ...end, clientRole, latencyOperation };
        return this.firstResultObservation;
    }
    public async close(): Promise<void> {
        await Promise.all([new Promise<void>(resolve => this.timings.end(resolve)), new Promise<void>(resolve => this.ooo.end(resolve))]);
        const metadataPath = path.join(this.outputDirectory, "metadata.json");
        if (fs.existsSync(metadataPath)) {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
            metadata.endTimestamp = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n");
        }
    }
}

export function sha256(value: string | Buffer): string { return crypto.createHash("sha256").update(value as crypto.BinaryLike).digest("hex"); }
