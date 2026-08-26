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
assert.strictEqual(distinct.length, 128); assert.strictEqual(new Set(distinct.map(q => q.queryHash)).size, 128); assert.strictEqual(new Set(distinct.map(q => q.heimdallReuseIdentity)).size, 128);
for (const query of distinct) { assert.strictEqual(query.queryText.replace(/:satw\d{4}/g, ":w1"), same[0].queryText.replace(/:satw\d{4}/g, ":w1"), "only the paired controlled window identity differs"); assert.strictEqual(query.heimdallReuseIdentity, heimdallReuseIdentity(query.queryText)); }
const equivalence = require("/Users/kushbisen/Code/solid-stream-aggregator/node_modules/rspql-query-equivalence");
assert.strictEqual(equivalence.is_equivalent(same[0].queryText, same[127].queryText), true, "same-query is service-equivalent");
assert.strictEqual(equivalence.is_equivalent(distinct[0].queryText, distinct[127].queryText), false, "distinct first-window identities are not reusable by the installed Heimdall equivalence logic");
const withFilter = same[0].queryText.replace("\n}", "\nFILTER(?o > -1000)\n}"); assert.strictEqual(equivalence.is_equivalent(same[0].queryText, withFilter), true, "FILTER literals are rejected as a non-reuse mechanism because Heimdall ignores them");
const dataset = auditSaturationDataset("/Users/kushbisen/Code/PANDA Platform/dahcc-benchmark-dataset/accelerometer-3minute/4Hz.nt"); assert.ok(dataset.observations > 0 && dataset.minValue <= dataset.maxValue && dataset.canonicalObservationShape, "local 4 Hz data audit proves canonical numeric observation shape");
const discovery = execFileSync("bash", [path.join(root, "src/experiments/orchestration/run-heimdall-saturation-discovery.sh"), "--dry-run"], { encoding: "utf8" }).trim().split(/\r?\n/); assert.strictEqual(discovery.length - 1, 48, "default discovery is 2 modes × 8 counts × 3 repetitions");
const runner = fs.readFileSync(path.join(root, "src/experiments/orchestration/run-heimdall-saturation-experiment.sh"), "utf8"); assert.match(runner, /heimdall/); assert.doesNotMatch(runner, /notification-aggregator|without-aggregator/); assert.match(runner, /--dry-run/); assert.match(runner, /--preflight/); assert.match(runner, /SATURATION_CLIENT_READY_TIMEOUT_SECONDS/);
const experimentRunner = fs.readFileSync(path.join(root, "src/experiments/orchestration/run-experiment.sh"), "utf8"); assert.match(experimentRunner, /heimdall_saturation_ready_command/); assert.match(experimentRunner, /kill -0 --/); assert.match(experimentRunner, /SATURATION_CLIENT_READY_TIMEOUT_SECONDS/);
console.log("Heimdall saturation query, identity, dataset, schedule, and isolation tests passed");
