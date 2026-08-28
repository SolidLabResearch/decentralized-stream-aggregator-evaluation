#!/usr/bin/env bash
# E4's intentionally narrow Solid cleanup. It only traverses and deletes the
# three segment-01 stream containers through CSS HTTP endpoints. In particular,
# it never touches .internal/notifications, Redis, a CSS data root, profiles, or
# any other pod/segment. A missing resource is already clean and succeeds.
set -euo pipefail

base_url="${E4_SOLID_BASE_URL:-http://n078-03.wall1.ilabt.imec.be:3000}"
readonly expected_base="http://n078-03.wall1.ilabt.imec.be:3000"
readonly max_depth="${E4_SOLID_CLEANUP_MAX_DEPTH:-8}"
[[ "$base_url" == "$expected_base" ]] || { echo "E4 cleanup rejects unexpected CSS base URL: $base_url" >&2; exit 2; }
[[ "$max_depth" =~ ^[1-9][0-9]*$ ]] || { echo "E4_SOLID_CLEANUP_MAX_DEPTH must be a positive integer" >&2; exit 2; }

streams=(
  "$base_url/pod1/heterogeneous/segment-01/acc-x/"
  "$base_url/pod1/heterogeneous/segment-01/acc-y/"
  "$base_url/pod1/heterogeneous/segment-01/acc-z/"
)

children_of() {
  local parent="$1" body status
  body="$(mktemp)"
  status="$(curl --silent --show-error --location --output "$body" --write-out '%{http_code}' --header 'Accept: text/turtle' "$parent" || true)"
  case "$status" in
    200) ;;
    404) rm -f "$body"; return 0 ;;
    *) rm -f "$body"; echo "E4 cleanup cannot enumerate $parent (HTTP $status)" >&2; return 1 ;;
  esac
  # CSS's LDP container representation exposes contained resources as IRI
  # objects. Only direct descendants of the exact parent are accepted; this is
  # deliberately fail-closed if CSS returns an unfamiliar representation.
  grep -E 'ldp:contains|<http://www.w3.org/ns/ldp#contains>' "$body" | grep -oE '<https?://[^>]+>' | tr -d '<>' | while IFS= read -r child; do
    [[ "$child" == "$parent"* && "$child" != "$parent" && "$child" != *'?'* && "$child" != *'#'* && "$child" != *'..'* ]] || continue
    printf '%s\n' "$child"
  done
  rm -f "$body"
}

delete_tree() {
  local resource="$1" depth="$2" status child
  (( depth <= max_depth )) || { echo "E4 cleanup depth guard reached at $resource" >&2; return 1; }
  while IFS= read -r child; do delete_tree "$child" "$((depth + 1))"; done < <(children_of "$resource")
  status="$(curl --silent --show-error --location --output /dev/null --write-out '%{http_code}' --request DELETE "$resource" || true)"
  case "$status" in
    200|202|204|404) printf 'E4 cleanup: %s (HTTP %s)\n' "$resource" "$status" ;;
    *) echo "E4 cleanup failed for $resource (HTTP $status); no broader resource will be touched" >&2; return 1 ;;
  esac
}

printf '%s\n' 'E4 cleanup policy: CSS notification internals are intentionally left untouched.'
for stream in "${streams[@]}"; do delete_tree "$stream" 0; done
