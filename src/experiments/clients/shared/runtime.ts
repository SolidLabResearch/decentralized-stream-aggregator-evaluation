import { ChildProcess, fork } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { loadExperimentConfig } from "../../config/config";
import { sha256 } from "./instrumentation";
import { monitorHostResources } from "../../monitoring/host-monitor";

export type Approach = "heimdall" | "notification-aggregator" | "without-aggregator";

export function clientRuntime(): { clientIndex: number; outputDirectory: string; runId: string } {
    const clientIndex = Number(process.env.EXPERIMENT_CLIENT_INDEX);
    const outputDirectory = process.env.EXPERIMENT_OUTPUT_DIRECTORY;
    if (!Number.isInteger(clientIndex) || !outputDirectory) throw new Error("Client must be started by an experiment launcher.");
    const runId = process.env.EXPERIMENT_RUN_ID;
    if (!runId) throw new Error("EXPERIMENT_RUN_ID is required for raw observations.");
    return { clientIndex, outputDirectory, runId };
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
    const query = require("../../config/query").buildActivityIndexQuery(config.streams);
    fs.writeFileSync(path.join(outputDirectory, "metadata.json"), JSON.stringify({
        run_id: process.env.EXPERIMENT_RUN_ID || path.basename(outputDirectory),
        approach, frequencyHz: config.experiment.frequencyHz, clientCount: config.experiment.clientCount,
        iteration, durationSeconds: config.experiment.durationSeconds,
        resourceSamplingIntervalMs: config.experiment.resourceSamplingIntervalMs, startTimestamp: new Date().toISOString(),
        hosts: config.hosts, streams: config.streams, serviceUrls: config.urls, nodeVersion: process.version,
        queryText: query, queryHash: sha256(query), evaluationRepositorySha: process.env.EVALUATION_REPOSITORY_SHA || "unknown",
        rspJsSha: process.env.RSP_JS_REPOSITORY_SHA || "45112d2955b99796d234747db34bd6804939e69a", serviceSha: process.env.SERVICE_REPOSITORY_SHA || undefined,
        max_out_of_orderness_ms: 30000, clockSynchronization: { status: "unverified", crossMachineMetrics: "unavailable until pre-run clock evidence is collected" }
    }, null, 2) + "\n");
    const hostMonitor = monitorHostResources(path.join(outputDirectory, "client-host-resource.csv"), config.experiment.resourceSamplingIntervalMs);
    const children: ChildProcess[] = [];
    for (let clientIndex = 0; clientIndex < config.experiment.clientCount; clientIndex++) {
        const child = fork(clientModule, [], { env: { ...process.env, EXPERIMENT_CLIENT_INDEX: String(clientIndex), EXPERIMENT_OUTPUT_DIRECTORY: outputDirectory, EXPERIMENT_RUN_ID: process.env.EXPERIMENT_RUN_ID || path.basename(outputDirectory) } });
        child.on("exit", (code, signal) => console.log(`${approach} client ${clientIndex} exited (${code ?? signal ?? "unknown"}).`));
        children.push(child);
    }
    let exited = 0;
    children.forEach((child) => child.once("exit", () => { exited += 1; if (exited === children.length) void hostMonitor.stop(); }));
    const stop = () => children.forEach((child) => { if (!child.killed) child.kill("SIGTERM"); });
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    console.log(`Launched ${children.length} ${approach} child clients in ${outputDirectory}.`);
    return children;
}
