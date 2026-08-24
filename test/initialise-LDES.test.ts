import * as assert from "assert";
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import * as path from "path";
import { initializationTargets, treePath } from "../initialise-LDES";

process.env.EXPERIMENT_CONFIG_PATH = path.resolve(__dirname, "../src/experiments/config/experiment-config.n079.test.json");

assert.deepStrictEqual(initializationTargets(), [
    "http://n079-11.wall1.ilabt.imec.be:3000/pod1/acc-x/",
    "http://n079-11.wall1.ilabt.imec.be:3000/pod1/acc-y/",
    "http://n079-11.wall1.ilabt.imec.be:3000/pod1/acc-z/"
]);
assert.strictEqual(treePath, "https://saref.etsi.org/core/hasTimestamp");

const repositoryRoot = path.resolve(__dirname, "..");
const runnerSource = readFileSync(path.join(repositoryRoot, "src/experiments/orchestration/run-experiment.sh"), "utf8");
const dryRun = execFileSync("bash", [
    path.join(repositoryRoot, "src/experiments/orchestration/run-experiment.sh"),
    "heimdall",
    "--dry-run"
], {
    cwd: repositoryRoot,
    env: {
        ...process.env,
        EXPERIMENT_CONFIG_PATH: path.join(repositoryRoot, "src/experiments/config/experiment-config.n079.test.json"),
        EXPERIMENT_CLIENT_CONFIG_PATH: "/home/test/experiment-config.n079.json",
        EXPERIMENT_RUN_ID: "dry-run-test"
    }
}).toString();
const normalizedDryRun = dryRun.replace(/\\(.)/g, "$1");
assert.match(normalizedDryRun, /heimdall-results: .*\.evaluation-results\/dry-run-test\/iteration-XX/);
assert.match(normalizedDryRun, /heimdall-pid: .*\.evaluation-results\/dry-run-test\/heimdall\.pid/);
assert.match(normalizedDryRun, /expected-shas: .*replayer=a98ec1cba14f4437bb0bbefd915fb07e79a454fe/);
assert.match(normalizedDryRun, /expected-shas: .*heimdall=a6dbbba45f7d764355e010e4b5e3b82fd2795778/);
assert.match(normalizedDryRun, /expected-shas: .*rspJs=97a8865a3225a0699705d4f8cf7359ba6dd04611/);
assert.match(normalizedDryRun, /clients: .*EXPERIMENT_CONFIG_PATH='\/home\/test\/experiment-config\.n079\.json'/);
assert.match(normalizedDryRun, /clients: .*EXPERIMENT_RUN_ID='dry-run-test'.*EVALUATION_REPOSITORY_SHA=/);
assert.match(normalizedDryRun, /mkdir -p ".*\.evaluation-results\/dry-run-test" ".*\.evaluation-results\/dry-run-test\/iteration-XX" .*setsid/);
assert.match(normalizedDryRun, /setsid bash -c .*& replayer_pid=.*replayer\.pid/);
assert.match(normalizedDryRun, /setsid bash -c .*& heimdall_pid=.*heimdall\.pid/);
assert.match(normalizedDryRun, /collect: .*decentralized-stream-aggregator-evaluation.*iteration-XX .*\/results\/4hz\/heimdall\/clients-1\/run-dry-run-test\//);
assert.match(normalizedDryRun, /collect-service: .*\.evaluation-results\/dry-run-test\/iteration-XX .*\/iteration-XX\/service/);
assert.match(normalizedDryRun, /collect-service: .*n079-09[^:]*:\$HOME\/experiments\/heimdall\/\.evaluation-results/);
assert.doesNotMatch(normalizedDryRun, /collect: .*\/\.\s*$/m);
assert.doesNotMatch(normalizedDryRun, /collect-service: .*\/\.\s*$/m);
assert.match(normalizedDryRun, /cleanup-pids: heimdall=.*\.evaluation-results\/dry-run-test\/heimdall\.pid replayer=.*\.evaluation-runtime\/dry-run-test\/replayer\.pid/);
assert.doesNotMatch(normalizedDryRun, /collect-service: .*n079-09[^:]*:\$HOME\/experiments\/decentralized-stream-aggregator-evaluation/);
assert.match(runnerSource, /kill -TERM --/);
assert.match(runnerSource, /replayer_pid_file/);
assert.match(runnerSource, /client_launch_command\(\)\s*\{/);
assert.match(runnerSource, /EXPERIMENT_CONFIG_PATH=%s/);
assert.match(runnerSource, /client_launch_command "\$iteration_dir"/);
assert.doesNotMatch(runnerSource, /\b(pkill|killall)\b/);
console.log("initialise-LDES n079 configuration test passed");
