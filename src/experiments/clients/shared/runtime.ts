import { ChildProcess, fork } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { loadExperimentConfig, queryVariantLabel, replayerDataVariant, resolveStreams, workloadInstance, workloadMode, workloadVariants } from "../../config/config";
import { buildSaturationQueries } from "../../config/saturation";
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

export function resolveClientIndices(clientCount: number, args = process.argv): number[] {
    const value = (name: string): string | undefined => {
        const index = args.indexOf(name);
        return index === -1 ? undefined : args[index + 1];
    };
    const idsText = value("--client-ids");
    const startText = value("--client-start");
    const countText = value("--client-count");
    let ids: number[];
    if (idsText !== undefined) {
        ids = idsText.split(",").map((item) => Number(item.trim()));
        if (!ids.length || ids.some((item) => !Number.isInteger(item))) throw new Error("--client-ids must be a non-empty comma-separated list of integers.");
    } else if (startText !== undefined || countText !== undefined) {
        const start = Number(startText ?? 0); const count = Number(countText);
        if (!Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count < 1) throw new Error("--client-start must be non-negative and --client-count must be a positive integer.");
        ids = Array.from({ length: count }, (_, index) => start + index);
    } else {
        ids = Array.from({ length: clientCount }, (_, index) => index);
    }
    if (new Set(ids).size !== ids.length) throw new Error("Client IDs must be unique; refusing to launch duplicate client IDs.");
    if (ids.some((item) => item < 0 || item >= clientCount)) throw new Error(`Client IDs must be in the range 0 through ${clientCount - 1}.`);
    return ids;
}

