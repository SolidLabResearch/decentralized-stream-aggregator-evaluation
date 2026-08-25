#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function csv(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).filter(Boolean).map(line => Object.fromEntries(headers.map((h, i) => [h, line.split(",")[i] || ""])));
}
function values(file, predicate, column) { return csv(file).filter(predicate).map(row => Number(row[column])).filter(Number.isFinite); }
function quantile(xs, p) { const a = [...xs].sort((x, y) => x - y); if (!a.length) return NaN; const i = (a.length - 1) * p; const lo = Math.floor(i); const hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); }
function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN; }
function sd(xs) { if (xs.length < 2) return NaN; const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)); }
function number(value) { return Number.isFinite(value) ? value : ""; }
function resourceCpu(rows) {
  if (rows.some(r => Number.isFinite(Number(r.cpu_utilization_percent)))) return mean(rows.map(r => Number(r.cpu_utilization_percent)).filter(Number.isFinite));
  const user = rows.map(r => Number(r.cpu_user_us ?? r.cpu_user_jiffies)), system = rows.map(r => Number(r.cpu_system_us ?? r.cpu_system_jiffies)), wall = rows.map(r => Number(r.timestamp_epoch_ms ?? r.timestamp));
  const factor = rows[0] && rows[0].cpu_user_jiffies !== undefined ? 10 : 1000;
  const samples = []; for (let i = 1; i < rows.length; i++) { const dt = wall[i] - wall[i - 1]; if (dt > 0) samples.push(100 * ((user[i] - user[i - 1]) + (system[i] - system[i - 1])) / (dt * factor)); }
  return mean(samples);
}

function summarizeDirectory(root, approach, clients, output) {
  const repetitions = [];
  for (const iteration of fs.readdirSync(root).filter(name => /^iteration-\d+$/.test(name)).sort()) {
    const dir = path.join(root, iteration);
    const latency = [], clientCpu = [], summedRss = [];
    for (let client = 0; client < clients; client++) {
      const prefix = path.join(dir, `client-${client}`);
      latency.push(...values(`${prefix}-operations.csv`, r => r.operation === "registration_to_first_result", "duration_ms"));
      clientCpu.push(resourceCpu(csv(`${prefix}-resource.csv`)));
      const rss = values(`${prefix}-resource.csv`, r => true, "rss");
      if (rss.length) summedRss.push(mean(rss));
    }
    const host = csv(path.join(dir, "client-host-resource.csv"));
    const servicePath = path.join(dir, "service-resource.csv");
    const service = fs.existsSync(servicePath) ? csv(servicePath) : [];
    const w1File = approach === "heimdall" ? path.join(dir, "service", "window-processing.csv") : null;
    const w1 = w1File && fs.existsSync(w1File) ? values(w1File, r => r.operation === "r2r_first_result", "duration_ms") : Array.from({length: clients}, (_, client) => values(path.join(dir, `client-${client}-operations.csv`), r => r.operation === "r2r_first_result", "duration_ms")).flat();
    repetitions.push({ approach, client_count: clients, iteration: Number(iteration.slice(10)), mean_registration_to_first_result_ms: mean(latency), median_registration_to_first_result_ms: quantile(latency, .5), p95_registration_to_first_result_ms: quantile(latency, .95), max_registration_to_first_result_ms: latency.length ? Math.max(...latency) : NaN, aggregate_client_cpu_percent: clientCpu.reduce((a, b) => a + b, 0), summed_process_rss_bytes: summedRss.length ? summedRss.reduce((a, b) => a + b, 0) : NaN, client_host_cpu_percent: mean(host.map(r => Number(r.host_cpu_utilization_percent)).filter(Number.isFinite)), client_host_mem_used_bytes: mean(host.map(r => Number(r.mem_used_bytes)).filter(Number.isFinite)), client_host_mem_available_bytes: mean(host.map(r => Number(r.mem_available_bytes)).filter(Number.isFinite)), service_cpu_percent: resourceCpu(service), service_rss_bytes: mean(service.map(r => Number(r.rss_bytes ?? r.rss)).filter(Number.isFinite)), w1_r2r_first_result_ms: approach === "heimdall" ? (w1.length ? w1[0] : NaN) : mean(w1) });
  }
  const fields = Object.keys(repetitions[0] || {});
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, `${approach}-per-repetition.csv`), [fields.join(","), ...repetitions.map(r => fields.map(f => number(r[f])).join(","))].join("\n") + "\n");
  const retained = repetitions.filter(r => r.iteration >= 4 && r.iteration <= 33);
  const summary = [];
  for (const field of fields.filter(f => !["approach", "client_count", "iteration"].includes(f))) { const xs = retained.map(r => Number(r[field])).filter(Number.isFinite); summary.push({ approach, client_count: clients, metric: field, repetitions: xs.length, mean: mean(xs), sample_sd: sd(xs), median: quantile(xs, .5), q1: quantile(xs, .25), q3: quantile(xs, .75), iqr: quantile(xs, .75) - quantile(xs, .25) }); }
  fs.writeFileSync(path.join(output, `${approach}-retained-04-33-summary.csv`), [Object.keys(summary[0] || {}).join(","), ...summary.map(r => Object.values(r).map(number).join(","))].join("\n") + "\n");
}

const [root, approach, clientsText, output = path.join(root || ".", "analysis")] = process.argv.slice(2);
if (!root || !approach || !clientsText) { console.error("Usage: analyze.js ITERATION_ROOT APPROACH CLIENT_COUNT [OUTPUT]"); process.exit(2); }
summarizeDirectory(root, approach, Number(clientsText), output);
