import * as assert from "assert";
import { execFileSync } from "child_process";
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
assert.match(dryRun, /heimdall-results: .*\.evaluation-results\/dry-run-test\/iteration-XX/);
assert.match(dryRun, /heimdall-pid: .*\.evaluation-results\/dry-run-test\/heimdall\.pid/);
assert.match(dryRun, /expected-shas: .*replayer=a98ec1cba14f4437bb0bbefd915fb07e79a454fe/);
assert.doesNotMatch(dryRun, /n079-02.*\.evaluation-results/);
assert.doesNotMatch(dryRun, /n079-09.*decentralized-stream-aggregator-evaluation.*service/);
console.log("initialise-LDES n079 configuration test passed");
