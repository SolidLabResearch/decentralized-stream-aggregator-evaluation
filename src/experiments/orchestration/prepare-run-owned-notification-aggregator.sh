#!/usr/bin/env bash
# Prepare (and optionally start) a Notification Aggregator copy without altering its frozen checkout.
set -euo pipefail

usage() {
  echo "Usage: $0 <frozen-service-checkout> <empty-run-directory> <n078-config.json> [--start]" >&2
}

frozen_checkout="${1:-}"
run_directory="${2:-}"
config_template="${3:-}"
mode="${4:-}"
expected_sha="7623967531a4f8a9558c7a8fb91c4ab428199ef5"
[[ -n "$frozen_checkout" && -n "$run_directory" && -n "$config_template" ]] || { usage; exit 2; }
[[ "$mode" == "" || "$mode" == "--start" ]] || { usage; exit 2; }
[[ -d "$frozen_checkout/.git" ]] || { echo "Frozen Notification Aggregator checkout is not a Git repository: $frozen_checkout" >&2; exit 2; }
[[ -f "$config_template" ]] || { echo "n078 service config does not exist: $config_template" >&2; exit 2; }
[[ ! -e "$run_directory" ]] || { echo "Run directory must not already exist: $run_directory" >&2; exit 2; }

actual_sha="$(git -C "$frozen_checkout" rev-parse HEAD)"
[[ "$actual_sha" == "$expected_sha" ]] || { echo "Frozen Notification Aggregator SHA must be $expected_sha; found $actual_sha" >&2; exit 2; }
git clone --no-hardlinks "$frozen_checkout" "$run_directory"
git -C "$run_directory" checkout --detach "$expected_sha"
rg -Fq '../config/notif_aggregator_setup.json' "$run_directory/src/service/SubscribeNotification.ts" || {
  echo "Formal service does not statically import src/config/notif_aggregator_setup.json; inspect configuration loading before deployment." >&2
  exit 2
}
cp "$config_template" "$run_directory/src/config/notif_aggregator_setup.json"
config_sha="$(shasum -a 256 "$config_template" | awk '{print $1}')"
printf '{\n  "frozen_notification_aggregator_sha": "%s",\n  "deployment_config_sha256": "%s",\n  "deployment_config_source": "%s"\n}\n' \
  "$expected_sha" "$config_sha" "$config_template" > "$run_directory/notification-aggregator-deployment-metadata.json"

(cd "$run_directory" && npm ci && npm run build)
if [[ "$mode" == "--start" ]]; then
  exec bash -c "cd \"$run_directory\" && exec npm run start"
fi
echo "Prepared run-owned Notification Aggregator at $run_directory; start it with: (cd '$run_directory' && npm run start)" >&2
