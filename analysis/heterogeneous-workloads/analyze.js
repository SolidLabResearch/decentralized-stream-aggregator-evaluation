#!/usr/bin/env node
/* Formal heterogeneous analysis. Smoke/non-formal runs are never included. */
const fs = require("fs");
const path = require("path");

const scenarioName = { "same-query-same-data": "A", "different-query-same-data": "B", "different-query-different-data": "C" };
const scenarioWorkloads = { A: ["A0"], B: ["B0", "B1", "B2"], C: ["C0", "C1", "C2"] };
const metricNames = [
  "registration_to_first_result_ms", "first_event_to_first_result_ms", "r2r_first_result_ms",
  "cpu_utilization_percent", "memory_rss_bytes", "solid_rx_bytes", "solid_tx_bytes",
  "service_rx_bytes", "service_tx_bytes", "client_rx_bytes", "client_tx_bytes",
  "replayer_rx_bytes", "replayer_tx_bytes", "completeness",
];

function parseCsv(text) {
  if (!text || !text.trim()) return [];
  const records = []; let record = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted && char === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { record.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      record.push(value); records.push(record); record = []; value = "";
    } else value += char;
  }
  if (value.length || record.length) { record.push(value); records.push(record); }
  const [headers, ...body] = records;
  return (headers || []).length ? body.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((header, i) => [header, row[i] || ""]))) : [];
}
function csv(file) { return fs.existsSync(file) ? parseCsv(fs.readFileSync(file, "utf8")) : []; }
function hasFileRows(file) { return fs.existsSync(file) && csv(file).length > 0; }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : NaN; }
function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN; }
function quantile(values, p) {
  const sorted = [...values].sort((a, b) => a - b); if (!sorted.length) return NaN;
  const index = (sorted.length - 1) * p, low = Math.floor(index), high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}
