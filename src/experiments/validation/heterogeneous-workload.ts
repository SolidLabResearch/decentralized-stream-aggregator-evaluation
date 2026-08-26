import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { WorkloadMode } from "../config/config";
import { validateMultiClientRepetition } from "./multi-client-repetition";

type Validation = { valid: boolean; errors: string[] };
type Approach = "heimdall" | "notification-aggregator" | "without-aggregator";
type Expected = { queryVariant: "Q0" | "Q1" | "Q2"; dataVariant: "A" | "B" | "C" };
type FormalWorkload = { mode: WorkloadMode; instance: 0 | 1 | 2; id: "A0" | "B0" | "B1" | "B2" | "C0" | "C1" | "C2" };
const approaches: Approach[] = ["heimdall", "notification-aggregator", "without-aggregator"];
const formalWorkloads: FormalWorkload[] = [
    { id: "A0", mode: "same-query-same-data", instance: 0 },
    { id: "B0", mode: "different-query-same-data", instance: 0 }, { id: "B1", mode: "different-query-same-data", instance: 1 }, { id: "B2", mode: "different-query-same-data", instance: 2 },
    { id: "C0", mode: "different-query-different-data", instance: 0 }, { id: "C1", mode: "different-query-different-data", instance: 1 }, { id: "C2", mode: "different-query-different-data", instance: 2 }
];

export function formalWorkloadConfigurations(): readonly FormalWorkload[] { return formalWorkloads; }
export function isFormalWorkload(mode: WorkloadMode, instance: number): boolean { return formalWorkloads.some(value => value.mode === mode && value.instance === instance); }
export function workloadId(mode: WorkloadMode, instance: number): FormalWorkload["id"] {
    const value = formalWorkloads.find(item => item.mode === mode && item.instance === instance);
    if (!value) throw new Error(`Invalid formal workload combination: ${mode}/instance-${instance}.`);
    return value.id;
}
export function expectedWorkload(mode: WorkloadMode, instance: number): Expected {
    if (!isFormalWorkload(mode, instance)) throw new Error(`Invalid formal workload combination: ${mode}/instance-${instance}.`);
    return { queryVariant: mode === "same-query-same-data" ? "Q0" : (`Q${instance}` as Expected["queryVariant"]), dataVariant: mode === "different-query-different-data" ? (["A", "B", "C"] as const)[instance] : "A" };
}
function expectedDescriptor(instance: number): string { return instance === 0 ? "saref:relatesToProperty dahccsensors:wearable.acceleration.x" : instance === 1 ? "saref:measurementMadeBy dahccsensors:E4.A03846.Accelerometer" : "dcterms:isVersionOf saref:Measurement"; }
function expectedQueryLabel(instance: number): string { return instance === 0 ? "Q0_property" : instance === 1 ? "Q1_sensor" : "Q2_measurement_type"; }

function readMetadata(directory: string): any | undefined { try { return JSON.parse(fs.readFileSync(path.join(directory, "metadata.json"), "utf8")); } catch { return undefined; } }
function visitMetadata(root: string): string[] { if (!fs.existsSync(root)) return []; return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => { const candidate = path.join(root, entry.name); return entry.isDirectory() ? visitMetadata(candidate) : entry.name === "metadata.json" ? [path.dirname(candidate)] : []; }); }
function csv(file: string): Array<Record<string, string>> { if (!fs.existsSync(file)) return []; const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean); if (!lines.length) return []; const headers = lines.shift()!.split(","); return lines.map(line => Object.fromEntries(headers.map((header, index) => [header, line.split(",")[index] || ""]))); }

