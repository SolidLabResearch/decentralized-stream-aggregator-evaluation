import * as fs from "fs";
import * as path from "path";

export type WorkloadMode = "same-query-same-data" | "different-query-same-data" | "different-query-different-data";
export type WorkloadInstance = 0 | 1 | 2;
export interface StreamTriplet { x: string; y: string; z: string; }

export interface ExperimentConfig {
    experiment: { frequencyHz: number; clientCount: number; iterations: number; durationSeconds: number; resourceSamplingIntervalMs: number; clientArrivalMode: "simultaneous" | "staged-reuse"; workloadMode?: WorkloadMode; workloadInstance?: WorkloadInstance; replayerDataVariant?: "A" | "B" | "C" };
    ssh: { user: string; bastion: string | null; identityFile: string | null; connectTimeoutSeconds: number };
    hosts: { replayer: string; solidPod: string; client: string; heimdall: string; notificationAggregator: string };
    remotePaths: { evaluation: string; heimdall: string; notificationAggregator: string; rspJs: string; replayer: string };
    urls: { solidPod: string; heimdall: string; notificationAggregator: string; clientCallbackHost: string };
    streams: StreamTriplet;
    heterogeneousStreams?: StreamTriplet[];
}

export const defaultConfigPath = path.resolve(__dirname, "experiment-config.json");

function positiveInteger(value: unknown, field: string): void {
    if (!Number.isInteger(value) || (value as number) <= 0) {
        throw new Error(`Invalid experiment configuration: ${field} must be a positive integer.`);
    }
}

