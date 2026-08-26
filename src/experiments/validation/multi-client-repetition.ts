import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

type Validation = { valid: boolean; errors: string[] };
export const CANONICAL_HEIMDALL_QUERY_SHA256 = "f86071f8d1a70f303cbe9cedc9fc75eb42f6c0dae00232b1eb8d81120052de75";

function rows(file: string): Array<Record<string, string>> {
    const text = fs.readFileSync(file, "utf8").trim(); if (!text) return [];
    const records: string[][] = []; let record: string[] = [], value = "", quoted = false;
    for (let index = 0; index < text.length; index += 1) { const char = text[index]; if (quoted && char === '"' && text[index + 1] === '"') { value += char; index += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { record.push(value); value = ""; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; record.push(value); records.push(record); record = []; value = ""; } else value += char; }
    if (value.length || record.length) { record.push(value); records.push(record); }
    const [headers, ...body] = records; return body.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function requireFile(file: string, errors: string[]): void { if (!fs.existsSync(file)) errors.push(`missing ${file}`); }
function hasOperation(file: string, operation: string): boolean { return rows(file).some((row) => row.operation === operation); }
function heimdallReuseKey(query: string): string { return crypto.createHash("md5").update(query.replace(/\s/g, "")).digest("hex"); }
function finiteNonNegative(value: string | undefined): boolean { return value !== undefined && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0; }

export function validateMultiClientRepetition(iterationDirectory: string, approach: string, clientCount: number): Validation {
    const errors: string[] = [];
    const metadataPath = path.join(iterationDirectory, "metadata.json");
    let stagedArrival = false;
    let stagedReuse = false;
    let replayStartEpochMs: number | undefined;
    if (fs.existsSync(metadataPath)) {
        try {
            const arrivalMode = JSON.parse(fs.readFileSync(metadataPath, "utf8")).clientArrivalMode;
            if (arrivalMode === "staged-reuse" && approach !== "heimdall" && approach !== "notification-aggregator") errors.push("staged-reuse is supported only for Heimdall or Notification Aggregator");
            stagedArrival = arrivalMode === "staged-reuse";
            stagedReuse = approach === "heimdall" && stagedArrival;
        }
        catch { /* The existing metadata validation below reports malformed metadata. */ }
    }
    if (stagedArrival) {
        const phaseMarkers = [
            "staged-client-0-launch.json", "staged-client-0-ready.json", "staged-reuse-clients-launch.json",
            "staged-reuse-clients-ready.json", "staged-reuse-validation-complete.json", "staged-all-clients-ready.json", "staged-replay-start.json"
        ];
        phaseMarkers.forEach((marker) => requireFile(path.join(iterationDirectory, marker), errors));
        if (phaseMarkers.every((marker) => fs.existsSync(path.join(iterationDirectory, marker)))) {
            try {
                const phases = phaseMarkers.map((marker) => JSON.parse(fs.readFileSync(path.join(iterationDirectory, marker), "utf8")));
                const times = phases.map((phase) => Number(phase.epoch_ms ?? phase.launched_epoch_ms));
                if (times.some((time) => !Number.isFinite(time))) throw new Error("missing phase timestamp");
                for (let index = 1; index < times.length; index += 1) if (times[index] <= times[index - 1]) errors.push(`staged phase marker ${phaseMarkers[index]} is not after ${phaseMarkers[index - 1]}`);
                replayStartEpochMs = times[times.length - 1];
                const reuseLaunch = phases[2];
                if (clientCount > 1) {
                    const expectedLateIds = Array.from({ length: clientCount - 1 }, (_, index) => index + 1);
                    if (JSON.stringify(reuseLaunch.client_ids) !== JSON.stringify(expectedLateIds)) errors.push("staged reuse-client launch did not contain exactly clients 1..N-1");
                }
            } catch { errors.push("invalid staged pre-replay phase ordering/launch marker"); }
        }
    }
    for (let client = 0; client < clientCount; client += 1) {
        const prefix = path.join(iterationDirectory, `client-${client}`);
        const operations = `${prefix}-operations.csv`;
        const resource = `${prefix}-resource.csv`;
        const results = `${prefix}-results.csv`;
        const ooo = `${prefix}-out-of-order.csv`;
        [operations, resource, results, ooo, `${prefix}-ready.json`, `${prefix}-first-result.ready`].forEach((file) => requireFile(file, errors));
        if (stagedArrival) [`${prefix}-registration.json`, `${prefix}-first-result.json`].forEach((file) => requireFile(file, errors));
        if (fs.existsSync(resource)) {
            const resourceRows = rows(resource);
            const resourceHeader = fs.readFileSync(resource, "utf8").split(/\r?\n/, 1)[0].split(",");
            for (const column of ["timestamp", "cpu_user", "cpu_system", "rss", "cpu_user_delta_us", "cpu_system_delta_us", "wall_delta_us", "cpu_utilization_percent"]) if (!resourceHeader.includes(column)) errors.push(`missing ${column} in ${resource}`);
            if (!resourceRows.length) errors.push(`${resource} has no samples`);
            if (resourceRows.length && !resourceRows.some((row) => finiteNonNegative(row.rss) && finiteNonNegative(row.cpu_utilization_percent))) errors.push(`${resource} has no usable CPU/RSS sample`);
        }
        if (fs.existsSync(results) && rows(results).length === 0) errors.push(`${results} has no result observation`);
        if (!fs.existsSync(operations)) continue;
        const operationRows = rows(operations);
        if (approach === "heimdall" && operationRows.some(row => row.client_id !== String(client) || row.query_id !== CANONICAL_HEIMDALL_QUERY_SHA256)) errors.push(`non-canonical Heimdall client provenance for client ${client}`);
        const expectedOperation = stagedReuse ? (client === 0 ? "cold_registration_to_first_result" : "reuse_registration_to_first_result") : stagedArrival ? (client === 0 ? "cold_registration_to_first_result" : "join_registration_to_first_result") : "registration_to_first_result";
        const first = operationRows.filter((row) => row.operation === expectedOperation);
        if (first.length !== 1 || first.some((row) => row.client_id !== String(client) || (stagedArrival && row.client_role !== (client === 0 ? "cold" : stagedReuse ? "reuse" : "join")) || !Number.isFinite(Number(row.duration_ms)) || Number(row.duration_ms) < 0 || BigInt(row.end_monotonic_ns || "-1") < BigInt(row.start_monotonic_ns || "0"))) errors.push(`invalid ${expectedOperation} for client ${client}`);
        if (stagedArrival && fs.existsSync(`${prefix}-registration.json`) && fs.existsSync(`${prefix}-first-result.json`)) {
            try {
                const registration = JSON.parse(fs.readFileSync(`${prefix}-registration.json`, "utf8"));
                const result = JSON.parse(fs.readFileSync(`${prefix}-first-result.json`, "utf8"));
                const expectedRole = client === 0 ? "cold" : stagedReuse ? "reuse" : "join";
                if (result.client_role !== expectedRole || BigInt(result.result_monotonic_ns || "-1") < BigInt(registration.registration_monotonic_ns || "0")) errors.push(`client ${client} first result is not proven post-registration`);
                if (replayStartEpochMs !== undefined && Number(result.result_epoch_ms) <= replayStartEpochMs) errors.push(`client ${client} first result was observed before replay-start`);
                const resultRows = rows(results).filter((row) => row.result_monotonic_ns);
                if (!resultRows.length) errors.push(`client ${client} has no monotonic staged result observation`);
                if (resultRows.some((row) => !row.result_id)) errors.push(`client ${client} has a staged result without a result identifier`);
                if (resultRows.some((row) => BigInt(row.result_monotonic_ns) < BigInt(registration.registration_monotonic_ns || "0"))) errors.push(`client ${client} has a result predating registration`);
            } catch { errors.push(`invalid staged registration/result identity for client ${client}`); }
        }
        if ((approach === "without-aggregator" || approach === "notification-aggregator") && !hasOperation(operations, "stream_discovery")) errors.push(`missing stream discovery for client ${client}`);
        if (approach !== "heimdall" && !hasOperation(operations, "stream_subscription")) errors.push(`missing stream subscription for client ${client}`);
        if (approach !== "heimdall" && !hasOperation(operations, "parsing_timestamp_extraction")) errors.push(`missing parsing/timestamp extraction for client ${client}`);
        if (approach !== "heimdall" && !hasOperation(operations, "rsp_insertion")) errors.push(`missing RSP insertion for client ${client}`);
        for (const row of operationRows.filter((value) => value.operation === "window_query_processing" || value.operation === "r2r_first_result")) {
            if (!row.window_id || BigInt(row.start_monotonic_ns || "-1") > BigInt(row.end_monotonic_ns || "-1")) errors.push(`invalid W1 ordering/window identity for client ${client}`);
        }
        if (approach !== "heimdall" && !operationRows.some(row => row.operation === "r2r_first_result" && /^\/w1:/.test(row.window_id || ""))) errors.push(`missing canonical /w1: r2r_first_result for client ${client}`);
    }
    const hostResource = path.join(iterationDirectory, "client-host-resource.csv"); requireFile(hostResource, errors);
    if (fs.existsSync(hostResource)) { const hostRows = rows(hostResource); const header = fs.readFileSync(hostResource, "utf8").split(/\r?\n/, 1)[0].split(","); for (const column of ["cpu_user", "cpu_nice", "cpu_system", "cpu_idle", "cpu_iowait", "cpu_irq", "cpu_softirq", "cpu_steal"]) if (!header.includes(column)) errors.push(`missing raw host CPU column ${column}`); if (!hostRows.length) errors.push(`${hostResource} has no samples`); }
    if (approach === "heimdall" || approach === "notification-aggregator") requireFile(path.join(iterationDirectory, "service-resource.csv"), errors);
    if (approach === "notification-aggregator") {
        const serviceResource = path.join(iterationDirectory, "service-resource.csv");
        if (fs.existsSync(serviceResource) && rows(serviceResource).length === 0) errors.push(`${serviceResource} has no service resource samples`);
    }
    if (approach === "heimdall") {
        const metadataPath = path.join(iterationDirectory, "metadata.json");
        const initialization = path.join(iterationDirectory, "service", "initialization.csv"); const service = path.join(iterationDirectory, "service", "window-processing.csv");
        requireFile(initialization, errors); requireFile(service, errors);
        let reuseKey = "";
        if (fs.existsSync(metadataPath)) { try { const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")); if (metadata.queryHash !== CANONICAL_HEIMDALL_QUERY_SHA256 || typeof metadata.queryText !== "string") errors.push("Heimdall metadata does not contain the expected canonical query hash/text"); else reuseKey = heimdallReuseKey(metadata.queryText); } catch { errors.push("invalid Heimdall metadata.json"); } }
        if (fs.existsSync(initialization) && reuseKey) {
            const serviceRows = rows(initialization).filter(row => row.query_id === reuseKey);
            const created = serviceRows.filter(row => row.operation === "shared_query_instance_created"); const reused = serviceRows.filter(row => row.operation === "shared_query_instance_reused");
            if (created.length !== 1) errors.push(`expected exactly one shared Heimdall query instance for ${reuseKey}, found ${created.length}`);
            if (stagedReuse ? reused.length !== clientCount - 1 : reused.length < clientCount - 1) errors.push(`expected ${stagedReuse ? "exactly" : "at least"} ${clientCount - 1} Heimdall reuse attachment events, found ${reused.length}`);
            if (stagedReuse && serviceRows.filter(row => row.operation === "query_registration").length !== clientCount) errors.push(`expected exactly ${clientCount} staged Heimdall query registrations`);
            const clients = new Set([...created, ...reused].map(row => row.client_id));
            for (let client = 0; client < clientCount; client += 1) if (!clients.has(String(client))) errors.push(`Heimdall client ${client} was not associated with the shared query`);
            if (stagedReuse && serviceRows.filter(row => row.operation === "stream_subscription").length !== 3) errors.push(`expected exactly three shared Heimdall upstream stream subscriptions, found ${serviceRows.filter(row => row.operation === "stream_subscription").length}`);
        }
        if (fs.existsSync(service) && rows(service).filter(row => row.operation === "r2r_first_result" && /^\/w1:/.test(row.window_id || "")).length !== 1) errors.push("Heimdall must have exactly one shared service-side /w1: r2r_first_result");
    }
    if (approach === "notification-aggregator" && stagedArrival) {
        const serviceLog = path.join(iterationDirectory, "service", "service.log");
        requireFile(serviceLog, errors);
        if (fs.existsSync(serviceLog)) {
            const logLines = fs.readFileSync(serviceLog, "utf8").split(/\r?\n/);
            if (logLines.filter((line) => line.includes("Server listening on port")).length !== 1) errors.push("Notification Aggregator staged run did not prove exactly one service instance");
            const marker = "Subscribed to the inbox container location:";
            const upstreamLocations = logLines.filter((line) => line.includes(marker)).map((line) => line.slice(line.indexOf(marker) + marker.length).trim()).filter(Boolean);
            if (upstreamLocations.length !== 3 || new Set(upstreamLocations).size !== 3) errors.push(`Notification Aggregator expected exactly three unique successful upstream subscriptions, found ${upstreamLocations.length}`);
        }
        const localProcessors = Array.from({ length: clientCount }, (_, client) => path.join(iterationDirectory, `client-${client}-operations.csv`)).filter((file) => fs.existsSync(file) && hasOperation(file, "r2r_first_result")).length;
        if (localProcessors !== clientCount) errors.push(`Notification Aggregator expected one local RSP result lifecycle per client (${clientCount}), found ${localProcessors}`);
    }
    const metadata = path.join(iterationDirectory, "metadata.json");
    requireFile(metadata, errors);
    return { valid: errors.length === 0, errors };
}

if (require.main === module) {
    const [directory, approach, countText] = process.argv.slice(2);
    if (!directory || !approach || !countText) { console.error("Usage: ts-node multi-client-repetition.ts ITERATION APPROACH CLIENT_COUNT"); process.exit(2); }
    const result = validateMultiClientRepetition(directory, approach, Number(countText));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
}