export function launchConfiguredClients(approach: Approach, clientModule: string): ChildProcess[] {
    const config = loadExperimentConfig();
    if (config.experiment.clientArrivalMode === "staged-reuse" && approach !== "heimdall" && approach !== "notification-aggregator") throw new Error("clientArrivalMode=staged-reuse is supported only by the Heimdall or Notification Aggregator launcher.");
    const requestedOutput = optionValue("--output-dir");
    const iteration = optionValue("--iteration") || "01";
    const clientIndices = resolveClientIndices(config.experiment.clientCount);
    const launchMarker = optionValue("--launch-marker");
    const skipHostMonitor = process.argv.includes("--skip-host-monitor");
    const outputDirectory = path.resolve(requestedOutput || path.join("results", "4hz", approach, `clients-${config.experiment.clientCount}`, `iteration-${iteration}-${Date.now()}`));
    fs.mkdirSync(outputDirectory, { recursive: true });
    const instance = workloadInstance(config);
    const variants = workloadVariants(config);
    const saturationQueries = config.experiment.saturationMode ? buildSaturationQueries(resolveStreams(config, instance), config.experiment.saturationMode, config.experiment.clientCount) : undefined;
    const queryByClient = Object.fromEntries(clientIndices.map((clientIndex) => {
        const streams = resolveStreams(config, instance);
        const saturation = saturationQueries?.[clientIndex];
        const query = saturation?.queryText || require("../../config/query").buildActivityIndexQuery(streams, { workloadMode: workloadMode(config), workloadInstance: instance });
        return [clientIndex, { queryText: query, queryHash: sha256(query), streams, ...(saturation ? { heimdallReuseIdentity: saturation.heimdallReuseIdentity, windowName: saturation.windowName, reuseClassification: saturation.reuseClassification, computationalEquivalence: saturation.computationalEquivalence } : {}) }];
    }));
    const metadataPath = path.join(outputDirectory, "metadata.json");
    const existingMetadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) as Record<string, any> : {};
    const previousLaunches = Array.isArray(existingMetadata.launches) ? existingMetadata.launches : [];
    const previousClientIds = Array.isArray(existingMetadata.launchedClientIds) ? existingMetadata.launchedClientIds : [];
    const architectureBehavior = config.experiment.saturationMode === "same-query" ? "maximum_shared_query_reuse" : config.experiment.saturationMode === "distinct-query" ? "controlled_non_reusable_query_identities" : config.experiment.workloadMode !== undefined && config.experiment.clientCount === 1 ? "single_client_workload_composition" : approach === "heimdall" ? "shared_query_reuse" : approach === "notification-aggregator" ? "shared_upstream_reuse" : "independent_processing";
    fs.writeFileSync(metadataPath, JSON.stringify({
        ...existingMetadata,
        run_id: process.env.EXPERIMENT_RUN_ID || path.basename(outputDirectory),
        approach, frequencyHz: config.experiment.frequencyHz, clientCount: config.experiment.clientCount,
        clientArrivalMode: config.experiment.clientArrivalMode,
        saturationMode: config.experiment.saturationMode,
        saturationModeDescription: config.experiment.saturationMode === "same-query" ? "maximum reuse: byte-identical query registrations" : config.experiment.saturationMode === "distinct-query" ? "controlled non-reusable query identities: computationally equivalent queries distinguished only by paired first-window identifiers" : undefined,
        workloadMode: workloadMode(config),
        workloadInstance: instance, queryVariant: variants.queryVariant, queryVariantLabel: queryVariantLabel(config), dataVariant: variants.dataVariant, replayerDataVariant: replayerDataVariant(config),
        arrivalMode: config.experiment.clientArrivalMode === "staged-reuse" ? "staged" : "simultaneous", architectureBehavior,
        launchedClientIds: Array.from(new Set([...previousClientIds, ...clientIndices])).sort((a, b) => a - b),
        launches: [...previousLaunches, { clientIds: clientIndices, timestamp: new Date().toISOString() }],
        iteration, durationSeconds: config.experiment.durationSeconds,
        resourceSamplingIntervalMs: config.experiment.resourceSamplingIntervalMs, startTimestamp: existingMetadata.startTimestamp || new Date().toISOString(),
        hosts: config.hosts, streams: resolveStreams(config, instance), streamTriplet: resolveStreams(config, instance), clientWorkloads: queryByClient, serviceUrls: config.urls, nodeVersion: process.version,
        queryText: queryByClient[0]?.queryText,
        queryHash: queryByClient[0]?.queryHash, evaluationRepositorySha: process.env.EVALUATION_REPOSITORY_SHA || "unknown",
        rspJsSha: process.env.RSP_JS_REPOSITORY_SHA || "45112d2955b99796d234747db34bd6804939e69a", serviceSha: process.env.SERVICE_REPOSITORY_SHA || undefined,
        max_out_of_orderness_ms: 30000, clockSynchronization: { status: "unverified", crossMachineMetrics: "unavailable until pre-run clock evidence is collected" }
    }, null, 2) + "\n");
    const hostMonitor = skipHostMonitor ? undefined : monitorHostResources(path.join(outputDirectory, "client-host-resource.csv"), config.experiment.resourceSamplingIntervalMs);
    const children: ChildProcess[] = [];
    for (const clientIndex of clientIndices) {
        const child = fork(clientModule, [], { env: { ...process.env, EXPERIMENT_CLIENT_INDEX: String(clientIndex), EXPERIMENT_OUTPUT_DIRECTORY: outputDirectory, EXPERIMENT_RUN_ID: process.env.EXPERIMENT_RUN_ID || path.basename(outputDirectory) } });
        child.on("exit", (code, signal) => console.log(`${approach} client ${clientIndex} exited (${code ?? signal ?? "unknown"}).`));
        children.push(child);
    }
    let exited = 0;
    children.forEach((child) => child.once("exit", () => { exited += 1; if (exited === children.length) void hostMonitor?.stop(); }));
    const stop = () => children.forEach((child) => { if (!child.killed) child.kill("SIGTERM"); });
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    if (launchMarker) {
        const markerPath = path.resolve(launchMarker);
        fs.writeFileSync(`${markerPath}.tmp`, JSON.stringify({ run_id: process.env.EXPERIMENT_RUN_ID || path.basename(outputDirectory), approach, client_ids: clientIndices, launched_epoch_ms: Date.now() }) + "\n");
        fs.renameSync(`${markerPath}.tmp`, markerPath);
    }
    console.log(`Launched ${children.length} ${approach} child clients (${clientIndices.join(",")}) in ${outputDirectory}.`);
    return children;
}
