import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export const RSP_JS_EVALUATION_SHA = "45112d2955b99796d234747db34bd6804939e69a";
export const HEIMDALL_EVALUATION_SHA = "575f1614aeb0841f6b4874b6e069a76b1db998b2";
export const MAX_OUT_OF_ORDERNESS_MS = 30_000;

export type Operation = "service_discovery" | "stream_discovery" | "query_reuse_check" |
    "service_authentication" | "service_authorization" | "query_registration" |
    "stream_subscription" | "websocket_message" | "event_retrieval" |
    "parsing_timestamp_extraction" | "rsp_insertion" | "window_query_processing" |
    "result_delivery";

export interface Context { runId: string; approach: string; clientId: string; queryId: string; }
export interface Timing extends Partial<Pick<Context, "queryId">> {
    eventId?: string; streamId?: string; operation: Operation; startEpochMs: number;
    endEpochMs: number; startMonotonicNs: bigint; endMonotonicNs: bigint;
}

const timingHeader = "run_id,approach,client_id,query_id,event_id,stream_id,operation,start_epoch_ms,end_epoch_ms,start_monotonic_ns,end_monotonic_ns,duration_ms\n";
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
        this.timings.write([this.context.runId, this.context.approach, this.context.clientId, timing.queryId ?? this.context.queryId, timing.eventId, timing.streamId, timing.operation, timing.startEpochMs, timing.endEpochMs, timing.startMonotonicNs, timing.endMonotonicNs, duration].map(csv).join(",") + "\n");
    }
    public rspMetric(event: string, metric: any): void {
        if (event === "out_of_order_event") {
            this.ooo.write([this.context.runId, this.context.approach, this.context.clientId, this.context.queryId, metric.event_id, metric.stream_id, metric.out_of_order, metric.lateness_ms, metric.within_bound, metric.max_out_of_orderness_ms].map(csv).join(",") + "\n");
        } else if (event === "rsp_insertion" || event === "window_query_processing") {
            const start = BigInt(metric.start_monotonic_ns); const end = BigInt(metric.end_monotonic_ns);
            this.write({ operation: event, eventId: metric.event_id, streamId: metric.stream_id, startEpochMs: this.epochFor(start), endEpochMs: this.epochFor(end), startMonotonicNs: start, endMonotonicNs: end });
        }
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
