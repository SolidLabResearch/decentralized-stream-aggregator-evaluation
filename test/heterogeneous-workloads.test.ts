import * as assert from "assert";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { buildActivityIndexQuery } from "../src/experiments/config/query";
import { loadExperimentConfig, queryVariantLabel, resolveStreams, validateExperimentConfig, workloadInstance, workloadVariants } from "../src/experiments/config/config";
import { sha256 } from "../src/experiments/clients/shared/instrumentation";
import { expectedWorkload, formalWorkloadConfigurations, isFormalWorkload, validateHeterogeneousCampaign } from "../src/experiments/validation/heterogeneous-workload";

const root = path.resolve(__dirname, "..");
const heterogeneousConfigPath = path.resolve(root, "src/experiments/config/experiment-config.n078.heterogeneous.json");
const config = loadExperimentConfig(heterogeneousConfigPath);
const legacyN079 = loadExperimentConfig(path.resolve(root, "src/experiments/config/experiment-config.n079.test.json"));
const q0 = buildActivityIndexQuery(config.streams, { workloadMode: "different-query-same-data", workloadInstance: 0 });
const q1 = buildActivityIndexQuery(config.streams, { workloadMode: "different-query-same-data", workloadInstance: 1 });
const q2 = buildActivityIndexQuery(config.streams, { workloadMode: "different-query-same-data", workloadInstance: 2 });

assert.strictEqual(buildActivityIndexQuery(config.streams), q0, "legacy no-options query is the canonical Q0 output");
assert.strictEqual(sha256(buildActivityIndexQuery(legacyN079.streams)), "f86071f8d1a70f303cbe9cedc9fc75eb42f6c0dae00232b1eb8d81120052de75", "ordinary legacy query remains byte-for-byte unchanged");
assert.strictEqual(config.experiment.clientCount, 1, "heterogeneous configuration is fixed at N=1");
assert.strictEqual(workloadInstance(config), 0, "ordinary configurations default to workload instance 0");
assert.throws(() => validateExperimentConfig({ ...config, experiment: { ...config.experiment, workloadInstance: 3 as any } }), /workloadInstance/);
assert.throws(() => resolveStreams(config, 3), /Invalid workload instance/);
assert.throws(() => buildActivityIndexQuery(config.streams, { workloadMode: "same-query-same-data", workloadInstance: 1 }), /one formal query/);
assert.strictEqual(isFormalWorkload("same-query-same-data", 0), true);
assert.strictEqual(isFormalWorkload("same-query-same-data", 1), false);
assert.strictEqual(isFormalWorkload("same-query-same-data", 2), false);
assert.throws(() => expectedWorkload("same-query-same-data", 1), /Invalid formal workload combination/);

