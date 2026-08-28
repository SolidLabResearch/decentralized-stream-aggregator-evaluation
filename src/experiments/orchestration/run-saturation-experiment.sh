#!/usr/bin/env bash
# E4 bounded query-reuse scaling wrapper around the proven lifecycle.
set -euo pipefail
usage() { echo "Usage: $0 {maximum-reuse|no-reuse} N {--dry-run|--preflight|--run}" >&2; }
mode="${1:-}"; n="${2:-}"; phase="${3:---dry-run}"
[[ "$mode" == maximum-reuse || "$mode" == no-reuse ]] || { usage; exit 2; }; [[ "$n" =~ ^[1-9][0-9]*$ ]] || { usage; exit 2; }; [[ "$phase" == --dry-run || "$phase" == --preflight || "$phase" == --run ]] || { usage; exit 2; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; config="${E4_CONFIG_PATH:-$root/src/experiments/config/experiment-config.n079.saturation.json}"; [[ -f "$config" ]] || { echo "Missing E4 config: $config" >&2; exit 2; }; if grep -Eq 'REPLACE_ME|<[^>]+ is required>|localhost:0|example\.invalid' "$config"; then echo "E4 configuration contains unresolved placeholder hosts, URLs, or commands: $config" >&2; exit 2; fi
# E4 is pinned to the observed successful n078 distinct-query component
# deployment. The evaluation checkout is deliberately supplied by the private
# deployment environment: it must name the immutable commit containing this
# modern E4 infrastructure, never the historical b905 provenance checkout.
EVALUATION_REPOSITORY_SHA_EXPECTED="${EVALUATION_REPOSITORY_SHA_EXPECTED:-$(git -C "$root" rev-parse HEAD)}"
HEIMDALL_REPOSITORY_SHA_EXPECTED="${HEIMDALL_REPOSITORY_SHA_EXPECTED:-e996c2b041c4fbbd206bd3ec8035d7f349cc31eb}"
RSP_JS_SHA_EXPECTED="${RSP_JS_SHA_EXPECTED:-56e773d8416f978d82a8288802532cabdf8ffef6}"
REPLAYER_REPOSITORY_SHA_EXPECTED="${REPLAYER_REPOSITORY_SHA_EXPECTED:-a1a2100ea64870da086ec64be1914141eca0fb93}"
export EVALUATION_REPOSITORY_SHA_EXPECTED HEIMDALL_REPOSITORY_SHA_EXPECTED RSP_JS_SHA_EXPECTED REPLAYER_REPOSITORY_SHA_EXPECTED
legacy_mode=same-query; [[ "$mode" == no-reuse ]] && legacy_mode=distinct-query
run_id="${E4_RUN_ID:-e4-${mode}-n${n}-$(date -u +%Y%m%dT%H%M%SZ)}"; attempt="${E4_ATTEMPT_DIR:-$root/results/4hz/e4-heimdall-reuse-scaling/$mode/n$n/$run_id}"
echo "E4 bounded reuse-scaling attempt=$attempt mode=$mode n=$n phase=$phase repetition=${E4_REPETITION:-1}"
echo "planned: run-heimdall-saturation-experiment.sh $legacy_mode $n <phase>"
[[ "$phase" == --dry-run ]] && exit 0
source "$root/src/experiments/orchestration/ssh-helper.sh"
cfg="$(node -e 'const c=require(process.argv[1]); process.stdout.write(JSON.stringify(c))' "$config")"
cfgv() { node -e 'const c=JSON.parse(process.argv[1]); let v=c; for(const k of process.argv[2].split(".")) v=v[k]; process.stdout.write(String(v??""))' "$cfg" "$1"; }
SSH_USER="$(cfgv ssh.user)"; SSH_BASTION="$(cfgv ssh.bastion)"; SSH_IDENTITY_FILE="$(cfgv ssh.identityFile)"; SSH_CONNECT_TIMEOUT_SECONDS="$(cfgv ssh.connectTimeoutSeconds)"; experiment_ssh_args
shell_quote() { if [[ "$1" == '~/'* ]]; then printf '"$HOME"/%s' "${1#~/}"; else printf "'%s'" "${1//\'/\'\\\'\'}"; fi; }
evaluation_remote="$(cfgv remotePaths.evaluation)"
watchdog_script="$evaluation_remote/src/experiments/orchestration/saturation-watchdog.sh"; watchdog_root="$evaluation_remote/.evaluation-runtime/e4-watchdogs/$run_id"; watchdog_roles=(heimdall client solid replayer); watchdog_hosts=("$(cfgv hosts.heimdall)" "$(cfgv hosts.client)" "$(cfgv hosts.solidPod)" "$(cfgv hosts.replayer)"); watchdog_outputs=("$(cfgv remotePaths.heimdall)/.evaluation-results/$run_id/iteration-01/watchdog.csv" "$watchdog_root/client.csv" "/tmp/e4-watchdog-$run_id-solid.csv" "$(cfgv remotePaths.replayer)/.evaluation-runtime/$run_id/watchdog.csv"); watchdog_triggers=("$(cfgv remotePaths.heimdall)/.evaluation-results/$run_id/iteration-01/e4-safety-trigger" "$watchdog_root/client.trigger" "/tmp/e4-watchdog-$run_id-solid.trigger" "$(cfgv remotePaths.replayer)/.evaluation-runtime/$run_id/e4-safety-trigger"); watchdog_pids=("$(cfgv remotePaths.heimdall)/.evaluation-results/$run_id/iteration-01/watchdog.pid" "$watchdog_root/client.pid" "/tmp/e4-watchdog-$run_id-solid.pid" "$(cfgv remotePaths.replayer)/.evaluation-runtime/$run_id/watchdog.pid"); watchdog_pid_files=("$(cfgv remotePaths.heimdall)/.evaluation-results/$run_id/heimdall.pid" "$evaluation_remote/.evaluation-runtime/saturation-client-attempts/$run_id-iteration-01.pgid" "" "$(cfgv remotePaths.replayer)/.evaluation-runtime/$run_id/replayer.pid"); watchdog_started=false; watchdog_ssh_failures=0
notification_script="$evaluation_remote/src/experiments/orchestration/e4-notification-state.sh"; notification_root="$evaluation_remote/.evaluation-runtime/e4-notification-state/$run_id"; notification_before_remote="$notification_root/before.json"; notification_after_remote="$notification_root/after.json"
watchdog_start() { local i="$1" health="$2" args="--output $(shell_quote "${watchdog_outputs[$i]}") --trigger $(shell_quote "${watchdog_triggers[$i]}") --host-role $(shell_quote "${watchdog_roles[$i]}") --interval $(shell_quote "${E4_WATCHDOG_INTERVAL_SECONDS:-1}") --consecutive $(shell_quote "${E4_WATCHDOG_CONSECUTIVE_SAMPLES:-3}")"; [[ -n "${watchdog_pid_files[$i]}" ]] && args+=" --pid-file $(shell_quote "${watchdog_pid_files[$i]}")"; [[ -n "$health" ]] && args+=" --health-command $(shell_quote "$health")"; experiment_ssh "${watchdog_hosts[$i]}" "mkdir -p $(shell_quote "$(dirname "${watchdog_outputs[$i]}")") $(shell_quote "$(dirname "${watchdog_pids[$i]}")"); setsid bash $(shell_quote "$watchdog_script") $args > $(shell_quote "${watchdog_outputs[$i]}.log") 2>&1 & watcher_pid=\$!; printf '%s\\n' \"\$watcher_pid\" > $(shell_quote "${watchdog_pids[$i]}")"; }
watchdog_stop() { local i; for i in 0 1 2 3; do experiment_ssh "${watchdog_hosts[$i]}" "if test -f $(shell_quote "${watchdog_pids[$i]}"); then pid=\$(cat $(shell_quote "${watchdog_pids[$i]}") 2>/dev/null || true); test -n \"\$pid\" && kill -TERM \"\$pid\" 2>/dev/null || true; rm -f $(shell_quote "${watchdog_pids[$i]}") $(shell_quote "${watchdog_triggers[$i]}"); fi" >/dev/null 2>&1 || true; done; }
watchdog_poll() { local i payload result round_failures=0; for i in 0 1 2 3; do payload="$(experiment_ssh "${watchdog_hosts[$i]}" "test -f $(shell_quote "${watchdog_triggers[$i]}") && cat $(shell_quote "${watchdog_triggers[$i]}")" 2>/dev/null)"; result=$?; if [[ $result -eq 0 && -n "$payload" ]]; then printf '%s\n' "$payload" > "$attempt/iteration-01/e4-safety-trigger.txt"; return 78; elif [[ $result -eq 255 ]]; then round_failures=$((round_failures+1)); fi; done; if (( round_failures == 0 )); then watchdog_ssh_failures=0; else watchdog_ssh_failures=$((watchdog_ssh_failures+1)); fi; if (( watchdog_ssh_failures >= ${E4_SSH_CONSECUTIVE_FAILURES:-3} )); then printf 'host_role=network/ssh\nmetric=ssh_responsive\nvalue=0\nthreshold=1\n' > "$attempt/iteration-01/e4-safety-trigger.txt"; return 78; fi; return 0; }
start_watchdogs() { local health; health="curl --fail --silent --show-error --max-time ${E4_HEALTH_TIMEOUT_SECONDS:-5} --output /dev/null http://127.0.0.1:8080/health"; watchdog_start 0 "$health"; watchdog_start 1 ""; watchdog_start 2 "curl --fail --silent --show-error --max-time ${E4_HEALTH_TIMEOUT_SECONDS:-5} --output /dev/null $(shell_quote "$(cfgv urls.solidPod)")"; watchdog_start 3 ""; watchdog_started=true; }
notification_snapshot() { local phase="$1" output="$2"; experiment_ssh "$(cfgv hosts.solidPod)" "bash $(shell_quote "$notification_script") --phase $(shell_quote "$phase") --output $(shell_quote "$output")"; }
SATURATION_CONFIG_PATH="$config" "$root/src/experiments/orchestration/run-heimdall-saturation-experiment.sh" "$legacy_mode" "$n" --preflight
for i in 0 1 2 3; do experiment_ssh "${watchdog_hosts[$i]}" "test -r $(shell_quote "$watchdog_script") && command -v bash >/dev/null && command -v awk >/dev/null && command -v ps >/dev/null" >/dev/null || { echo "E4 watchdog preflight failed on ${watchdog_roles[$i]} host ${watchdog_hosts[$i]}." >&2; exit 1; }; done
experiment_ssh "$(cfgv hosts.solidPod)" "test -r $(shell_quote "$notification_script") && command -v node >/dev/null" >/dev/null || { echo "E4 notification diagnostic preflight failed on solid host $(cfgv hosts.solidPod)." >&2; exit 1; }
[[ "$phase" == --preflight ]] && exit 0
mkdir -p "$attempt"; printf '{"run_id":"%s","workload_mode":"%s","client_count":%s,"repetition":%s,"phase":"run"}\n' "$run_id" "$mode" "$n" "${E4_REPETITION:-1}" > "$attempt/e4-attempt.json"
mkdir -p "$attempt/iteration-01"; trap watchdog_stop EXIT
if ! notification_snapshot before "$notification_before_remote"; then printf '%s\n' 'before notification snapshot unavailable' > "$attempt/iteration-01/notification-state-error.txt"; fi
start_watchdogs
set +e
runner_output_root="$attempt"; [[ "$runner_output_root" == "$root/"* ]] && runner_output_root="${runner_output_root#"$root/"}"
SATURATION_CONFIG_PATH="$config" EXPERIMENT_RUN_ID="$run_id" EXPERIMENT_OUTPUT_ROOT="$runner_output_root" SATURATION_REPETITION="${E4_REPETITION:-1}" "$root/src/experiments/orchestration/run-heimdall-saturation-experiment.sh" "$legacy_mode" "$n" & runner_pid=$!
safety_triggered=false
while kill -0 "$runner_pid" 2>/dev/null; do watchdog_poll; poll_status=$?; if [[ $poll_status -eq 78 ]]; then safety_triggered=true; kill -TERM "$runner_pid" 2>/dev/null || true; break; fi; sleep "${E4_WATCHDOG_INTERVAL_SECONDS:-1}"; done
wait "$runner_pid"; status=$?; watchdog_stop; mkdir -p "$attempt/iteration-01/watchdog"
for i in 0 1 2 3; do experiment_scp_from "${watchdog_hosts[$i]}" "${watchdog_outputs[$i]}" "$attempt/iteration-01/watchdog/" >/dev/null 2>&1 || true; done
if ! notification_snapshot after "$notification_after_remote"; then printf '%s\n' 'after notification snapshot unavailable' >> "$attempt/iteration-01/notification-state-error.txt"; fi
mkdir -p "$attempt/iteration-01/notification-state"
experiment_scp_from "$(cfgv hosts.solidPod)" "$notification_before_remote" "$attempt/iteration-01/notification-state/" >/dev/null 2>&1 || true
experiment_scp_from "$(cfgv hosts.solidPod)" "$notification_after_remote" "$attempt/iteration-01/notification-state/" >/dev/null 2>&1 || true
if [[ -f "$attempt/iteration-01/notification-state/before.json" && -f "$attempt/iteration-01/notification-state/after.json" ]]; then npx --prefix "$root" ts-node "$root/src/experiments/validation/e4-notification-state.ts" "$attempt/iteration-01/notification-state/before.json" "$attempt/iteration-01/notification-state/after.json" "$attempt/iteration-01/notification-state.json" || printf '%s\n' 'notification comparison unavailable' >> "$attempt/iteration-01/notification-state-error.txt"; fi
set -e
classification=HEALTHY; owner=""; reason="completed"; trigger_metric=""; trigger_value=""; trigger_threshold=""
if [[ "$safety_triggered" == true || -f "$attempt/iteration-01/e4-safety-trigger.txt" ]]; then classification="$(awk -F= '$1=="classification" {print $2}' "$attempt/iteration-01/e4-safety-trigger.txt" | head -1)"; [[ -n "$classification" ]] || classification=SAFETY_STOP; status=78; [[ "$classification" == PROCESS_FAILURE ]] && status=1; owner="$(awk -F= '$1=="host_role" {print $2}' "$attempt/iteration-01/e4-safety-trigger.txt" | head -1)"; trigger_metric="$(awk -F= '$1=="metric" {print $2}' "$attempt/iteration-01/e4-safety-trigger.txt" | head -1)"; trigger_value="$(awk -F= '$1=="value" {print $2}' "$attempt/iteration-01/e4-safety-trigger.txt" | head -1)"; trigger_threshold="$(awk -F= '$1=="threshold" {print $2}' "$attempt/iteration-01/e4-safety-trigger.txt" | head -1)"; reason="watchdog trigger: $classification";
elif [[ $status -eq 124 ]]; then classification=TIMEOUT; reason="measurement or readiness timeout";
elif [[ $status -eq 70 ]]; then classification=ORCHESTRATION_FAILURE; reason="bounded cleanup or lifecycle failure";
elif [[ $status -ne 0 ]]; then classification=PROCESS_FAILURE; reason="E4 runner failed with status $status";
fi
if [[ "$classification" == HEALTHY ]]; then
  if ! npx --prefix "$root" ts-node "$root/src/experiments/validation/saturation.ts" "$attempt" attempt "$n" > "$attempt/validation.json" 2>&1; then classification=INVALID; reason="E4 no-reuse invariant validation failed"; status=65; fi
fi
json_or_null() { [[ -n "$1" ]] && node -p 'JSON.stringify(process.argv[1])' "$1" || printf 'null'; }
printf '{"classification":%s,"boundary_owner":%s,"reason":%s,"client_count":%s,"workload_mode":%s,"trigger_metric":%s,"trigger_value":%s,"trigger_threshold":%s}\n' \
  "$(json_or_null "$classification")" "$(json_or_null "$owner")" "$(json_or_null "$reason")" "$n" "$(json_or_null "$mode")" \
  "$(json_or_null "$trigger_metric")" "$(json_or_null "$trigger_value")" "$(json_or_null "$trigger_threshold")" > "$attempt/classification.json"
exit "$status"
