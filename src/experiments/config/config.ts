import * as fs from "fs";
import * as path from "path";

export interface ExperimentConfig {
    experiment: { frequencyHz: number; clientCount: number; iterations: number; durationSeconds: number; resourceSamplingIntervalMs: number };
    ssh: { user: string; bastion: string | null; identityFile: string | null; connectTimeoutSeconds: number };
    hosts: { replayer: string; solidPod: string; client: string; heimdall: string; notificationAggregator: string };
    remotePaths: { evaluation: string; heimdall: string; notificationAggregator: string; rspJs: string; replayer: string };
    urls: { solidPod: string; heimdall: string; notificationAggregator: string; clientCallbackHost: string };
    streams: { x: string; y: string; z: string };
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
    return config;
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
