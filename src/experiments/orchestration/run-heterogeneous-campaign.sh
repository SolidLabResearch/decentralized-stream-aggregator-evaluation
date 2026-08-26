#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 [--dry-run]" >&2; }
mode="${1:-}"; case "$mode" in ""|--dry-run) ;; *) usage; exit 2;; esac
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workloads=("same-query-same-data 0" "different-query-same-data 0" "different-query-same-data 1" "different-query-same-data 2" "different-query-different-data 0" "different-query-different-data 1" "different-query-different-data 2")
approaches=(heimdall notification-aggregator without-aggregator)
cells=()
for workload in "${workloads[@]}"; do for approach in "${approaches[@]}"; do cells+=("$approach $workload"); done; done

if [[ "$mode" == "--dry-run" ]]; then printf 'approach,workload,workload_instance,repetition\n'; fi
log_root="$root/results/4hz/heterogeneous/campaign-logs"; attempts="$log_root/attempts.csv"
if [[ "$mode" != "--dry-run" ]]; then mkdir -p "$log_root"; [[ -f "$attempts" ]] || printf 'run_id,repetition,workload,approach,workload_instance,status\n' > "$attempts"; fi

for repetition in $(seq -w 1 35); do
  # Rotate scheduling order only. Each approach/workload keeps its own full r01-r35 block.
  offset=$(((10#$repetition - 1) % ${#cells[@]}))
  for index in "${!cells[@]}"; do
    read -r approach workload instance <<<"${cells[$(((index + offset) % ${#cells[@]}))]}"
    if [[ "$mode" == "--dry-run" ]]; then printf '%s,%s,%s,%s\n' "$approach" "$workload" "$instance" "$repetition"; continue; fi
    case "$workload" in same-query-same-data) slug=samesame;; different-query-same-data) slug=diffsame;; different-query-different-data) slug=diffdiff;; esac
    run_id="hetero-${slug}-${approach}-i${instance}-n1-r$repetition-$(date -u +%Y%m%dT%H%M%SZ)"
    if EXPERIMENT_RUN_ID="$run_id" "$root/src/experiments/orchestration/run-heterogeneous-experiment.sh" "$approach" "$workload" "$instance"; then status=valid; else status=invalid; fi
    printf '%s,%s,%s,%s,%s,%s\n' "$run_id" "$repetition" "$workload" "$approach" "$instance" "$status" >> "$attempts"
  done
done
