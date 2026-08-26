#!/usr/bin/env bash
# Prepare (and optionally start) a replayer copy without changing the frozen checkout.
set -euo pipefail

usage() {
  echo "Usage: $0 <frozen-replayer-checkout> <empty-run-directory> <segment-config.json> [--start]" >&2
}

frozen_checkout="${1:-}"
run_directory="${2:-}"
config_template="${3:-}"
mode="${4:-}"
expected_sha="a1a2100ea64870da086ec64be1914141eca0fb93"
[[ -n "$frozen_checkout" && -n "$run_directory" && -n "$config_template" ]] || { usage; exit 2; }
[[ "$mode" == "" || "$mode" == "--start" ]] || { usage; exit 2; }
[[ -d "$frozen_checkout/.git" ]] || { echo "Frozen replayer checkout is not a Git repository: $frozen_checkout" >&2; exit 2; }
[[ -f "$config_template" ]] || { echo "Segment config does not exist: $config_template" >&2; exit 2; }
[[ ! -e "$run_directory" ]] || { echo "Run directory must not already exist: $run_directory" >&2; exit 2; }

actual_sha="$(git -C "$frozen_checkout" rev-parse HEAD)"
[[ "$actual_sha" == "$expected_sha" ]] || { echo "Frozen replayer SHA must be $expected_sha; found $actual_sha" >&2; exit 2; }
git clone --no-hardlinks "$frozen_checkout" "$run_directory"
git -C "$run_directory" checkout --detach "$expected_sha"

# The available historical source imports this path statically.  Reject a different
# formal revision rather than risking use of its committed historical configuration.
rg -Fq './config/config.json' "$run_directory/src/index.ts" || {
  echo "Formal replayer does not statically import src/config/config.json; inspect its config-loading semantics before deployment." >&2
  exit 2
}
cp "$config_template" "$run_directory/src/config/config.json"
config_sha="$(shasum -a 256 "$config_template" | awk '{print $1}')"
printf '{\n  "frozen_replayer_sha": "%s",\n  "deployment_config_sha256": "%s",\n  "deployment_config_source": "%s"\n}\n' \
  "$expected_sha" "$config_sha" "$config_template" > "$run_directory/replayer-deployment-metadata.json"

(cd "$run_directory" && npm ci && npm run build)
if [[ "$mode" == "--start" ]]; then
  exec bash -c "cd \"$run_directory\" && exec npm run replay"
fi
echo "Prepared run-owned replayer at $run_directory; start it with: (cd '$run_directory' && npm run replay)" >&2
