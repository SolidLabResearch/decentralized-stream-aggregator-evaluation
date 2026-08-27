#!/usr/bin/env bash
set -euo pipefail
usage() { echo "Usage: $0 {--dry-run|--preflight|--smoke|--discover|--confirm N[,N...] REPETITIONS}" >&2; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; runner="$root/src/experiments/orchestration/run-saturation-experiment.sh"; phase="${1:---dry-run}"; shift || true
case "$phase" in --dry-run|--preflight|--smoke|--discover|--confirm) ;; *) usage; exit 2;; esac
counts="${E4_DISCOVERY_COUNTS:-32,64,96,128,192,256,384,512,768,1024,1280,1536,1792,2048}"; [[ "$phase" == --smoke ]] && counts=2,8,32
if [[ "$phase" == --confirm ]]; then counts="${1:-}"; repetitions="${2:-}"; [[ -n "$counts" && "$repetitions" =~ ^[1-9][0-9]*$ ]] || { usage; exit 2; }; else repetitions=1; fi
IFS=, read -ra ns <<< "$counts"; last=0; echo 'phase,workload_mode,client_count,repetition'
for mode in maximum-reuse no-reuse; do for n in "${ns[@]}"; do [[ "$n" =~ ^[1-9][0-9]*$ ]] || exit 2; if [[ $last -gt 0 && "$phase" == --discover && $n -gt $((last * 3 / 2)) ]]; then echo "Refusing N=$n: exceeds 1.5x last HEALTHY N=$last" >&2; exit 2; fi; for ((r=1;r<=repetitions;r++)); do echo "$phase,$mode,$n,$r"; [[ "$phase" == --dry-run || "${E4_PLAN_ONLY:-false}" == true ]] && continue; action=--run; [[ "$phase" == --preflight ]] && action=--preflight; "$runner" "$mode" "$n" "$action" || exit $?; done; if [[ "$phase" == --discover ]]; then last=$n; fi; done; done