export function validateHeterogeneousWorkload(iterationDirectory: string, approach: string): Validation {
    const base = validateMultiClientRepetition(iterationDirectory, approach, 1); const errors = [...base.errors]; const metadata = readMetadata(iterationDirectory);
    if (!metadata) return { valid: false, errors: [...errors, "invalid metadata.json"] };
    const mode = metadata.workloadMode as WorkloadMode, instance = metadata.workloadInstance;
    if (!isFormalWorkload(mode, instance)) errors.push(`invalid formal workload combination ${mode}/instance-${instance}`);
    if (metadata.clientCount !== 1) errors.push("heterogeneous workload requires exactly 1 client");
    if (metadata.clientArrivalMode !== "simultaneous") errors.push("heterogeneous workload requires simultaneous arrival");
    const workload = metadata.clientWorkloads?.["0"];
    if (!workload || Object.keys(metadata.clientWorkloads || {}).length !== 1) errors.push("metadata must contain exactly one client workload (client 0)");
    if (isFormalWorkload(mode, instance)) {
        const expected = expectedWorkload(mode, instance);
        if (metadata.queryVariant !== expected.queryVariant) errors.push(`expected ${expected.queryVariant}, found ${metadata.queryVariant}`);
        if (metadata.queryVariantLabel !== expectedQueryLabel(instance)) errors.push(`expected ${expectedQueryLabel(instance)}, found ${metadata.queryVariantLabel}`);
        if (metadata.dataVariant !== expected.dataVariant) errors.push(`expected data ${expected.dataVariant}, found ${metadata.dataVariant}`);
        if (metadata.replayerDataVariant !== expected.dataVariant) errors.push(`expected replayer data ${expected.dataVariant}, found ${metadata.replayerDataVariant}`);
        if (workload && JSON.stringify(workload.streams) !== JSON.stringify(metadata.streamTriplet)) errors.push("metadata stream triplet does not match client workload");
        const expectedSegment = `segment-0${expected.dataVariant === "A" ? 1 : expected.dataVariant === "B" ? 2 : 3}`;
        if (!metadata.streamTriplet || Object.values(metadata.streamTriplet).some(value => typeof value !== "string" || !value.includes(`/heterogeneous/${expectedSegment}/`))) errors.push(`stream triplet does not target ${expectedSegment}`);
        if (typeof metadata.queryText !== "string" || typeof metadata.queryHash !== "string" || crypto.createHash("sha256").update(metadata.queryText).digest("hex") !== metadata.queryHash) errors.push("metadata query text/hash mismatch");
        if (typeof metadata.queryText === "string" && (!metadata.queryText.includes(expectedDescriptor(instance)) || metadata.queryText.includes("?queryVariant") || metadata.queryText.includes("BIND(\"variant-"))) errors.push("query text does not match the expected descriptor-pattern query variant");
        if (workload && workload.queryHash !== metadata.queryHash) errors.push("client workload query hash does not match metadata query hash");
    }
    if (!fs.existsSync(path.join(iterationDirectory, "network.csv"))) errors.push("missing network.csv");
    return { valid: errors.length === 0, errors };
}

export function validateHeterogeneousCampaign(root: string): Validation {
    const errors: string[] = []; const attempts = csv(path.join(root, "campaign-logs", "attempts.csv"));
    if (!attempts.length) return { valid: false, errors: ["missing or empty campaign-logs/attempts.csv"] };
    const metadataByRun = new Map<string, any>(); for (const directory of visitMetadata(root)) { const metadata = readMetadata(directory); if (metadata?.run_id) metadataByRun.set(metadata.run_id, metadata); }
    for (const approach of approaches) for (const workload of formalWorkloads) {
        const matching = attempts.filter(row => row.approach === approach && row.workload === workload.mode && Number(row.workload_instance) === workload.instance);
        const label = `${approach}/${workload.id}`;
        if (matching.length !== 35) errors.push(`${label} has ${matching.length} attempts; expected 35`);
        const repetitions = matching.map(row => Number(row.repetition));
        if (new Set(repetitions).size !== repetitions.length) errors.push(`${label} has duplicate repetition IDs`);
        for (let repetition = 1; repetition <= 35; repetition += 1) if (repetitions.filter(value => value === repetition).length !== 1) errors.push(`${label} does not contain exactly one r${String(repetition).padStart(2, "0")}`);
        const retained = matching.filter(row => Number(row.repetition) >= 4 && Number(row.repetition) <= 33);
        if (retained.length !== 30) errors.push(`${label} has ${retained.length} retained attempts; expected 30 (r04-r33)`);
        const validRetained = retained.filter(row => row.status === "valid");
        if (validRetained.length !== 30) errors.push(`${label} has ${validRetained.length} valid retained observations; expected 30; invalid attempts are not replaced`);
        for (const attempt of matching.filter(row => row.status === "valid")) {
            const metadata = metadataByRun.get(attempt.run_id);
            if (!metadata) { errors.push(`${label}/${attempt.run_id} is marked valid but has no metadata`); continue; }
            const expected = expectedWorkload(workload.mode, workload.instance);
            if (metadata.approach !== approach || metadata.clientCount !== 1 || metadata.workloadMode !== workload.mode || metadata.workloadInstance !== workload.instance || metadata.queryVariant !== expected.queryVariant || metadata.queryVariantLabel !== expectedQueryLabel(workload.instance) || metadata.dataVariant !== expected.dataVariant || metadata.replayerDataVariant !== expected.dataVariant) errors.push(`${label}/${attempt.run_id} metadata does not match its formal workload`);
        }
    }
    return { valid: errors.length === 0, errors };
}

if (require.main === module) {
    const [directory, approach] = process.argv.slice(2);
    if (!directory) { console.error("Usage: ts-node heterogeneous-workload.ts ITERATION APPROACH | --campaign RESULTS_ROOT"); process.exit(2); }
    const result = directory === "--campaign" ? validateHeterogeneousCampaign(approach || "") : approach ? validateHeterogeneousWorkload(directory, approach) : undefined;
    if (!result) { console.error("Usage: ts-node heterogeneous-workload.ts ITERATION APPROACH | --campaign RESULTS_ROOT"); process.exit(2); }
    console.log(JSON.stringify(result, null, 2)); process.exit(result.valid ? 0 : 1);
}
