import * as assert from "assert";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { buildActivityIndexQuery } from "../src/experiments/config/query";
import { loadExperimentConfig, resolveStreams, validateExperimentConfig, workloadInstance, workloadVariants } from "../src/experiments/config/config";
import { sha256 } from "../src/experiments/clients/shared/instrumentation";
import { expectedWorkload, formalWorkloadConfigurations, isFormalWorkload, validateHeterogeneousCampaign } from "../src/experiments/validation/heterogeneous-workload";

const root = path.resolve(__dirname, "..");
const config = loadExperimentConfig(path.resolve(root, "src/experiments/config/experiment-config.n078.heterogeneous.json"));
const legacy = buildActivityIndexQuery(config.streams);
assert.strictEqual(legacy, buildActivityIndexQuery(config.streams), "default canonical query remains deterministic");
const legacyN079 = loadExperimentConfig(path.resolve(root, "src/experiments/config/experiment-config.n079.test.json"));
assert.strictEqual(sha256(buildActivityIndexQuery(legacyN079.streams)), "f86071f8d1a70f303cbe9cedc9fc75eb42f6c0dae00232b1eb8d81120052de75", "ordinary legacy query remains byte-for-byte unchanged");
assert.strictEqual(config.experiment.clientCount, 1, "heterogeneous configuration is fixed at N=1");
assert.strictEqual(workloadInstance(config), 0, "ordinary configurations default to workload instance 0");
assert.throws(() => validateExperimentConfig({ ...config, experiment: { ...config.experiment, workloadInstance: 3 as any } }), /workloadInstance/);
assert.throws(() => resolveStreams(config, 3), /Invalid workload instance/);
assert.strictEqual(isFormalWorkload("same-query-same-data", 0), true);
assert.strictEqual(isFormalWorkload("same-query-same-data", 1), false);
assert.strictEqual(isFormalWorkload("same-query-same-data", 2), false);
assert.throws(() => expectedWorkload("same-query-same-data", 1), /Invalid formal workload combination/);

const expectedMappings: Array<[any, number, string, string]> = [
    ["same-query-same-data", 0, "Q0", "A"],
    ["different-query-same-data", 0, "Q0", "A"], ["different-query-same-data", 1, "Q1", "A"], ["different-query-same-data", 2, "Q2", "A"],
    ["different-query-different-data", 0, "Q0", "A"], ["different-query-different-data", 1, "Q1", "B"], ["different-query-different-data", 2, "Q2", "C"]
];
for (const [mode, instance, queryVariant, dataVariant] of expectedMappings) {
    const configured = validateExperimentConfig({ ...config, experiment: { ...config.experiment, workloadMode: mode, workloadInstance: instance as 0 | 1 | 2 } });
    assert.deepStrictEqual(workloadVariants(configured), { queryVariant, dataVariant }, `${mode}/${instance} mapping`);
    const query = buildActivityIndexQuery(resolveStreams(configured), { workloadMode: mode, workloadInstance: instance });
    assert.match(query, /RANGE 60000/); assert.match(query, /STEP 20000/);
    if (mode === "same-query-same-data") assert.doesNotMatch(query, /queryVariant/); else assert.match(query, new RegExp(`variant-${instance}`));
}
const diffSame = [0, 1, 2].map(instance => sha256(buildActivityIndexQuery(config.streams, { workloadMode: "different-query-same-data", workloadInstance: instance })));
assert.strictEqual(new Set(diffSame).size, 3, "B variants have distinct deterministic query hashes");
const diffDataConfig = validateExperimentConfig({ ...config, experiment: { ...config.experiment, workloadMode: "different-query-different-data" } });
const diffData = [0, 1, 2].map(instance => resolveStreams(diffDataConfig, instance));
assert.strictEqual(new Set(diffData.map(value => JSON.stringify(value))).size, 3, "C variants resolve three stream triplets");
assert.strictEqual(new Set(diffData.flatMap(value => [value.x, value.y, value.z])).size, 9, "C variants resolve nine logical stream URLs");
assert.strictEqual(formalWorkloadConfigurations().length, 7, "there are seven formal workload configurations");

const schedule = execFileSync("bash", [path.join(root, "src/experiments/orchestration/run-heterogeneous-campaign.sh"), "--dry-run"], { encoding: "utf8" }).trim().split(/\r?\n/);
assert.strictEqual(schedule.length - 1, 735, "campaign dry-run generates exactly 735 attempts");
const scheduleRows = schedule.slice(1).map(line => { const [approach, workload, instance, repetition] = line.split(","); return { approach, workload, instance: Number(instance), repetition: Number(repetition) }; });
for (const approach of ["heimdall", "notification-aggregator", "without-aggregator"]) for (const workload of formalWorkloadConfigurations()) {
    const rows = scheduleRows.filter(row => row.approach === approach && row.workload === workload.mode && row.instance === workload.instance);
    assert.strictEqual(rows.length, 35, `${approach}/${workload.id} has 35 attempts`);
    assert.deepStrictEqual(rows.map(row => row.repetition).sort((a,b) => a-b), Array.from({ length: 35 }, (_, index) => index + 1), `${approach}/${workload.id} has r01-r35 exactly once`);
    assert.strictEqual(rows.filter(row => row.repetition >= 4 && row.repetition <= 33).length, 30, `${approach}/${workload.id} has 30 retained attempts`);
}

const campaignRoot = fs.mkdtempSync(path.join(os.tmpdir(), "heterogeneous-campaign-")); const logDirectory = path.join(campaignRoot, "campaign-logs"); fs.mkdirSync(logDirectory);
const attemptLines = ["run_id,repetition,workload,approach,workload_instance,status"];
for (const row of scheduleRows) {
    const expected = expectedWorkload(row.workload as any, row.instance); const runId = `hetero-${row.approach}-${row.workload}-i${row.instance}-n1-r${String(row.repetition).padStart(2, "0")}-fixture`;
    const directory = path.join(campaignRoot, runId); fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "metadata.json"), JSON.stringify({ run_id: runId, approach: row.approach, clientCount: 1, workloadMode: row.workload, workloadInstance: row.instance, ...expected, replayerDataVariant: expected.dataVariant }));
    attemptLines.push([runId, row.repetition, row.workload, row.approach, row.instance, "valid"].join(","));
}
fs.writeFileSync(path.join(logDirectory, "attempts.csv"), attemptLines.join("\n") + "\n");
assert.deepStrictEqual(validateHeterogeneousCampaign(campaignRoot), { valid: true, errors: [] }, "campaign validator proves seven workloads × three approaches × 35 with n=30 retained each");
fs.rmSync(campaignRoot, { recursive: true, force: true });

const wrapper = fs.readFileSync(path.join(root, "src/experiments/orchestration/run-heterogeneous-experiment.sh"), "utf8");
assert.match(wrapper, /same-query-same-data has one formal workload configuration/, "wrapper rejects A/i1 and A/i2");
assert.match(wrapper, /HETEROGENEOUS_REPLAYER_START_COMMAND_\$\{data_variant\}/, "wrapper selects one data-specific replayer command");
assert.doesNotMatch(wrapper, /HETEROGENEOUS_REPLAYER_START_COMMANDS/, "wrapper does not use a concurrent replayer command array");
console.log("heterogeneous workload configuration/campaign tests passed");
