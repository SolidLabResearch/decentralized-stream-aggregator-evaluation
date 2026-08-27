#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
counts="${SATURATION_COUNTS:-1,2,4,8,16,32,64,128}"; repetitions="${SATURATION_REPETITIONS:-3}"; duration="${SATURATION_DURATION_SECONDS:-120}"; action="${1:-}"
case "$action" in ''|--dry-run|--preflight) ;; *) echo "Usage: $0 [--dry-run|--preflight]" >&2; exit 2;; esac
[[ "$repetitions" =~ ^[1-9][0-9]*$ ]] || { echo "SATURATION_REPETITIONS must be positive." >&2; exit 2; }
IFS=',' read -r -a count_values <<< "$counts"
for count in "${count_values[@]}"; do [[ "$count" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid SATURATION_COUNTS entry: $count" >&2; exit 2; }; done
if [[ "$action" == "--dry-run" ]]; then echo "repetition,saturation_mode,client_count,duration_seconds"; fi
for ((rep=1; rep<=repetitions; rep++)); do
  modes=(same-query distinct-query); (( rep % 2 == 0 )) && modes=(distinct-query same-query)
  for mode in "${modes[@]}"; do for count in "${count_values[@]}"; do
    if [[ "$action" == "--dry-run" ]]; then printf '%s,%s,%s,%s\n' "$rep" "$mode" "$count" "$duration"; else
      set +e
      SATURATION_DURATION_SECONDS="$duration" SATURATION_REPETITION="$rep" "$root/src/experiments/orchestration/run-heimdall-saturation-experiment.sh" "$mode" "$count" "$action"
      status=$?
      set -e
      # A cleanup failure means the next count would not be isolated.
      (( status == 70 )) && exit "$status"
    fi
  done; done
done
