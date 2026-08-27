#!/usr/bin/env bash
# Attempt-scoped cleanup for saturation client launchers.  This script only
# recognises processes carrying both saturation markers added by the launcher.
set -euo pipefail

usage() { echo "Usage: $0 {preflight|cleanup|snapshot} --checkout PATH --state-dir PATH [--attempt-id ID] [--marker PATH] [--output PATH]" >&2; }
action="${1:-}"; shift || true
checkout=""; state_dir=""; attempt_id=""; marker=""; output=""
while (( $# )); do
  case "$1" in
    --checkout|--state-dir|--attempt-id|--marker|--output)
      (( $# >= 2 )) || { usage; exit 2; }
      case "$1" in
        --checkout) checkout="$2" ;; --state-dir) state_dir="$2" ;; --attempt-id) attempt_id="$2" ;; --marker) marker="$2" ;; --output) output="$2" ;;
      esac
      shift 2 ;;
    *) usage; exit 2 ;;
  esac
done
[[ "$action" == preflight || "$action" == cleanup || "$action" == snapshot ]] || { usage; exit 2; }
[[ -n "$checkout" && -n "$state_dir" ]] || { usage; exit 2; }
[[ "$action" != cleanup || ( -n "$attempt_id" && -n "$marker" ) ]] || { usage; exit 2; }

is_saturation_process() {
  local args="$1" required_attempt="${2:-}"
  [[ "$args" == *"--saturation-evaluation-checkout=$checkout"* ]] || return 1
  [[ "$args" == *"$checkout/src/experiments/clients/heimdall/launcher.ts"* || "$args" == *"$checkout/src/experiments/clients/heimdall/client.ts"* ]] || return 1
  [[ -z "$required_attempt" || "$args" == *"--saturation-attempt-id=$required_attempt"* ]]
}
is_legacy_saturation_launcher() {
  local args="$1"
  [[ "$args" == *"$checkout/src/experiments/clients/heimdall/launcher.ts"* && "$args" == *"--output-dir"*"results/4hz/heimdall-saturation/"* ]]
}
is_legacy_group_member() {
  local args="$1"
  [[ "$args" == *"$checkout/src/experiments/clients/heimdall/launcher.ts"* || "$args" == *"$checkout/src/experiments/clients/heimdall/client.ts"* ]]
}

records() { ps -eo pid=,pgid=,stat=,args=; }
matching_groups() {
  local required_attempt="${1:-}" pid pgid stat args
  while read -r pid pgid stat args; do
    [[ "$stat" == Z* ]] && continue
    if is_saturation_process "$args" "$required_attempt" || { [[ -z "$required_attempt" ]] && is_legacy_saturation_launcher "$args"; }; then printf '%s\n' "$pgid"; fi
  done < <(records) | sort -un
}
matching_count() {
  local kind="$1" required_attempt="${2:-}" pid pgid stat args count=0
  while read -r pid pgid stat args; do
    [[ "$stat" == Z* ]] && continue
    if is_saturation_process "$args" "$required_attempt" && [[ "$args" == *"/$kind.ts"* ]]; then count=$((count + 1)); fi
  done < <(records)
  printf '%s\n' "$count"
}
group_is_owned() {
  local target="$1" required_attempt="${2:-}" pid pgid stat args found=false legacy=false
  if [[ -z "$required_attempt" ]]; then
    while read -r pid pgid stat args; do [[ "$pgid" == "$target" && "$stat" != Z* ]] || continue; is_legacy_saturation_launcher "$args" && legacy=true; done < <(records)
  fi
  while read -r pid pgid stat args; do
    [[ "$pgid" == "$target" && "$stat" != Z* ]] || continue
    found=true
    is_saturation_process "$args" "$required_attempt" || { [[ "$legacy" == true ]] && is_legacy_group_member "$args"; } || return 1
  done < <(records)
  [[ "$found" == true ]]
}
terminate_group() {
  local pgid="$1" required_attempt="${2:-}" phase="$3"
  if ! group_is_owned "$pgid" "$required_attempt"; then
    echo "SATURATION_CLIENT_CLEANUP=FAIL unsafe_or_missing_process_group=$pgid phase=$phase" >&2
    return 1
  fi
  kill -TERM -- "-$pgid" 2>/dev/null || true
  for _ in 1 2 3 4 5; do group_is_owned "$pgid" "$required_attempt" || return 0; sleep 1; done
  if group_is_owned "$pgid" "$required_attempt"; then kill -KILL -- "-$pgid" 2>/dev/null || true; fi
  for _ in 1 2 3 4 5; do group_is_owned "$pgid" "$required_attempt" || return 0; sleep 1; done
  echo "SATURATION_CLIENT_CLEANUP=FAIL process_group_survived=$pgid phase=$phase" >&2
  return 1
}
report() {
  local required_attempt="${1:-}" launchers clients
  launchers="$(matching_count launcher "$required_attempt")"; clients="$(matching_count client "$required_attempt")"
  echo "remaining_launcher_processes=$launchers"
  echo "remaining_client_processes=$clients"
  [[ "$launchers" == 0 && "$clients" == 0 ]]
}
snapshot() {
  local target="${output:?--output is required for snapshot}" available swap_total swap_free matching
  available="$(awk '/^MemAvailable:/ { print $2 * 1024 }' /proc/meminfo 2>/dev/null || true)"
  swap_total="$(awk '/^SwapTotal:/ { print $2 * 1024 }' /proc/meminfo 2>/dev/null || true)"
  swap_free="$(awk '/^SwapFree:/ { print $2 * 1024 }' /proc/meminfo 2>/dev/null || true)"
  matching="$(( $(matching_count launcher) + $(matching_count client) ))"
  mkdir -p "$(dirname "$target")"
  {
    echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "load_average=$(cut -d ' ' -f 1-3 /proc/loadavg 2>/dev/null || uptime)"
    echo "process_count=$(ps -e -o pid= | wc -l | tr -d ' ')"
    echo "mem_available_bytes=${available:-unknown}"
    echo "swap_total_bytes=${swap_total:-unknown}"
    echo "swap_used_bytes=$(( ${swap_total:-0} - ${swap_free:-0} ))"
    echo "matching_saturation_client_processes=$matching"
  } > "$target"
}

case "$action" in
  snapshot) snapshot ;;
  preflight)
    mkdir -p "$state_dir"
    while read -r pgid; do terminate_group "$pgid" "" preflight || exit 1; done < <(matching_groups)
    find "$state_dir" -maxdepth 1 -type f \( -name '*.pgid' -o -name '*.pid' \) -delete
    if report; then echo "SATURATION_CLIENT_CLEANUP=PASS"; else echo "SATURATION_CLIENT_CLEANUP=FAIL" >&2; exit 1; fi ;;
  cleanup)
    [[ -f "$marker" ]] && marker_pgid="$(tr -d '[:space:]' < "$marker")" || marker_pgid=""
    case "$marker_pgid" in ''|*[!0-9]*) ;; *) terminate_group "$marker_pgid" "$attempt_id" post || exit 1 ;; esac
    while read -r pgid; do terminate_group "$pgid" "$attempt_id" post || exit 1; done < <(matching_groups "$attempt_id")
    if report "$attempt_id"; then rm -f "$marker"; echo "SATURATION_CLIENT_CLEANUP=PASS"; else echo "SATURATION_CLIENT_CLEANUP=FAIL" >&2; exit 1; fi ;;
esac