function requiredString(value: unknown, field: string): void {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Invalid experiment configuration: ${field} must be a non-empty string.`);
    }
}

export function validateExperimentConfig(config: ExperimentConfig): ExperimentConfig {
    if (!config || typeof config !== "object") throw new Error("Invalid experiment configuration: expected an object.");
    if (!config.experiment || !config.ssh || !config.hosts || !config.remotePaths || !config.urls || !config.streams) throw new Error("Invalid experiment configuration: missing a required section.");
    if (config.experiment.frequencyHz !== 4) throw new Error(`Unsupported frequencyHz ${config.experiment.frequencyHz}. Only 4 Hz is supported by this framework.`);
    if (config.experiment.clientArrivalMode === undefined) config.experiment.clientArrivalMode = "simultaneous";
    if (config.experiment.clientArrivalMode !== "simultaneous" && config.experiment.clientArrivalMode !== "staged-reuse") {
        throw new Error(`Invalid experiment configuration: clientArrivalMode must be "simultaneous" or "staged-reuse".`);
    }
    if (config.experiment.workloadMode !== undefined && !["same-query-same-data", "different-query-same-data", "different-query-different-data"].includes(config.experiment.workloadMode)) {
        throw new Error('Invalid experiment configuration: workloadMode must be "same-query-same-data", "different-query-same-data", or "different-query-different-data".');
    }
    if (config.experiment.workloadInstance !== undefined && ![0, 1, 2].includes(config.experiment.workloadInstance)) {
        throw new Error("Invalid experiment configuration: workloadInstance must be 0, 1, or 2.");
    }
    if (config.experiment.replayerDataVariant !== undefined && !["A", "B", "C"].includes(config.experiment.replayerDataVariant)) {
        throw new Error("Invalid experiment configuration: replayerDataVariant must be A, B, or C.");
    }
    if (!Number.isInteger(config.experiment.clientCount) || config.experiment.clientCount < 1 || config.experiment.clientCount > 30) {
        throw new Error("Invalid experiment configuration: clientCount must be an integer from 1 through 30.");
    }
    positiveInteger(config.experiment.iterations, "iterations");
    positiveInteger(config.experiment.durationSeconds, "durationSeconds");
    positiveInteger(config.experiment.resourceSamplingIntervalMs, "resourceSamplingIntervalMs");
    requiredString(config.ssh.user, "ssh.user");
    positiveInteger(config.ssh.connectTimeoutSeconds, "ssh.connectTimeoutSeconds");
    for (const [key, value] of Object.entries({ bastion: config.ssh.bastion, identityFile: config.ssh.identityFile })) {
        if (value !== null && (typeof value !== "string" || value.length === 0)) throw new Error(`Invalid experiment configuration: ssh.${key} must be null or a non-empty string.`);
    }
    Object.entries(config.hosts).forEach(([key, value]) => requiredString(value, `hosts.${key}`));
    Object.entries(config.remotePaths).forEach(([key, value]) => requiredString(value, `remotePaths.${key}`));
    Object.entries(config.urls).forEach(([key, value]) => requiredString(value, `urls.${key}`));
    Object.entries(config.streams).forEach(([key, value]) => requiredString(value, `streams.${key}`));
    if (config.heterogeneousStreams !== undefined) {
        if (!Array.isArray(config.heterogeneousStreams) || config.heterogeneousStreams.length === 0) throw new Error("Invalid experiment configuration: heterogeneousStreams must be a non-empty array of stream triplets.");
        config.heterogeneousStreams.forEach((triplet, index) => {
            if (!triplet || typeof triplet !== "object") throw new Error(`Invalid experiment configuration: heterogeneousStreams.${index} must be a stream triplet.`);
            Object.entries(triplet).forEach(([key, value]) => requiredString(value, `heterogeneousStreams.${index}.${key}`));
            if (!("x" in triplet) || !("y" in triplet) || !("z" in triplet)) throw new Error(`Invalid experiment configuration: heterogeneousStreams.${index} must contain x, y, and z.`);
        });
    }
    return config;
}

export function workloadMode(config: ExperimentConfig): WorkloadMode { return config.experiment.workloadMode || "same-query-same-data"; }
export function workloadInstance(config: ExperimentConfig): WorkloadInstance { return config.experiment.workloadInstance ?? 0; }

export function resolveStreams(config: ExperimentConfig, instance: number = workloadInstance(config)): StreamTriplet {
    if (!Number.isInteger(instance) || instance < 0 || instance > 2) throw new Error("Invalid workload instance; expected 0, 1, or 2.");
    if (workloadMode(config) !== "different-query-different-data") return config.streams;
    if (!config.heterogeneousStreams || config.heterogeneousStreams.length < 3) throw new Error("workloadMode=different-query-different-data requires three heterogeneous stream triplets.");
    return config.heterogeneousStreams[instance];
}

export function workloadVariants(config: ExperimentConfig): { queryVariant: "Q0" | "Q1" | "Q2"; dataVariant: "A" | "B" | "C" } {
    const instance = workloadInstance(config);
    const queryVariant = workloadMode(config) === "same-query-same-data" ? "Q0" : (`Q${instance}` as "Q0" | "Q1" | "Q2");
    const dataVariant = workloadMode(config) === "different-query-different-data" ? (["A", "B", "C"] as const)[instance] : "A";
    return { queryVariant, dataVariant };
}

export function replayerDataVariant(config: ExperimentConfig): "A" | "B" | "C" {
    const expected = workloadVariants(config).dataVariant;
    if (config.experiment.replayerDataVariant !== undefined && config.experiment.replayerDataVariant !== expected) throw new Error(`Invalid experiment configuration: replayerDataVariant ${config.experiment.replayerDataVariant} does not match data variant ${expected}.`);
    return expected;
}

export function loadExperimentConfig(configPath = process.env.EXPERIMENT_CONFIG_PATH || defaultConfigPath): ExperimentConfig {
    const resolvedPath = path.resolve(configPath);
    let parsed: unknown;
    try { parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8")); }
    catch (error) { throw new Error(`Could not load experiment configuration at ${resolvedPath}: ${(error as Error).message}`); }
    const overrides = process.env.EXPERIMENT_CONFIG_OVERRIDES;
    if (overrides) {
        try { parsed = merge(parsed as Record<string, unknown>, JSON.parse(overrides) as Record<string, unknown>); }
        catch (error) { throw new Error(`Could not parse EXPERIMENT_CONFIG_OVERRIDES: ${(error as Error).message}`); }
    }
    return validateExperimentConfig(parsed as ExperimentConfig);
}

function merge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
        merged[key] = value && typeof value === "object" && !Array.isArray(value)
            ? merge((base[key] || {}) as Record<string, unknown>, value as Record<string, unknown>) : value;
    }
    return merged;
}
