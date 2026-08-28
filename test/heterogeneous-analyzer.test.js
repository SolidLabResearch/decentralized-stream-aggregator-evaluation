const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { analyzeRoot, sample, stat } = require("../analysis/heterogeneous-workloads/analyze");

function write(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function csv(file, headers, rows) { write(file, `${headers.join(",")}\n${rows.map(row => headers.map(header => row[header] ?? "").join(",")).join("\n")}\n`); }
function metadata(runId, mode, instance, approach = "without-aggregator") {
  const query = Number(instance) === 0 ? "Q0" : `Q${instance}`;
  const label = ["Q0_property", "Q1_sensor", "Q2_measurement_type"][Number(instance)];
  const data = mode === "different-query-different-data" ? ["A", "B", "C"][Number(instance)] : "A";
  const segment = `segment-0${data === "A" ? 1 : data === "B" ? 2 : 3}`;
  const stream = `http://n078/pod1/heterogeneous/${segment}/acc-x/`;
  return { run_id: runId, approach, clientCount: 1, clientArrivalMode: "simultaneous", workloadMode: mode, workloadInstance: Number(instance), queryVariant: query, queryVariantLabel: label, dataVariant: data, replayerDataVariant: data, streamTriplet: { x: stream, y: stream.replace("acc-x", "acc-y"), z: stream.replace("acc-x", "acc-z") } };
}
function writeRun(root, runId, mode, instance, options = {}) {
  const dir = path.join(root, runId), approach = options.approach || "without-aggregator", meta = metadata(runId, mode, instance, approach);
  write(path.join(dir, "metadata.json"), JSON.stringify(meta));
  const registration = options.registration ?? 100, r2r = options.r2r ?? 7;
  const operations = [
    { operation: "registration_to_first_result", duration_ms: registration, start_monotonic_ns: "100000000", end_monotonic_ns: "200000000" },
    ...(options.missingProcessing ? [] : [
      { operation: "rsp_insertion", duration_ms: "", start_monotonic_ns: "900000000", end_monotonic_ns: "1000000000" },
      { operation: "r2r_first_result", duration_ms: r2r, start_monotonic_ns: "4900000000", end_monotonic_ns: "5000000000" },
    ]),
  ];
  csv(path.join(dir, "client-0-operations.csv"), ["operation", "duration_ms", "start_monotonic_ns", "end_monotonic_ns"], operations);
  csv(path.join(dir, "client-0-results.csv"), ["result_id"], options.emptyResults ? [] : [{ result_id: "result-1" }]);
  csv(path.join(dir, "client-0-resource.csv"), ["timestamp", "cpu_utilization_percent", "rss"], [{ timestamp: "1", cpu_utilization_percent: "10", rss: "100" }]);
  csv(path.join(dir, "client-host-resource.csv"), ["timestamp", "cpu_user"], [{ timestamp: "1", cpu_user: "1" }]);
  const roles = [{ role: "solid", delta_rx_bytes: "10", delta_tx_bytes: "20" }, { role: "client", delta_rx_bytes: "50", delta_tx_bytes: "60" }, { role: "replayer", delta_rx_bytes: "70", delta_tx_bytes: "80" }];
  if (approach !== "without-aggregator") roles.splice(1, 0, { role: "service", delta_rx_bytes: "30", delta_tx_bytes: "40" });
  csv(path.join(dir, "network.csv"), ["role", "delta_rx_bytes", "delta_tx_bytes"], roles);
  if (approach !== "without-aggregator") csv(path.join(dir, "service-resource.csv"), ["timestamp", "cpu_utilization_percent", "rss_bytes"], [{ timestamp: "1", cpu_utilization_percent: "5", rss_bytes: "200" }]);
  if (approach === "heimdall") {
    csv(path.join(dir, "service", "initialization.csv"), ["operation"], [{ operation: "query_registration" }]);
    csv(path.join(dir, "service", "event-processing.csv"), ["operation", "end_monotonic_ns"], [{ operation: "rsp_insertion", end_monotonic_ns: "1000000000" }]);
    csv(path.join(dir, "service", "window-processing.csv"), ["operation", "duration_ms", "end_monotonic_ns"], [{ operation: "r2r_first_result", duration_ms: "7", end_monotonic_ns: "5000000000" }]);
  }
  return dir;
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "heterogeneous-analyzer-"));
try {
  const direct = writeRun(fixture, "direct", "same-query-same-data", 0);
  const directSample = sample(direct, JSON.parse(fs.readFileSync(path.join(direct, "metadata.json"), "utf8")));
  assert.strictEqual(directSample.registration_to_first_result_ms, 100);
  assert.strictEqual(directSample.r2r_first_result_ms, 7);
  assert.strictEqual(directSample.first_event_to_first_result_ms, 4000);
  assert.notStrictEqual(directSample.registration_to_first_result_ms, directSample.r2r_first_result_ms);
  assert.strictEqual(directSample.solid_rx_bytes, 10);
  assert.strictEqual(directSample.solid_tx_bytes, 20);
  assert.strictEqual(directSample.client_rx_bytes, 50);
  assert.strictEqual(directSample.client_tx_bytes, 60);
  assert.ok(Number.isNaN(directSample.service_rx_bytes), "direct client service RX must be N/A");
  assert.ok(Number.isNaN(directSample.service_tx_bytes), "direct client service TX must be N/A");
  const heimdall = writeRun(fixture, "heimdall", "same-query-same-data", 0, { approach: "heimdall" });
  const heimdallSample = sample(heimdall, JSON.parse(fs.readFileSync(path.join(heimdall, "metadata.json"), "utf8")));
  assert.strictEqual(heimdallSample.first_event_to_first_result_ms, 4000, "Heimdall uses service-side event/result monotonic timestamps");
  assert.strictEqual(heimdallSample.r2r_first_result_ms, 7, "Heimdall R2R comes from service window-processing");
  assert.deepStrictEqual(stat([1, 3]), { n: 2, mean: 2, sd: Math.sqrt(2), median: 2, q1: 1.5, q3: 2.5 });

  const incomplete = writeRun(fixture, "incomplete", "same-query-same-data", 0, { missingProcessing: true });
  const incompleteSample = sample(incomplete, JSON.parse(fs.readFileSync(path.join(incomplete, "metadata.json"), "utf8")));
  assert.strictEqual(incompleteSample.completeness, 0, "non-empty results without processing evidence are incomplete");
  assert.ok(Number.isNaN(incompleteSample.first_event_to_first_result_ms), "missing processing timestamps must be N/A");

  const formalRoot = path.join(fixture, "formal");
  write(path.join(formalRoot, "campaign-logs", "attempts.csv"), "run_id,repetition,status\n" + [
    ["formal-b0", 4, "valid"], ["formal-b1", 4, "valid"], ["formal-b2", 4, "valid"], ["SMOKE-NONFORMAL-b0", 4, "valid"],
  ].map(row => row.join(",")).join("\n") + "\n");
  writeRun(formalRoot, "formal-b0", "different-query-same-data", 0, { registration: 100, r2r: 10 });
  writeRun(formalRoot, "formal-b1", "different-query-same-data", 1, { registration: 300, r2r: 30 });
  writeRun(formalRoot, "formal-b2", "different-query-same-data", 2, { registration: 500, r2r: 50 });
  writeRun(formalRoot, "SMOKE-NONFORMAL-b0", "different-query-same-data", 0, { registration: 999, r2r: 999 });
  const output = path.join(formalRoot, "analysis");
  const result = analyzeRoot(formalRoot, output);
  assert.strictEqual(result.perWorkload.find(row => row.workload === "B0").retained_valid_n, 1, "SMOKE-NONFORMAL run is excluded");
  const bSummary = result.scenarioSummary.find(row => row.scenario === "B" && row.approach === "without-aggregator");
  assert.strictEqual(bSummary.aggregation, "equal-weighted variant means");
  assert.strictEqual(bSummary.registration_to_first_result_ms_equal_weighted_mean, 300);
  assert.strictEqual(bSummary.r2r_first_result_ms_equal_weighted_mean, 30);
  assert.match(fs.readFileSync(path.join(output, "heterogeneous-per-workload.csv"), "utf8"), /registration_to_first_result_ms_mean/);
  console.log("heterogeneous analyzer tests passed");
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
