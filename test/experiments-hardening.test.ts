import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { RawInstrumentation } from "../src/experiments/clients/shared/instrumentation";
import { monitorCurrentProcess } from "../src/experiments/monitoring/process-monitor";
import { parseProcStat } from "../src/experiments/monitoring/host-monitor";
import { validateMultiClientRepetition } from "../src/experiments/validation/multi-client-repetition";
import { buildActivityIndexQuery } from "../src/experiments/config/query";
import { loadExperimentConfig } from "../src/experiments/config/config";
import { resolveClientIndices } from "../src/experiments/clients/shared/runtime";
import * as crypto from "crypto";
import { execFileSync } from "child_process";

function writeHeimdallFixture(directory: string, creations: number, clientHashes?: string[], staged = false, clientCount = 2): void {
    const query = buildActivityIndexQuery(loadExperimentConfig(path.resolve(__dirname, "../src/experiments/config/experiment-config.n079.test.json")).streams);
    const key = crypto.createHash("md5").update(query.replace(/\s/g, "")).digest("hex");
    fs.writeFileSync(path.join(directory, "metadata.json"), JSON.stringify({ queryHash: crypto.createHash("sha256").update(query).digest("hex"), queryText: query, ...(staged ? { clientArrivalMode: "staged-reuse" } : {}) }));
    fs.writeFileSync(path.join(directory, "client-host-resource.csv"), "timestamp,cpu_user,cpu_nice,cpu_system,cpu_idle,cpu_iowait,cpu_irq,cpu_softirq,cpu_steal\n1,1,1,1,1,1,1,1,1\n");
    fs.writeFileSync(path.join(directory, "service-resource.csv"), "timestamp\n1\n"); fs.mkdirSync(path.join(directory, "service"));
    const initializationRows = ["run_id,approach,client_id,query_id,operation", ...Array.from({ length: creations }, (_, index) => `run,heimdall,${index},${key},shared_query_instance_created`), ...(clientCount > 1 ? [`run,heimdall,1,${key},shared_query_instance_reused`] : []), ...(staged ? [...Array.from({ length: clientCount }, (_, index) => `run,heimdall,${index},${key},query_registration`), `run,heimdall,0,${key},stream_subscription`, `run,heimdall,0,${key},stream_subscription`, `run,heimdall,0,${key},stream_subscription`] : [])];
    const initialization = initializationRows.join("\n") + "\n";
    fs.writeFileSync(path.join(directory, "service", "initialization.csv"), initialization);
    fs.writeFileSync(path.join(directory, "service", "window-processing.csv"), "operation,window_id\nr2r_first_result,/w1: shared\n");
    for (let client = 0; client < clientCount; client += 1) { const prefix = path.join(directory, `client-${client}`); const hash = clientHashes?.[client] || crypto.createHash("sha256").update(query).digest("hex"); const operation = staged ? (client === 0 ? "cold_registration_to_first_result" : "reuse_registration_to_first_result") : "registration_to_first_result"; const role = staged ? `,${client === 0 ? "cold" : "reuse"}` : ""; fs.writeFileSync(`${prefix}-operations.csv`, `client_id,query_id,operation,duration_ms,start_monotonic_ns,end_monotonic_ns${staged ? ",client_role" : ""}\n${client},${hash},${operation},1,1,2${role}\n`); fs.writeFileSync(`${prefix}-resource.csv`, "timestamp\n1\n"); fs.writeFileSync(`${prefix}-results.csv`, staged ? "result_id,result_epoch_ms,result_monotonic_ns\nr,11,2\n" : "result\nx\n"); fs.writeFileSync(`${prefix}-out-of-order.csv`, "event\n"); fs.writeFileSync(`${prefix}-ready.json`, "{}\n"); fs.writeFileSync(`${prefix}-first-result.ready`, "ok\n"); if (staged) { fs.writeFileSync(`${prefix}-registration.json`, JSON.stringify({ registration_monotonic_ns: 1 })); fs.writeFileSync(`${prefix}-first-result.json`, JSON.stringify({ client_role: client === 0 ? "cold" : "reuse", result_epoch_ms: 11, result_monotonic_ns: 2 })); } }
    if (staged) { const markers = ["staged-client-0-launch.json", "staged-client-0-ready.json", "staged-reuse-clients-launch.json", "staged-reuse-clients-ready.json", "staged-reuse-validation-complete.json", "staged-all-clients-ready.json", "staged-replay-start.json"]; markers.forEach((marker, index) => fs.writeFileSync(path.join(directory, marker), JSON.stringify(index === 0 ? { launched_epoch_ms: 1 } : index === 2 && clientCount > 1 ? { client_ids: [1], launched_epoch_ms: 3 } : { phase: marker, epoch_ms: index + 1 }) + "\n")); }
}

