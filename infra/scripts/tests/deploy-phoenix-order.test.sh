#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
deploy_script="$script_dir/../deploy-phoenix.sh"

line_for() {
  local pattern="$1"
  local line

  line="$(grep -n -m 1 -x -F "$pattern" "$deploy_script" | cut -d: -f1)"

  if [ -z "$line" ]; then
    echo "Missing deploy step: $pattern" >&2
    exit 1
  fi

  printf '%s\n' "$line"
}

assert_before() {
  local earlier_label="$1"
  local earlier_pattern="$2"
  local later_label="$3"
  local later_pattern="$4"
  local earlier_line
  local later_line

  earlier_line="$(line_for "$earlier_pattern")"
  later_line="$(line_for "$later_pattern")"

  if [ "$earlier_line" -ge "$later_line" ]; then
    echo "$earlier_label must happen before $later_label." >&2
    echo "$earlier_label line: $earlier_line" >&2
    echo "$later_label line: $later_line" >&2
    exit 1
  fi
}

assert_before \
  "API image pull" \
  "pull_image" \
  "explicit API stop" \
  'sudo systemctl stop "$SERVICE_NAME" || true'

assert_before \
  "API image pull" \
  "pull_image" \
  "Quadlet installation" \
  'install_quadlets "$REPO_ROOT"'

assert_before \
  "explicit API stop" \
  'sudo systemctl stop "$SERVICE_NAME" || true' \
  "backing-service restart" \
  "sudo systemctl restart adventure-time-tcg-pod.service || sudo systemctl start adventure-time-tcg-pod.service"

assert_before \
  "database migrations" \
  "  run_migrations" \
  "API cutover restart" \
  'sudo systemctl restart "$SERVICE_NAME" || sudo systemctl start "$SERVICE_NAME"'

echo "Phoenix deploy ordering regression test passed."
