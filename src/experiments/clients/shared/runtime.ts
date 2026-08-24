import { ChildProcess, fork } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { loadExperimentConfig } from "../../config/config";

export type Approach = "heimdall" | "notification-aggregator" | "without-aggregator";

export function clientRuntime(): { clientIndex: number; outputDirectory: string } {
    const clientIndex = Number(process.env.EXPERIMENT_CLIENT_INDEX);
    const outputDirectory = process.env.EXPERIMENT_OUTPUT_DIRECTORY;
    if (!Number.isInteger(clientIndex) || !outputDirectory) throw new Error("Client must be started by an experiment launcher.");
    return { clientIndex, outputDirectory };
}

function optionValue(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

export function launchConfiguredClients(approach: Approach, clientModule: string): ChildProcess[] {
    const config = loadExperimentConfig();
    const requestedOutput = optionValue("--output-dir");
    const iteration = optionValue("--iteration") || "01";
    const outputDirectory = path.resolve(requestedOutput || path.join("results", "4hz", approach, `clients-${config.experiment.clientCount}`, `iteration-${iteration}-${Date.now()}`));
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, "metadata.json"), JSON.stringify({
        approach, frequencyHz: config.experiment.frequencyHz, clientCount: config.experiment.clientCount,
        iteration, durationSeconds: config.experiment.durationSeconds,
        resourceSamplingIntervalMs: config.experiment.resourceSamplingIntervalMs, timestamp: new Date().toISOString(),
        hosts: config.hosts, streams: config.streams, serviceUrls: config.urls, nodeVersion: process.version
    }, null, 2) + "\n");
    const children: ChildProcess[] = [];
    for (let clientIndex = 0; clientIndex < config.experiment.clientCount; clientIndex++) {
        const child = fork(clientModule, [], { env: { ...process.env, EXPERIMENT_CLIENT_INDEX: String(clientIndex), EXPERIMENT_OUTPUT_DIRECTORY: outputDirectory } });
        child.on("exit", (code, signal) => console.log(`${approach} client ${clientIndex} exited (${code ?? signal ?? "unknown"}).`));
        children.push(child);
    }
    const stop = () => children.forEach((child) => { if (!child.killed) child.kill("SIGTERM"); });
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    console.log(`Launched ${children.length} ${approach} child clients in ${outputDirectory}.`);
    return children;
}