function writeNotificationStagedFixture(directory: string): void {
    fs.writeFileSync(path.join(directory, "metadata.json"), JSON.stringify({ clientArrivalMode: "staged-reuse", architectureBehavior: "shared_upstream_reuse" }));
    fs.writeFileSync(path.join(directory, "client-host-resource.csv"), "timestamp,cpu_user,cpu_nice,cpu_system,cpu_idle,cpu_iowait,cpu_irq,cpu_softirq,cpu_steal\n1,1,1,1,1,1,1,1,1\n");
    fs.writeFileSync(path.join(directory, "service-resource.csv"), "timestamp\n1\n");
    fs.mkdirSync(path.join(directory, "service"));
    fs.writeFileSync(path.join(directory, "service", "service.log"), "Server listening on port 8085\nSubscribed to the inbox container location: inbox-x\nSubscribed to the inbox container location: inbox-y\nSubscribed to the inbox container location: inbox-z\n");
    for (let client = 0; client < 2; client += 1) {
        const prefix = path.join(directory, `client-${client}`);
        const role = client === 0 ? "cold" : "join";
        const latency = client === 0 ? "cold_registration_to_first_result" : "join_registration_to_first_result";
        fs.writeFileSync(`${prefix}-operations.csv`, `client_id,query_id,operation,window_id,duration_ms,start_monotonic_ns,end_monotonic_ns,client_role\n${client},q,stream_discovery,,,1,2,${role}\n${client},q,stream_subscription,,,2,3,${role}\n${client},q,parsing_timestamp_extraction,,,3,4,${role}\n${client},q,rsp_insertion,/w1: local,,4,5,${role}\n${client},q,r2r_first_result,/w1: local,,5,6,${role}\n${client},q,${latency},,1,1,2,${role}\n`);
        fs.writeFileSync(`${prefix}-results.csv`, "result_id,result_epoch_ms,result_monotonic_ns\n0,11,2\n");
        fs.writeFileSync(`${prefix}-resource.csv`, "timestamp\n1\n");
        fs.writeFileSync(`${prefix}-out-of-order.csv`, "event\n");
        fs.writeFileSync(`${prefix}-ready.json`, "{}\n");
        fs.writeFileSync(`${prefix}-first-result.ready`, "ok\n");
        fs.writeFileSync(`${prefix}-registration.json`, JSON.stringify({ registration_monotonic_ns: 1 }));
        fs.writeFileSync(`${prefix}-first-result.json`, JSON.stringify({ client_role: role, result_epoch_ms: 11, result_monotonic_ns: 2 }));
    }
    ["staged-client-0-launch.json", "staged-client-0-ready.json", "staged-reuse-clients-launch.json", "staged-reuse-clients-ready.json", "staged-reuse-validation-complete.json", "staged-all-clients-ready.json", "staged-replay-start.json"].forEach((marker, index) => fs.writeFileSync(path.join(directory, marker), JSON.stringify(index === 0 ? { launched_epoch_ms: 1 } : index === 2 ? { client_ids: [1], launched_epoch_ms: 3 } : { phase: marker, epoch_ms: index + 1 }) + "\n"));
}