function stat(values) {
  const numbers = values.filter(Number.isFinite), average = mean(numbers);
  const variance = numbers.length > 1 ? numbers.reduce((sum, value) => sum + (value - average) ** 2, 0) / (numbers.length - 1) : NaN;
  return { n: numbers.length, mean: average, sd: Number.isFinite(variance) ? Math.sqrt(variance) : NaN, median: quantile(numbers, .5), q1: quantile(numbers, .25), q3: quantile(numbers, .75) };
}
function workloadId(mode, instance) { return `${scenarioName[mode]}${instance}`; }
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => { const candidate = path.join(dir, entry.name); return entry.isDirectory() ? walk(candidate) : entry.name === "metadata.json" ? [path.dirname(candidate)] : []; });
}
function earliestEnd(rows) {
  const ends = rows.map(row => { try { return BigInt(row.end_monotonic_ns); } catch { return undefined; } }).filter(value => value !== undefined);
  return ends.length ? ends.reduce((a, b) => a < b ? a : b) : undefined;
}
function monotonicDeltaMs(startRows, endRows) {
  const start = earliestEnd(startRows), end = earliestEnd(endRows);
  return start === undefined || end === undefined || end < start ? NaN : Number(end - start) / 1_000_000;
}
function firstDuration(rows) {
  const candidates = rows.map(row => ({ end: earliestEnd([row]), duration: finite(row.duration_ms) })).filter(item => item.end !== undefined && Number.isFinite(item.duration));
  if (!candidates.length) return NaN;
  candidates.sort((a, b) => a.end < b.end ? -1 : a.end > b.end ? 1 : 0); return candidates[0].duration;
}
function expectedWorkload(metadata) {
  const mode = metadata.workloadMode, instance = Number(metadata.workloadInstance);
  if (!scenarioName[mode] || !Number.isInteger(instance) || instance < 0 || instance > 2 || (mode === "same-query-same-data" && instance !== 0)) return undefined;
  return { queryVariant: mode === "same-query-same-data" ? "Q0" : `Q${instance}`, queryVariantLabel: ["Q0_property", "Q1_sensor", "Q2_measurement_type"][instance], dataVariant: mode === "different-query-different-data" ? ["A", "B", "C"][instance] : "A" };
}
function expectedSegment(dataVariant) { return `segment-0${dataVariant === "A" ? 1 : dataVariant === "B" ? 2 : 3}`; }
function operationRows(dir) { return csv(path.join(dir, "client-0-operations.csv")); }
function networkValue(row, direction) {
  // collect-network currently emits rx_bytes/tx_bytes; accept delta_* in older run-owned exports.
  const delta = row[`delta_${direction}_bytes`]; return finite(delta !== undefined && delta !== "" ? delta : row[`${direction}_bytes`]);
}
function roleNetwork(dir, approach, role, direction) {
  if (approach === "without-aggregator" && role === "service") return NaN;
  const row = csv(path.join(dir, "network.csv")).find(value => value.role === role); return row ? networkValue(row, direction) : NaN;
}
function averageResource(dir) {
  const rows = csv(path.join(dir, "client-0-resource.csv"));
  return { cpu_utilization_percent: mean(rows.map(row => finite(row.cpu_utilization_percent)).filter(Number.isFinite)), memory_rss_bytes: mean(rows.map(row => finite(row.rss !== "" ? row.rss : row.rss_bytes)).filter(Number.isFinite)) };
}
function structurallyComplete(dir, metadata, approach, operations, networkRows, expected) {
  if (!expected || metadata.approach !== approach || metadata.clientCount !== 1 || metadata.clientArrivalMode !== "simultaneous") return false;
  if (metadata.queryVariant !== expected.queryVariant || metadata.queryVariantLabel !== expected.queryVariantLabel || metadata.dataVariant !== expected.dataVariant || metadata.replayerDataVariant !== expected.dataVariant) return false;
  if (!metadata.streamTriplet || Object.values(metadata.streamTriplet).some(value => typeof value !== "string" || !value.includes(`/heterogeneous/${expectedSegment(expected.dataVariant)}/`))) return false;
  if (!hasFileRows(path.join(dir, "client-0-results.csv")) || !hasFileRows(path.join(dir, "client-0-resource.csv")) || !hasFileRows(path.join(dir, "client-host-resource.csv"))) return false;
  if (!operations.some(row => row.operation === "registration_to_first_result" && Number.isFinite(finite(row.duration_ms)))) return false;
  if (approach !== "heimdall" && ["rsp_insertion", "r2r_first_result"].some(operation => !operations.some(row => row.operation === operation))) return false;
  const expectedRoles = approach === "without-aggregator" ? ["solid", "client", "replayer"] : ["solid", "service", "client", "replayer"];
  if (expectedRoles.some(role => !networkRows.some(row => row.role === role && Number.isFinite(networkValue(row, "rx")) && Number.isFinite(networkValue(row, "tx"))))) return false;
  if (approach !== "without-aggregator" && !hasFileRows(path.join(dir, "service-resource.csv"))) return false;
  if (approach === "heimdall") {
    if (!hasFileRows(path.join(dir, "service", "initialization.csv"))) return false;
    if (!csv(path.join(dir, "service", "event-processing.csv")).some(row => row.operation === "rsp_insertion")) return false;
    if (!csv(path.join(dir, "service", "window-processing.csv")).some(row => row.operation === "r2r_first_result")) return false;
  }
  return true;
}
function sample(dir, metadata) {
  const approach = metadata.approach, operations = operationRows(dir), serviceEvents = csv(path.join(dir, "service", "event-processing.csv")), serviceWindows = csv(path.join(dir, "service", "window-processing.csv"));
  const processingEvents = approach === "heimdall" ? serviceEvents.filter(row => row.operation === "rsp_insertion") : operations.filter(row => row.operation === "rsp_insertion");
  const processingResults = approach === "heimdall" ? serviceWindows.filter(row => row.operation === "r2r_first_result") : operations.filter(row => row.operation === "r2r_first_result");
  const resources = averageResource(dir), expected = expectedWorkload(metadata), networkRows = csv(path.join(dir, "network.csv"));
  const values = {
    scenario: scenarioName[metadata.workloadMode], workload: workloadId(metadata.workloadMode, metadata.workloadInstance), approach,
    query: metadata.queryVariant, query_label: metadata.queryVariantLabel, data: metadata.dataVariant, runId: metadata.run_id,
    registration_to_first_result_ms: firstDuration(operations.filter(row => row.operation === "registration_to_first_result")),
    first_event_to_first_result_ms: monotonicDeltaMs(processingEvents, processingResults), r2r_first_result_ms: firstDuration(processingResults), ...resources,
    solid_rx_bytes: roleNetwork(dir, approach, "solid", "rx"), solid_tx_bytes: roleNetwork(dir, approach, "solid", "tx"),
    service_rx_bytes: roleNetwork(dir, approach, "service", "rx"), service_tx_bytes: roleNetwork(dir, approach, "service", "tx"),
    client_rx_bytes: roleNetwork(dir, approach, "client", "rx"), client_tx_bytes: roleNetwork(dir, approach, "client", "tx"),
    replayer_rx_bytes: roleNetwork(dir, approach, "replayer", "rx"), replayer_tx_bytes: roleNetwork(dir, approach, "replayer", "tx"),
  };
  values.completeness = structurallyComplete(dir, metadata, approach, operations, networkRows, expected) ? 1 : 0;
  return values;
}
function analyzeRoot(root, output) {
  const attemptsPath = path.join(root, "campaign-logs", "attempts.csv");
  if (!fs.existsSync(attemptsPath)) throw new Error(`Formal analysis requires ${attemptsPath}; refusing to infer a campaign from smoke output.`);
  const attempts = csv(attemptsPath), validRunIds = new Set(attempts.filter(row => row.status === "valid" && Number(row.repetition) >= 4 && Number(row.repetition) <= 33 && !String(row.run_id || "").startsWith("SMOKE-NONFORMAL-")).map(row => row.run_id));
  const samples = [];
  for (const dir of walk(root)) { let metadata; try { metadata = JSON.parse(fs.readFileSync(path.join(dir, "metadata.json"), "utf8")); } catch { continue; } if (metadata.clientCount === 1 && validRunIds.has(metadata.run_id)) samples.push(sample(dir, metadata)); }
  const groups = new Map(); for (const item of samples) { const key = `${item.scenario}|${item.workload}|${item.approach}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); }
  const perWorkload = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, values]) => {
    const first = values[0], row = { scenario: first.scenario, workload: first.workload, approach: first.approach, query: first.query, query_label: first.query_label, data: first.data, retained_valid_n: values.length, complete_n: values.filter(item => item.completeness === 1).length, incomplete_n: values.filter(item => item.completeness === 0).length };
    for (const metric of metricNames) Object.assign(row, Object.fromEntries(Object.entries(stat(values.map(item => item[metric]))).map(([key, value]) => [`${metric}_${key}`, value])));
    return row;
  });
  const scenarioSummary = [];
  for (const approach of ["heimdall", "notification-aggregator", "without-aggregator"]) for (const scenario of ["A", "B", "C"]) {
    const variants = scenarioWorkloads[scenario].map(workload => perWorkload.find(row => row.scenario === scenario && row.workload === workload && row.approach === approach)).filter(Boolean), first = variants[0] || { scenario, approach }, complete = variants.length === scenarioWorkloads[scenario].length && variants.every(row => row.retained_valid_n > 0);
    const row = { scenario, approach, workload_variants: variants.length, repetitions_per_variant: variants.map(value => value.retained_valid_n).join("/"), aggregation: complete ? "equal-weighted variant means" : "unavailable: missing variant", completeness: complete ? mean(variants.map(value => value.completeness_mean).filter(Number.isFinite)) : NaN };
    for (const metric of metricNames) row[`${metric}_equal_weighted_mean`] = complete ? mean(variants.map(value => value[`${metric}_mean`]).filter(Number.isFinite)) : NaN;
    scenarioSummary.push(row);
  }
  fs.mkdirSync(output, { recursive: true }); writeCsv(path.join(output, "heterogeneous-per-workload.csv"), perWorkload); writeCsv(path.join(output, "heterogeneous-scenario-summary.csv"), scenarioSummary);
  fs.writeFileSync(path.join(output, "heterogeneous-per-workload.json"), JSON.stringify(perWorkload, null, 2) + "\n"); fs.writeFileSync(path.join(output, "heterogeneous-scenario-summary.json"), JSON.stringify(scenarioSummary, null, 2) + "\n");
  writeMarkdown(path.join(output, "heterogeneous-per-workload.md"), perWorkload, ["scenario", "workload", "approach", "query", "query_label", "data", "retained_valid_n", "complete_n", "incomplete_n", ...metricNames.flatMap(metric => [`${metric}_mean`, `${metric}_sd`, `${metric}_median`, `${metric}_q1`, `${metric}_q3`])]);
  writeMarkdown(path.join(output, "heterogeneous-scenario-summary.md"), scenarioSummary, ["scenario", "approach", "workload_variants", "repetitions_per_variant", "aggregation", ...metricNames.map(metric => `${metric}_equal_weighted_mean`), "completeness"]);
  return { perWorkload, scenarioSummary };
}
function csvValue(value) { return value === undefined || Number.isNaN(value) ? "" : /[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value); }
function writeCsv(file, rows) { const headers = [...new Set(rows.flatMap(row => Object.keys(row)))]; fs.writeFileSync(file, [headers.join(","), ...rows.map(row => headers.map(header => csvValue(row[header])).join(","))].join("\n") + "\n"); }
function writeMarkdown(file, rows, columns) { const lines = [`| ${columns.join(" | ")} |`, `|${columns.map(() => "---").join("|")}|`]; for (const row of rows) lines.push(`| ${columns.map(column => row[column] === undefined || Number.isNaN(row[column]) ? "--" : row[column]).join(" | ")} |`); fs.writeFileSync(file, lines.join("\n") + "\n"); }

if (require.main === module) {
  const root = path.resolve(process.argv[2] || "results/4hz/heterogeneous"), output = path.resolve(process.argv[3] || path.join(root, "analysis"));
  try { const result = analyzeRoot(root, output); console.log(path.join(output, "heterogeneous-per-workload.csv")); console.log(path.join(output, "heterogeneous-scenario-summary.csv")); console.log(`retained formal samples: ${result.perWorkload.reduce((sum, row) => sum + row.retained_valid_n, 0)}`); } catch (error) { console.error(error.message); process.exit(1); }
}
module.exports = { analyzeRoot, parseCsv, stat, sample, structurallyComplete };