assert.strictEqual(new Set([q0, q1, q2]).size, 3, "Q0/Q1/Q2 are distinct query strings");
assert.strictEqual(new Set([sha256(q0), sha256(q1), sha256(q2)]).size, 3, "Q0/Q1/Q2 have distinct query hashes");
assert.match(q0, /saref:relatesToProperty dahccsensors:wearable\.acceleration\.x/);
assert.match(q1, /saref:measurementMadeBy dahccsensors:E4\.A03846\.Accelerometer/);
assert.match(q2, /PREFIX dcterms: <http:\/\/purl\.org\/dc\/terms\/>/);
assert.match(q2, /dcterms:isVersionOf saref:Measurement/);
for (const query of [q0, q1, q2]) {
    assert.doesNotMatch(query, /BIND\("variant-/);
    assert.doesNotMatch(query, /\?queryVariant/);
    assert.strictEqual((query.match(/FROM NAMED WINDOW/g) || []).length, 3, "exactly three named windows");
    assert.strictEqual((query.match(/RANGE 60000/g) || []).length, 3, "same RANGE in every window");
    assert.strictEqual((query.match(/STEP 20000/g) || []).length, 3, "same STEP in every window");
    assert.strictEqual((query.match(/saref:hasValue/g) || []).length, 3, "three value patterns");
    assert.strictEqual((query.match(/SELECT \(func:sqrt\(\?o \* \?o \+ \?o2 \* \?o2 \+ \?o3 \* \?o3\) AS \?activityIndex\)/g) || []).length, 1, "same activity expression");
    for (const windowName of ["w1", "w2", "w3"]) {
        const window = new RegExp(`WINDOW :${windowName} \\{([\\s\\S]*?)\\n    \\}`, "m").exec(query)?.[1] || "";
        assert.strictEqual((window.match(/\?s .*? \./g) || []).length, 2, `${windowName} has exactly two triple patterns`);
    }
}
for (const query of [q0, q1, q2]) assert.deepStrictEqual([...query.matchAll(/ON STREAM <([^>]+)>/g)].map(match => match[1]), [config.streams.x, config.streams.y, config.streams.z], "stream mapping remains unchanged across query variants");

const expectedMappings: Array<[any, number, string, string, string]> = [
    ["same-query-same-data", 0, "Q0", "Q0_property", "A"],
    ["different-query-same-data", 0, "Q0", "Q0_property", "A"], ["different-query-same-data", 1, "Q1", "Q1_sensor", "A"], ["different-query-same-data", 2, "Q2", "Q2_measurement_type", "A"],
    ["different-query-different-data", 0, "Q0", "Q0_property", "A"], ["different-query-different-data", 1, "Q1", "Q1_sensor", "B"], ["different-query-different-data", 2, "Q2", "Q2_measurement_type", "C"]
];
for (const [mode, instance, queryVariant, queryLabel, dataVariant] of expectedMappings) {
    const configured = validateExperimentConfig({ ...config, experiment: { ...config.experiment, workloadMode: mode, workloadInstance: instance as 0 | 1 | 2 } });
    assert.deepStrictEqual(workloadVariants(configured), { queryVariant, dataVariant }, `${mode}/${instance} mapping`);
    assert.strictEqual(queryVariantLabel(configured), queryLabel, `${mode}/${instance} query label`);
}
const diffDataConfig = validateExperimentConfig({ ...config, experiment: { ...config.experiment, workloadMode: "different-query-different-data" } });
const diffData = [0, 1, 2].map(instance => resolveStreams(diffDataConfig, instance));
assert.strictEqual(new Set(diffData.map(value => JSON.stringify(value))).size, 3, "C variants resolve three stream triplets");
assert.strictEqual(new Set(diffData.flatMap(value => [value.x, value.y, value.z])).size, 9, "C variants resolve nine logical stream URLs");
assert.strictEqual(formalWorkloadConfigurations().length, 7, "there are seven formal workload configurations");

for (const segment of ["01", "02", "03"]) {
    const replayer = JSON.parse(fs.readFileSync(path.resolve(root, `src/experiments/config/replayer.n078.heterogeneous.segment-${segment}.json`), "utf8"));
    assert.strictEqual(replayer.frequency_event, 4, `segment-${segment} replayer uses 4 Hz event frequency`);
    assert.strictEqual(replayer.frequency_buffer, 4, `segment-${segment} replayer uses 4 Hz buffer frequency`);
}

// The benchmark observation shape deliberately carries all three descriptor predicates on the same subject.
const representativeObservation = `<obs> <https://saref.etsi.org/core/hasValue> "1.0" .\n<obs> <https://saref.etsi.org/core/relatesToProperty> <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/wearable.acceleration.x> .\n<obs> <https://saref.etsi.org/core/measurementMadeBy> <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/E4.A03846.Accelerometer> .\n<obs> <http://purl.org/dc/terms/isVersionOf> <https://saref.etsi.org/core/Measurement> .`;
for (const predicate of ["relatesToProperty", "measurementMadeBy", "isVersionOf"]) assert.match(representativeObservation, new RegExp(predicate));

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
    const queryLabel = row.instance === 0 ? "Q0_property" : row.instance === 1 ? "Q1_sensor" : "Q2_measurement_type";
    fs.writeFileSync(path.join(directory, "metadata.json"), JSON.stringify({ run_id: runId, approach: row.approach, clientCount: 1, workloadMode: row.workload, workloadInstance: row.instance, ...expected, queryVariantLabel: queryLabel, replayerDataVariant: expected.dataVariant }));
    attemptLines.push([runId, row.repetition, row.workload, row.approach, row.instance, "valid"].join(","));
}
fs.writeFileSync(path.join(logDirectory, "attempts.csv"), attemptLines.join("\n") + "\n");
assert.deepStrictEqual(validateHeterogeneousCampaign(campaignRoot), { valid: true, errors: [] }, "campaign validator proves seven workloads × three approaches × 35 with n=30 retained each");
fs.rmSync(campaignRoot, { recursive: true, force: true });

const wrapperPath = path.join(root, "src/experiments/orchestration/run-heterogeneous-experiment.sh"); const wrapper = fs.readFileSync(wrapperPath, "utf8");
assert.match(wrapper, /same-query-same-data has one formal workload configuration/, "wrapper rejects A/i1 and A/i2");
assert.match(wrapper, /a1a2100ea64870da086ec64be1914141eca0fb93/, "heterogeneous wrapper freezes the formal replayer revision");
assert.match(wrapper, /historical n079 replayer command\/config/, "wrapper rejects historical replayer commands");
assert.match(wrapper, /HETEROGENEOUS_REPLAYER_START_COMMAND_\$\{data_variant\}/, "wrapper selects one data-specific replayer command");
assert.doesNotMatch(wrapper, /HETEROGENEOUS_REPLAYER_START_COMMANDS/, "wrapper does not use a concurrent replayer command array");
for (const [mode, instance, expectedCommand] of [["same-query-same-data", "0", "segment-a"], ["different-query-same-data", "2", "segment-a"], ["different-query-different-data", "1", "segment-b"], ["different-query-different-data", "2", "segment-c"]]) {
    const dryRun = execFileSync("bash", [wrapperPath, "heimdall", mode, instance, "--dry-run"], { cwd: root, env: { ...process.env, EXPERIMENT_CLIENT_CONFIG_PATH: heterogeneousConfigPath, HETEROGENEOUS_REPLAYER_START_COMMAND_A: "printf segment-a", HETEROGENEOUS_REPLAYER_START_COMMAND_B: "printf segment-b", HETEROGENEOUS_REPLAYER_START_COMMAND_C: "printf segment-c" }, encoding: "utf8" });
    assert.match(dryRun, new RegExp(`printf\\\\ ${expectedCommand}`), `${mode}/i${instance} selects exactly one expected replayer command`);
}
try {
    execFileSync("bash", [wrapperPath, "heimdall", "same-query-same-data", "0"], { cwd: root, env: { ...process.env, EXPERIMENT_CLIENT_CONFIG_PATH: "config-on-client", HETEROGENEOUS_REPLAYER_START_COMMAND_A: "<PLACEHOLDER>" }, stdio: "pipe" });
    assert.fail("placeholder replayer command was accepted");
} catch (error) { assert.match(String((error as any).stderr), /placeholder or historical n079/i, "placeholder replayer command fails before any runner invocation"); }
try {
    execFileSync("bash", [wrapperPath, "heimdall", "same-query-same-data", "0"], { cwd: root, env: { ...process.env, EXPERIMENT_CLIENT_CONFIG_PATH: "config-on-client", REPLAYER_START_COMMAND: "printf generic-fallback" }, stdio: "pipe" });
    assert.fail("generic REPLAYER_START_COMMAND fallback was accepted");
} catch (error) { assert.match(String((error as any).stderr), /HETEROGENEOUS_REPLAYER_START_COMMAND_A/, "heterogeneous wrapper does not fall back to generic replayer command"); }
console.log("heterogeneous workload query/campaign tests passed");
