import * as fs from "fs";
import * as path from "path";

type Validation = { valid: boolean; errors: string[] };

function rows(file: string): Array<Record<string, string>> {
    const text = fs.readFileSync(file, "utf8").trim(); if (!text) return [];
    const records: string[][] = []; let record: string[] = [], value = "", quoted = false;
    for (let index = 0; index < text.length; index += 1) { const char = text[index]; if (quoted && char === '"' && text[index + 1] === '"') { value += char; index += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { record.push(value); value = ""; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; record.push(value); records.push(record); record = []; value = ""; } else value += char; }
    if (value.length || record.length) { record.push(value); records.push(record); }
    const [headers, ...body] = records; return body.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function requireFile(file: string, errors: string[]): void { if (!fs.existsSync(file)) errors.push(`missing ${file}`); }
function hasOperation(file: string, operation: string): boolean { return rows(file).some((row) => row.operation === operation); }

export function validateMultiClientRepetition(iterationDirectory: string, approach: string, clientCount: number): Validation {
    const errors: string[] = [];
    for (let client = 0; client < clientCount; client += 1) {
        const prefix = path.join(iterationDirectory, `client-${client}`);
        const operations = `${prefix}-operations.csv`;
        const resource = `${prefix}-resource.csv`;
        const results = `${prefix}-results.csv`;
        const ooo = `${prefix}-out-of-order.csv`;
        [operations, resource, results, ooo, `${prefix}-ready.json`, `${prefix}-first-result.ready`].forEach((file) => requireFile(file, errors));
        if (fs.existsSync(results) && rows(results).length === 0) errors.push(`${results} has no result observation`);
        if (!fs.existsSync(operations)) continue;
        const operationRows = rows(operations);
        const first = operationRows.filter((row) => row.operation === "registration_to_first_result");
        if (first.length !== 1 || first.some((row) => row.client_id !== String(client) || !Number.isFinite(Number(row.duration_ms)) || Number(row.duration_ms) < 0 || BigInt(row.end_monotonic_ns || "-1") < BigInt(row.start_monotonic_ns || "0"))) errors.push(`invalid registration_to_first_result for client ${client}`);
        if ((approach === "without-aggregator" || approach === "notification-aggregator") && !hasOperation(operations, "stream_discovery")) errors.push(`missing stream discovery for client ${client}`);
        if (!hasOperation(operations, "stream_subscription")) errors.push(`missing stream subscription for client ${client}`);
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
    if (approach === "heimdall") { const service = path.join(iterationDirectory, "service", "window-processing.csv"); requireFile(service, errors); if (fs.existsSync(service) && rows(service).filter(row => row.operation === "r2r_first_result" && /^\/w1:/.test(row.window_id || "")).length !== 1) errors.push("Heimdall must have exactly one shared service-side /w1: r2r_first_result"); }
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
