#!/usr/bin/env bash
# E4 wrapper around the hardened E3/legacy setsid lifecycle. Remote execution
# is intentionally opt-in; dry-run/preflight expose every planned operation.
set -euo pipefail
usage() { echo "Usage: $0 {maximum-reuse|no-reuse} N {--dry-run|--preflight|--run}" >&2; }
mode="${1:-}"; n="${2:-}"; phase="${3:---dry-run}"
[[ "$mode" == maximum-reuse || "$mode" == no-reuse ]] || { usage; exit 2; }; [[ "$n" =~ ^[1-9][0-9]*$ ]] || { usage; exit 2; }; [[ "$phase" == --dry-run || "$phase" == --preflight || "$phase" == --run ]] || { usage; exit 2; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; config="${E4_CONFIG_PATH:-$root/src/experiments/config/experiment-config.n079.saturation.json}"; [[ -f "$config" ]] || { echo "Missing E4 config: $config" >&2; exit 2; }
legacy_mode=same-query; [[ "$mode" == no-reuse ]] && legacy_mode=distinct-query
run_id="${E4_RUN_ID:-e4-${mode}-n${n}-$(date -u +%Y%m%dT%H%M%SZ)}"; attempt="$root/results/4hz/e4-heimdall-saturation/$mode/n$n/$run_id"; trigger="$attempt/safety-trigger"; watchdog="$root/src/experiments/orchestration/saturation-watchdog.sh"
echo "E4 attempt=$attempt mode=$mode n=$n phase=$phase"; echo "watchdog interval=${E4_WATCHDOG_INTERVAL_SECONDS:-1}s cpu=${E4_CPU_PERCENT:-90}%/${E4_CPU_CONSECUTIVE_SAMPLES:-5} samples memory=${E4_MIN_AVAILABLE_MEMORY_PERCENT:-20}% fd=${E4_FD_PERCENT:-75}%"
echo "lifecycle: exact recorded PGIDs only; TERM, ${E4_TERMINATION_GRACE_SECONDS:-5}s grace, then KILL survivors; no pkill/killall"
echo "planned: $watchdog --output $attempt/watchdog.csv --trigger $trigger --host-role client --pid-file <attempt-client-pgid>"
echo "planned: run-heimdall-saturation-experiment.sh $legacy_mode $n <phase>"
[[ "$phase" == --dry-run ]] && exit 0
"$root/src/experiments/orchestration/run-heimdall-saturation-experiment.sh" "$legacy_mode" "$n" --preflight
[[ "$phase" == --preflight ]] && exit 0
mkdir -p "$attempt"; printf '{"run_id":"%s","workload_mode":"%s","client_count":%s,"phase":"run"}\n' "$run_id" "$mode" "$n" > "$attempt/metadata.json"
# The watchdog is an independent local process. Real deployments run one on each
# host with that host's exact attempt PID/PGID file; a trigger prevents a later N.
"$root/src/experiments/orchestration/run-heimdall-saturation-experiment.sh" "$legacy_mode" "$n"
status=$?; classification=HEALTHY; reason=completed
[[ $status -ne 0 ]] && { classification=INVALID; reason=workload_or_lifecycle_failure; }
printf '{"classification":"%s","boundary_owner":null,"reason":"%s","client_count":%s,"workload_mode":"%s","trigger_metric":null,"trigger_value":null,"trigger_threshold":null}\n' "$classification" "$reason" "$n" "$mode" > "$attempt/classification.json"
[[ -n "${E4_BACKUP_COMMAND:-}" ]] && { E4_ATTEMPT_DIR="$attempt" bash -c "$E4_BACKUP_COMMAND" || exit 75; }
exit "$status"
