#!/usr/bin/env bash
set -euo pipefail
usage() { echo "Usage: $0 {--dry-run|--preflight|--run}" >&2; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; runner="$root/src/experiments/orchestration/run-saturation-experiment.sh"; phase="${1:---dry-run}"
case "$phase" in --dry-run|--preflight|--run) ;; *) usage; exit 2;; esac
counts="${E4_CLIENT_COUNTS:-1,5,12,15,20}"; repetitions="${E4_REPETITIONS:-1}"; config="${E4_CONFIG_PATH:-$root/src/experiments/config/experiment-config.n079.saturation.json}"
[[ "$repetitions" =~ ^[1-9][0-9]*$ ]] || { echo "E4_REPETITIONS must be a positive integer" >&2; exit 2; }
[[ -f "$config" ]] || { echo "Missing E4 config: $config" >&2; exit 2; }
if grep -Eq 'REPLACE_ME|<[^>]+ is required>|localhost:0|example\.invalid' "$config"; then echo "E4 configuration contains unresolved placeholder hosts, URLs, or commands: $config" >&2; exit 2; fi
campaign_id="${E4_CAMPAIGN_ID:-e4-reuse-scaling-$(date -u +%Y%m%dT%H%M%SZ)}"; campaign_root="$root/results/4hz/e4-heimdall-reuse-scaling/$campaign_id"
IFS=, read -ra ns <<< "$counts"; echo 'phase,workload_mode,client_count,repetition'
for n in "${ns[@]}"; do
  [[ "$n" =~ ^[1-9][0-9]*$ && "$n" -le 20 ]] || { echo "E4 exploratory client counts must be positive integers no greater than 20: $n" >&2; exit 2; }
  for ((r=1;r<=repetitions;r++)); do
    echo "$phase,no-reuse,$n,$r"
    [[ "$phase" == --dry-run || "${E4_PLAN_ONLY:-false}" == true ]] && continue
    if E4_CONFIG_PATH="$config" E4_CAMPAIGN_ID="$campaign_id" E4_ATTEMPT_DIR="$campaign_root/no-reuse/n$n/repetition-$r" E4_RUN_ID="$campaign_id-no-reuse-n$n-r$r" E4_REPETITION="$r" "$runner" no-reuse "$n" "$phase"; then :; else
      status=$?; echo "E4 escalation stopped after no-reuse n=$n repetition=$r status=$status" >&2; exit "$status"
    fi
  done
done
if [[ "$phase" == --run && "${E4_PLAN_ONLY:-false}" != true ]]; then npx --prefix "$root" ts-node src/experiments/validation/e4-campaign-summary.ts "$campaign_root"; fi
