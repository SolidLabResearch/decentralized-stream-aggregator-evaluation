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
const absolutePathDryRun = execFileSync("bash", [
    path.join(repositoryRoot, "src/experiments/orchestration/run-experiment.sh"),
    "heimdall",
    "--dry-run"
], {
    cwd: repositoryRoot,
    env: {
        ...process.env,
        EXPERIMENT_CONFIG_PATH: path.join(repositoryRoot, "src/experiments/config/experiment-config.n079.test.json"),
        EXPERIMENT_CLIENT_CONFIG_PATH: "/home/test/experiment-config.n079.json",
        EXPERIMENT_RUN_ID: "absolute-path-test",
        EXPERIMENT_CONFIG_OVERRIDES: JSON.stringify({ remotePaths: { heimdall: "/srv/heimdall" } })
    }
}).toString().replace(/\\(.)/g, "$1");
assert.match(normalizedDryRun, /heimdall-results: .*\.evaluation-results\/dry-run-test\/iteration-XX/);
assert.match(normalizedDryRun, /heimdall-pid: .*\.evaluation-results\/dry-run-test\/heimdall\.pid/);
assert.match(normalizedDryRun, /heimdall-query-ready-command: .*test -f \"\$HOME\"'\/experiments\/heimdall\/\.evaluation-results\/dry-run-test\/iteration-XX\/initialization\.csv'/);
assert.match(normalizedDryRun, /heimdall-first-result-ready-command: .*test -f \"\$HOME\"'\/experiments\/heimdall\/\.evaluation-results\/dry-run-test\/iteration-XX\/window-processing\.csv'/);
assert.doesNotMatch(normalizedDryRun, /test -f '\$HOME\//);
assert.match(absolutePathDryRun, /heimdall-query-ready-command: .*test -f '\/srv\/heimdall\/\.evaluation-results\/absolute-path-test\/iteration-XX\/initialization\.csv'/);
assert.match(absolutePathDryRun, /heimdall-first-result-ready-command: .*test -f '\/srv\/heimdall\/\.evaluation-results\/absolute-path-test\/iteration-XX\/window-processing\.csv'/);
assert.match(normalizedDryRun, /expected-shas: .*replayer=a98ec1cba14f4437bb0bbefd915fb07e79a454fe/);
assert.match(normalizedDryRun, /expected-shas: .*heimdall=aa4a674ca03c7eb5a0e0e626ea5a8b3d190a9fef/);
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
assert.match(runnerSource, /all_client_ready_markers_command\(\)/);
assert.match(runnerSource, /client-\$client_id-ready\.json/);
assert.match(runnerSource, /all client confirmed-ready markers/);
assert.match(runnerSource, /wait_for_command "first Heimdall R2R result"/);
assert.match(runnerSource, /EXPERIMENT_STOP_AFTER_FIRST_WINDOW:-false/);
assert.match(runnerSource, /r2r_first_result/);
assert.doesNotMatch(runnerSource, /heimdall_first_result_ready_command[\s\S]*window_query_processing/);
assert.doesNotMatch(runnerSource, /first completed Heimdall window evaluation/);
assert.match(runnerSource, /window-processing\.csv/);
assert.match(runnerSource, /== "true"/);
assert.match(runnerSource, /\"\$duration\"/);
assert.match(runnerSource, /replayer will not be started/);
assert.ok(runnerSource.indexOf('all client confirmed-ready markers') < runnerSource.indexOf('experiment_ssh "$replayer_host" "$replayer_launch_command"'));
assert.ok(runnerSource.indexOf('wait_for_command "first Heimdall R2R result"') > runnerSource.indexOf('experiment_ssh "$replayer_host" "$replayer_launch_command"'));
assert.match(normalizedDryRun, /heimdall-query-readiness: query_registration >= 1 and stream_subscription >= 3/);
assert.match(normalizedDryRun, /heimdall-stop-mode: false/);
assert.match(normalizedDryRun, /first-window signal=r2r_first_result/);
assert.match(runnerSource, /all client first-result markers/);
assert.match(runnerSource, /heimdall_first_result_ready_command[\s\S]*\$duration/);
assert.doesNotMatch(runnerSource, /\b(pkill|killall)\b/);
assert.match(runnerSource, /remote_path_expression\(\)/);
assert.match(runnerSource, /remote_path_expression "\$csv_path"/);
assert.match(runnerSource, /remote_path_expression "\$initialization_csv"/);
assert.match(runnerSource, /SOLID POD HTTP reachable/);
assert.match(runnerSource, /curl --fail --silent --show-error --max-time 10/);
assert.match(runnerSource, /solid_pod_url/);
console.log("initialise-LDES n079 configuration test passed");