async function main(): Promise<void> {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "experiment-hardening-"));
    const raw = new RawInstrumentation(directory, { runId: "test", approach: "without-aggregator", clientId: "0", queryId: "q" });
    raw.markReady("test boundary");
    raw.observeFirstResult();
    await raw.close();
    assert.ok(fs.existsSync(path.join(directory, "client-0-ready.json")), "one atomic marker is emitted per client");
    assert.strictEqual(fs.readdirSync(directory).filter(name => /-ready\.json$/.test(name)).length, 1);
    assert.strictEqual((fs.readFileSync(path.join(directory, "client-0-operations.csv"), "utf8").match(/registration_to_first_result/g) || []).length, 1);
    const stagedRaw = new RawInstrumentation(directory, { runId: "test-staged", approach: "heimdall", clientId: "1", queryId: "q" });
    stagedRaw.markRegistrationIssued("reuse"); stagedRaw.markReady("query_ready"); const stagedFirst = stagedRaw.observeFirstResult({ resultId: "result-1", windowId: "w1" }); await stagedRaw.close();
    assert.strictEqual(stagedFirst.latencyOperation, "reuse_registration_to_first_result");
    assert.match(fs.readFileSync(path.join(directory, "client-1-operations.csv"), "utf8"), /reuse_registration_to_first_result/);
    const cpu = parseProcStat("cpu  1 2 3 4 5 6 7 8 0 0\n");
    assert.deepStrictEqual(cpu, { user: 1, nice: 2, system: 3, idle: 4, iowait: 5, irq: 6, softirq: 7, steal: 8, total: 36 });
    const resource = path.join(directory, "monitor.csv"); const monitor = monitorCurrentProcess(resource, 5); await monitor.stop();
    assert.ok(fs.readFileSync(resource, "utf8").split("\n").length >= 2, "monitor stop flushes its stream");
    fs.writeFileSync(path.join(directory, "quoted.csv"), 'window_id,operation\n"/w1: a,b",r2r_first_result\n');
    assert.ok(fs.readFileSync(path.join(directory, "quoted.csv"), "utf8").includes('"/w1: a,b"'));
    fs.rmSync(directory, { recursive: true, force: true });
    assert.deepStrictEqual(resolveClientIndices(5, ["node", "launcher"]), [0, 1, 2, 3, 4]);
    assert.deepStrictEqual(resolveClientIndices(5, ["node", "launcher", "--client-ids", "0,2,4"]), [0, 2, 4]);
    assert.throws(() => resolveClientIndices(5, ["node", "launcher", "--client-ids", "1,1"]), /unique/);
    const runnerSource = fs.readFileSync(path.resolve(__dirname, "../src/experiments/orchestration/run-experiment.sh"), "utf8");
    const captureStart = runnerSource.indexOf("capture_network_snapshots() {");
    const captureEnd = runnerSource.indexOf("\n}\nprint_plan()", captureStart);
    assert.ok(captureStart >= 0 && captureEnd > captureStart, "capture_network_snapshots function is present");
    const captureFunction = runnerSource.slice(captureStart, captureEnd + 2);
    const networkStart = runnerSource.indexOf("network_snapshot_command() {");
    const networkEnd = runnerSource.indexOf("\ncapture_network_snapshots()", networkStart);
    assert.ok(networkStart >= 0 && networkEnd > networkStart, "network_snapshot_command function is present");
    const networkFunction = runnerSource.slice(networkStart, networkEnd);
    const networkInterfaceStart = runnerSource.indexOf("network_interface_command() {");
    const networkInterfaceEnd = runnerSource.indexOf("\n}\nnetwork_snapshot_command()", networkInterfaceStart);
    assert.ok(networkInterfaceStart >= 0 && networkInterfaceEnd > networkInterfaceStart, "network_interface_command function is present");
    const networkInterfaceFunction = runnerSource.slice(networkInterfaceStart, networkInterfaceEnd + 2);
    const snapshotHarness = execFileSync("bash", ["-c", `
set -euo pipefail
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
iteration_dir=iteration-01
mkdir -p "$root/$iteration_dir"
client_host=client
pod_host=pod
replayer_host=replayer
service_host=none
network_snapshot_base=.evaluation-network
run_id=local-test
shell_quote() { printf "'%s'" "$1"; }
stub_dir="$root/stubs"
mkdir "$stub_dir"
ip_calls="$root/ip-calls"
getent_calls="$root/getent-calls"
cat > "$stub_dir/ip" <<'EOF'
#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$IP_CALLS"
case "$3" in
  route-host.example) exit 1 ;;
  198.51.100.10|198.51.100.11) printf '%s dev eth-test src 192.0.2.1\\n' "$3" ;;
  *) exit 1 ;;
esac
EOF
cat > "$stub_dir/getent" <<'EOF'
#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$GETENT_CALLS"
case "$2" in route-host.example) printf '198.51.100.10 STREAM route-host.example\\n' ;; unresolved-host.example) ;; *) exit 1 ;; esac
EOF
chmod +x "$stub_dir/ip" "$stub_dir/getent"
PATH="$stub_dir:$PATH"
export PATH IP_CALLS="$ip_calls" GETENT_CALLS="$getent_calls"
${networkInterfaceFunction}
${networkFunction}
network_interface=$(network_interface_command)
resolve_interface() { target="$1" override="$2"; eval "$network_interface"; printf '%s' "$interface"; }
test "$(resolve_interface route-host.example '')" = eth-test
test "$(sed -n '1p' "$ip_calls")" = "route get route-host.example"
test "$(sed -n '2p' "$ip_calls")" = "route get 198.51.100.10"
test "$(cat "$getent_calls")" = "ahostsv4 route-host.example"
: > "$ip_calls"; : > "$getent_calls"
test "$(resolve_interface 198.51.100.11 '')" = eth-test
test "$(cat "$ip_calls")" = "route get 198.51.100.11
route get 198.51.100.11"
test ! -s "$getent_calls"
: > "$ip_calls"; : > "$getent_calls"
if (resolve_interface unresolved-host.example '') >"$root/unresolved.out" 2>&1; then exit 1; fi
grep -F "network snapshot: unable to resolve unresolved-host.example" "$root/unresolved.out" >/dev/null
test "$(cat "$ip_calls")" = "route get unresolved-host.example"
test "$(cat "$getent_calls")" = "ahostsv4 unresolved-host.example"
: > "$ip_calls"; : > "$getent_calls"
test "$(resolve_interface ignored-host.example override-test)" = override-test
test ! -s "$ip_calls"
test ! -s "$getent_calls"
EXPERIMENT_NETWORK_INTERFACE_SOLID=eth-test
network_command=$(network_snapshot_command solid target start iteration-01)
case "$network_command" in *"override='eth-test'"*) ;; *) exit 1 ;; esac
network_snapshot_command() { printf ':'; }
experiment_ssh() { printf '%s\\n' "$1" >> "$root/calls"; }
${captureFunction}
capture_network_snapshots start iteration-01
test "$(wc -l < "$root/calls")" -eq 3
`, "snapshot-harness"], { cwd: path.resolve(__dirname, "..") }).toString();
    assert.strictEqual(snapshotHarness, "", "capture_network_snapshots executes locally with its snapshot arrays");
    const remoteHelper = (name: string, nextName: string): string => {
        const start = runnerSource.indexOf(`${name}() {`);
        const end = runnerSource.indexOf(`\n}\n${nextName}()`, start);
        assert.ok(start >= 0 && end > start, `${name} function is present`);
        return runnerSource.slice(start, end + 2);
    };
    const markerCommandFunctions = [
        remoteHelper("all_client_ready_markers_command", "late_client_ready_markers_command"),
        remoteHelper("all_client_first_result_markers_ready_command", "all_client_ready_markers_command"),
        remoteHelper("late_client_ready_markers_command", "late_client_first_result_markers_ready_command"),
        remoteHelper("late_client_first_result_markers_ready_command", "staged_phase_marker_command"),
        remoteHelper("without_aggregator_first_result_ready_command", "all_client_first_result_markers_ready_command"),
        remoteHelper("staged_no_client_results_command", "staged_no_service_result_command"),
        remoteHelper("staged_no_service_result_command", "print_plan")
    ].join("\n");
    const remoteHelperHarness = execFileSync("bash", ["-c", `
set -euo pipefail
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
evaluation_path="$root"
client_count=2
shell_quote() { printf "'%s'" "$1"; }
remote_path_expression() { printf "'%s'" "$1"; }
${markerCommandFunctions}
mkdir -p "$root/iteration-01"
printf x > "$root/iteration-01/client-0-ready.json"
printf x > "$root/iteration-01/client-1-ready.json"
ready_command=$(all_client_ready_markers_command iteration-01)
first_command=$(all_client_first_result_markers_ready_command iteration-01)
late_ready_command=$(late_client_ready_markers_command iteration-01)
late_first_command=$(late_client_first_result_markers_ready_command iteration-01)
no_result_command=$(staged_no_client_results_command iteration-01)
without_command=$(without_aggregator_first_result_ready_command iteration-01)
no_service_result_command=$(staged_no_service_result_command "$root/iteration-01/window-processing.csv")
for command in "$ready_command" "$first_command" "$late_ready_command" "$late_first_command" "$no_result_command" "$without_command"; do
  case "$command" in *'\\$iteration_dir'*|*'\\$marker'*|*'\\$client_id'*) exit 1 ;; esac
done
bash -c "$ready_command" || { echo "ready helper failed: $ready_command" >&2; exit 1; }
rm "$root/iteration-01/client-1-ready.json"
if bash -c "$ready_command"; then exit 1; fi
printf x > "$root/iteration-01/client-1-ready.json"
if bash -c "$first_command"; then exit 1; fi
bash -c "$late_ready_command" || { echo "late ready helper failed: $late_ready_command" >&2; exit 1; }
if bash -c "$late_first_command"; then exit 1; fi
bash -c "$no_result_command" || { echo "no-result helper failed: $no_result_command" >&2; exit 1; }
printf x > "$root/iteration-01/client-0-first-result.ready"
printf x > "$root/iteration-01/client-1-first-result.ready"
bash -c "$first_command" || { echo "first-result helper failed: $first_command" >&2; exit 1; }
bash -c "$late_first_command" || { echo "late first-result helper failed: $late_first_command" >&2; exit 1; }
if bash -c "$no_result_command"; then exit 1; fi
printf 'operation\\n' > "$root/iteration-01/client-0-operations.csv"
printf 'r2r_first_result\\n' >> "$root/iteration-01/client-0-operations.csv"
bash -c "$without_command" || { echo "without-aggregator helper failed: $without_command" >&2; exit 1; }
bash -c "$no_service_result_command" || { echo "absent processing.csv should pass: $no_service_result_command" >&2; exit 1; }
printf 'operation\\nwindow_query_processing\\n' > "$root/iteration-01/window-processing.csv"
bash -c "$no_service_result_command" || { echo "processing.csv without r2r_first_result should pass: $no_service_result_command" >&2; exit 1; }
printf 'r2r_first_result\\n' >> "$root/iteration-01/window-processing.csv"
if bash -c "$no_service_result_command"; then echo "processing.csv with r2r_first_result should fail: $no_service_result_command" >&2; exit 1; fi
`, "remote-helper-harness"], { cwd: path.resolve(__dirname, "..") }).toString();
    assert.strictEqual(remoteHelperHarness, "", "generated remote marker helpers expand variables and execute locally");
    const stagedStart = runnerSource.indexOf('  if [[ "$client_arrival_mode" == "staged-reuse" ]]', runnerSource.indexOf('client_phase_b_ssh_pid=""'));
    const stagedBranch = runnerSource.slice(stagedStart, runnerSource.indexOf("\n  else\n", stagedStart));
    const sourceOrder = (text: string, token: string): number => { const index = text.indexOf(token); assert.ok(index >= 0, `staged runner contains ${token}`); return index; };
    assert.ok(sourceOrder(stagedBranch, "staged-client-0-launch.json") < sourceOrder(stagedBranch, "client 0 confirmed-ready marker"));
    assert.ok(sourceOrder(stagedBranch, "client 0 confirmed-ready marker") < sourceOrder(stagedBranch, "staged-reuse-clients-launch.json"));
    assert.ok(sourceOrder(stagedBranch, "staged-reuse-clients-launch.json") < sourceOrder(stagedBranch, "all clients confirmed-ready markers"));
    assert.ok(sourceOrder(stagedBranch, "all clients confirmed-ready markers") < sourceOrder(stagedBranch, "staged-reuse-validation-complete.json"));
    assert.ok(sourceOrder(stagedBranch, "staged-reuse-validation-complete.json") < sourceOrder(stagedBranch, "staged-replay-start.json"));
    assert.ok(sourceOrder(stagedBranch, "staged-replay-start.json") < sourceOrder(stagedBranch, 'experiment_ssh "$replayer_host" "$replayer_launch_command"'));
    assert.ok(!stagedBranch.includes("client 0 first genuine result marker"), "staged reuse does not wait for client 0's result before joining");
    assert.match(stagedBranch, /staged_no_client_results_command/);
    assert.match(fs.readFileSync(path.resolve(__dirname, "../src/experiments/clients/heimdall/client.ts"), "utf8"), /stagedReuse && !replayStarted\(\)/);
    assert.match(fs.readFileSync(path.resolve(__dirname, "../src/experiments/clients/notification-aggregator/client.ts"), "utf8"), /stagedArrival && !replayStarted\(\)/);
    assert.match(runnerSource, /local override_name\n  override_name="EXPERIMENT_NETWORK_INTERFACE_\$\(printf '%s' "\$role" \| tr '\[:lower:\]' '\[:upper:\]'\)"\n  local override="\$\{!override_name:-\}"/);
    const clientLaunchFunction = runnerSource.slice(runnerSource.indexOf("client_launch_command() {"), runnerSource.indexOf("\n}\n\nreplayer_runtime_root"));
    const serviceLaunchFunction = runnerSource.slice(runnerSource.indexOf("service_launch_command() {"), runnerSource.indexOf("\n}\nservice_monitor_command"));
    assert.doesNotMatch(clientLaunchFunction, /\\\$/);
    assert.doesNotMatch(serviceLaunchFunction, /\\\$/);
    const simultaneousStart = runnerSource.indexOf("\n  else\n", stagedStart);
    const simultaneousEnd = runnerSource.indexOf('\n  fi\n  wait "$replayer_pid"', simultaneousStart);
    const simultaneousBranch = runnerSource.slice(simultaneousStart, simultaneousEnd);
    assert.ok(sourceOrder(simultaneousBranch, "all client confirmed-ready markers") < sourceOrder(simultaneousBranch, 'capture_network_snapshots start'));
    assert.ok(sourceOrder(simultaneousBranch, 'capture_network_snapshots start') < sourceOrder(simultaneousBranch, 'experiment_ssh "$replayer_host" "$replayer_launch_command"'));
    assert.match(runnerSource, /without_aggregator_first_result_ready_command/);
    const validationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-reuse-")); writeHeimdallFixture(validationDirectory, 1); assert.deepStrictEqual(validateMultiClientRepetition(validationDirectory, "heimdall", 2), { valid: true, errors: [] }, "one creation and one reuse passes"); fs.rmSync(validationDirectory, { recursive: true, force: true });
    const duplicateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-duplicate-")); writeHeimdallFixture(duplicateDirectory, 2); assert.ok(!validateMultiClientRepetition(duplicateDirectory, "heimdall", 2).valid, "two shared creations fail"); fs.rmSync(duplicateDirectory, { recursive: true, force: true });
    const mismatchDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-mismatch-")); writeHeimdallFixture(mismatchDirectory, 1, [undefined as unknown as string, "wrong"]); assert.ok(!validateMultiClientRepetition(mismatchDirectory, "heimdall", 2).valid, "a mismatching client hash fails"); fs.rmSync(mismatchDirectory, { recursive: true, force: true });
    const stagedDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-staged-")); writeHeimdallFixture(stagedDirectory, 1, undefined, true); assert.deepStrictEqual(validateMultiClientRepetition(stagedDirectory, "heimdall", 2), { valid: true, errors: [] }, "staged cold/reuse evidence passes"); fs.rmSync(stagedDirectory, { recursive: true, force: true });
    const preReplayResultDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-staged-pre-replay-result-")); writeHeimdallFixture(preReplayResultDirectory, 1, undefined, true); fs.writeFileSync(path.join(preReplayResultDirectory, "client-1-first-result.json"), JSON.stringify({ client_role: "reuse", result_epoch_ms: 6, result_monotonic_ns: 2 })); assert.ok(!validateMultiClientRepetition(preReplayResultDirectory, "heimdall", 2).valid, "pre-replay first results are rejected"); fs.rmSync(preReplayResultDirectory, { recursive: true, force: true });
    const stagedSingleDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-staged-single-")); writeHeimdallFixture(stagedSingleDirectory, 1, undefined, true, 1); assert.deepStrictEqual(validateMultiClientRepetition(stagedSingleDirectory, "heimdall", 1), { valid: true, errors: [] }, "staged N=1 creation/no-reuse evidence passes"); fs.rmSync(stagedSingleDirectory, { recursive: true, force: true });
    const notificationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "notification-staged-")); writeNotificationStagedFixture(notificationDirectory); assert.deepStrictEqual(validateMultiClientRepetition(notificationDirectory, "notification-aggregator", 2), { valid: true, errors: [] }, "staged notification join evidence passes"); fs.rmSync(notificationDirectory, { recursive: true, force: true });
}
main().then(() => console.log("experiment hardening tests passed"));
