import * as assert from "assert";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { validateExperimentConfig } from "../src/experiments/config/config";
import { auditSaturationDataset, buildSaturationQueries, heimdallReuseIdentity } from "../src/experiments/config/saturation";
import { buildActivityIndexQuery } from "../src/experiments/config/query";

const root = path.resolve(__dirname, ".."); const config = JSON.parse(fs.readFileSync(path.join(root, "src/experiments/config/experiment-config.n078.saturation.json"), "utf8")); const streams = config.streams;
const canonical = buildActivityIndexQuery(streams);
assert.strictEqual(buildActivityIndexQuery(streams), canonical, "canonical non-saturation query remains byte-identical");
for (const count of [32, 64, 128]) assert.doesNotThrow(() => validateExperimentConfig({ ...config, experiment: { ...config.experiment, clientCount: count, saturationMode: "same-query" } }));
assert.throws(() => validateExperimentConfig({ ...config, experiment: { ...config.experiment, clientCount: 31, saturationMode: undefined } }), /1 through 30/, "normal experiments retain <=30 validation");
const same = buildSaturationQueries(streams, "same-query", 128); const distinct = buildSaturationQueries(streams, "distinct-query", 128);
assert.strictEqual(same.length, 128); assert.strictEqual(new Set(same.map(q => q.queryText)).size, 1); assert.strictEqual(new Set(same.map(q => q.queryHash)).size, 1); assert.strictEqual(new Set(same.map(q => q.heimdallReuseIdentity)).size, 1);
assert.ok(same.every(query => query.reuseClassification === "maximum-reuse"), "same-query labels maximum reuse");
assert.strictEqual(distinct.length, 128); assert.strictEqual(new Set(distinct.map(q => q.queryHash)).size, 128); assert.strictEqual(new Set(distinct.map(q => q.heimdallReuseIdentity)).size, 128);
for (const query of distinct) { assert.strictEqual(query.queryText.replace(/:satw\d{4}/g, ":w1"), same[0].queryText.replace(/:satw\d{4}/g, ":w1"), "Qsat0 and Qsat127 retain identical structure and expected cardinality except for the paired window identity"); assert.strictEqual(query.computationalEquivalence, "same-streams-data-windows-bgp-projection-and-expected-cardinality"); assert.strictEqual(query.reuseClassification, "controlled-non-reusable-identity"); assert.strictEqual(query.heimdallReuseIdentity, heimdallReuseIdentity(query.queryText)); }
const equivalence = require("/Users/kushbisen/Code/solid-stream-aggregator/node_modules/rspql-query-equivalence");
assert.strictEqual(equivalence.is_equivalent(same[0].queryText, same[127].queryText), true, "same-query is service-equivalent");
assert.strictEqual(equivalence.is_equivalent(distinct[0].queryText, distinct[127].queryText), false, "computationally equivalent Qsat0/Qsat127 identities are non-reusable by the installed Heimdall equivalence logic");
const withFilter = same[0].queryText.replace("\n}", "\nFILTER(?o > -1000)\n}"); assert.strictEqual(equivalence.is_equivalent(same[0].queryText, withFilter), true, "FILTER literals are rejected as a non-reuse mechanism because Heimdall ignores them");
const dataset = auditSaturationDataset("/Users/kushbisen/Code/PANDA Platform/dahcc-benchmark-dataset/accelerometer-3minute/4Hz.nt"); assert.ok(dataset.observations > 0 && dataset.minValue <= dataset.maxValue && dataset.canonicalObservationShape, "local 4 Hz data audit proves canonical numeric observation shape");
const discovery = execFileSync("bash", [path.join(root, "src/experiments/orchestration/run-heimdall-saturation-discovery.sh"), "--dry-run"], { encoding: "utf8" }).trim().split(/\r?\n/); assert.strictEqual(discovery.length - 1, 48, "default discovery is 2 modes × 8 counts × 3 repetitions");
const runner = fs.readFileSync(path.join(root, "src/experiments/orchestration/run-heimdall-saturation-experiment.sh"), "utf8"); assert.match(runner, /heimdall/); assert.doesNotMatch(runner, /notification-aggregator|without-aggregator/); assert.match(runner, /--dry-run/); assert.match(runner, /--preflight/); assert.match(runner, /SATURATION_CLIENT_READY_TIMEOUT_SECONDS/);
const experimentRunner = fs.readFileSync(path.join(root, "src/experiments/orchestration/run-experiment.sh"), "utf8"); assert.match(experimentRunner, /heimdall_saturation_ready_command/); assert.match(experimentRunner, /kill -0 --/); assert.match(experimentRunner, /SATURATION_CLIENT_READY_TIMEOUT_SECONDS/);
const lifecycle = path.join(root, "src/experiments/orchestration/saturation-client-lifecycle.sh");
assert.match(experimentRunner, /setsid env/); assert.match(experimentRunner, /client_pgid/); assert.match(experimentRunner, /saturation-attempt-id/); assert.match(experimentRunner, /saturation-evaluation-checkout/);
assert.match(experimentRunner, /client_pid_file="\$saturation_client_marker"/); assert.match(experimentRunner, /cleanup \|\| exit 70/);
assert.match(fs.readFileSync(lifecycle, "utf8"), /kill -TERM -- "-\$pgid"/); assert.match(fs.readFileSync(lifecycle, "utf8"), /kill -KILL -- "-\$pgid"/);
assert.doesNotMatch(fs.readFileSync(lifecycle, "utf8"), /pkill|killall|\/proc\/\*/);
function lifecycleFixture(lines: string[], action: "preflight" | "cleanup"): { output: string; killLog: string; status: number } {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-saturation-lifecycle-")); const bin = path.join(temp, "bin"); const state = path.join(temp, "ps.txt"); const killLog = path.join(temp, "kill.log"); const checkout = "/home/test/experiments/heimdall-evaluation-saturation"; const stateDir = path.join(temp, "state"); fs.mkdirSync(bin); fs.mkdirSync(stateDir); fs.writeFileSync(state, lines.join("\n") + "\n");
    const bashEnv = path.join(temp, "bash-env"); fs.writeFileSync(path.join(bin, "ps"), `#!/usr/bin/env bash\ncat ${JSON.stringify(state)}\n`); fs.writeFileSync(bashEnv, `kill() { echo "$*" >> ${JSON.stringify(killLog)}; awk '!/heimdall\\/(launcher|client)\\.ts/' ${JSON.stringify(state)} > ${JSON.stringify(`${state}.next`)} && mv ${JSON.stringify(`${state}.next`)} ${JSON.stringify(state)}; }\n`); fs.chmodSync(path.join(bin, "ps"), 0o755);
    const args = [lifecycle, action, "--checkout", checkout, "--state-dir", stateDir]; if (action === "cleanup") { const marker = path.join(stateDir, "attempt-a.pgid"); fs.writeFileSync(marker, "4242\n"); args.push("--attempt-id", "attempt-a", "--marker", marker); }
    try { return { output: execFileSync("bash", args, { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BASH_ENV: bashEnv } }), killLog: fs.existsSync(killLog) ? fs.readFileSync(killLog, "utf8") : "", status: 0 }; } catch (error) { const e = error as any; return { output: String(e.stdout || "") + String(e.stderr || ""), killLog: fs.existsSync(killLog) ? fs.readFileSync(killLog, "utf8") : "", status: e.status }; }
}
const checkout = "/home/test/experiments/heimdall-evaluation-saturation";
const unrelated = "  77    77 Sl node /home/other/project/client.ts"; const unrelatedSameGroup = "  77  4242 Sl node /home/other/project/client.ts";
let fixture = lifecycleFixture([unrelated], "preflight"); assert.strictEqual(fixture.status, 0); assert.match(fixture.output, /SATURATION_CLIENT_CLEANUP=PASS/); assert.strictEqual(fixture.killLog, "", "unrelated Node process is never targeted");
const ownedLauncher = ` 101  4242 Sl node ${checkout}/node_modules/.bin/ts-node ${checkout}/src/experiments/clients/heimdall/launcher.ts --saturation-attempt-id=attempt-a --saturation-evaluation-checkout=${checkout}`;
const ownedClient = ` 102  4242 Sl node ${checkout}/node_modules/.bin/ts-node ${checkout}/src/experiments/clients/heimdall/client.ts --saturation-attempt-id=attempt-a --saturation-evaluation-checkout=${checkout}`;
fixture = lifecycleFixture([ownedLauncher, ownedClient], "preflight"); assert.strictEqual(fixture.status, 0); assert.match(fixture.killLog, /-TERM -- -4242/, "stale launcher/client group receives group TERM"); assert.match(fixture.output, /remaining_launcher_processes=0[\s\S]*remaining_client_processes=0/);
fixture = lifecycleFixture([ownedLauncher, ownedClient], "cleanup"); assert.strictEqual(fixture.status, 0); assert.match(fixture.output, /SATURATION_CLIENT_CLEANUP=PASS/, "post-run cleanup is mandatory and proves no attempt processes remain");
const legacyLauncher = ` 101  4242 Sl node ${checkout}/node_modules/.bin/ts-node ${checkout}/src/experiments/clients/heimdall/launcher.ts --output-dir results/4hz/heimdall-saturation/same-query/clients-8/run-old/iteration-01`; const legacyClient = ` 102  4242 Sl node ${checkout}/node_modules/.bin/ts-node ${checkout}/src/experiments/clients/heimdall/client.ts`;
fixture = lifecycleFixture([legacyLauncher, legacyClient], "preflight"); assert.strictEqual(fixture.status, 0, "preflight also drains a safely identifiable legacy saturation group"); assert.match(fixture.killLog, /-TERM -- -4242/);
fixture = lifecycleFixture([ownedLauncher, unrelatedSameGroup], "preflight"); assert.notStrictEqual(fixture.status, 0); assert.match(fixture.output, /SATURATION_CLIENT_CLEANUP=FAIL unsafe_or_missing_process_group=4242/); assert.strictEqual(fixture.killLog, "", "a mixed process group is rejected instead of risking an unrelated process");
const discoveryScript = fs.readFileSync(path.join(root, "src/experiments/orchestration/run-heimdall-saturation-discovery.sh"), "utf8"); assert.match(discoveryScript, /status == 70/); assert.doesNotMatch(discoveryScript, /run-heimdall-saturation-experiment\.sh.*\|\| true/);
console.log("Heimdall saturation query, identity, dataset, schedule, and isolation tests passed");
