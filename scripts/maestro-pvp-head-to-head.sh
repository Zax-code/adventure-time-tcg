#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
platform="ios"
primary_flow=".maestro/pvp-head-to-head-primary.yaml"
opponent_flow=".maestro/pvp-head-to-head-opponent.yaml"
replay_flow=".maestro/pvp-head-to-head-replay.yaml"
primary_email="${MOBILE_TEST_EMAIL:-mobile-test@leaetzak.love}"
primary_display_name="${MOBILE_TEST_DISPLAY_NAME:-Mobile Test User}"
opponent_email="${MOBILE_TEST_OPPONENT_EMAIL:-mobile-opponent@leaetzak.love}"
opponent_display_name="${MOBILE_TEST_OPPONENT_DISPLAY_NAME:-Mobile PvP Opponent}"

usage() {
  cat <<'EOF'
Usage: scripts/maestro-pvp-head-to-head.sh [--platform ios|android]

Runs deterministic two-player PvP Maestro stages while monitoring the Phoenix
match row, snapshots, and events in parallel. Phoenix drives the match actions
between app sessions so the backend monitor captures persisted events.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --platform)
      platform="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$platform" != "ios" && "$platform" != "android" ]]; then
  echo "--platform must be ios or android" >&2
  exit 1
fi

if [[ -z "${MOBILE_TEST_PASSWORD:-}" ]]; then
  echo "MOBILE_TEST_PASSWORD is required." >&2
  exit 1
fi

cd "$ROOT_DIR"

match_id="${MOBILE_TEST_MATCH_ID:-${TEST_MATCH_ID:-}}"

if [[ -z "$match_id" ]]; then
  match_id="$(
    cd apps/phoenix
    ./scripts/ensure-mobile-test-pvp-fixture.sh
  )"
  match_id="$(printf '%s\n' "$match_id" | tail -n 1)"
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
output_dir=".maestro/test-output/pvp-head-to-head/${timestamp}"
monitor_log="${output_dir}/${timestamp}-backend-monitor.log"
mkdir -p "$output_dir"

monitor_pid=""
cleanup() {
  if [[ -n "$monitor_pid" ]] && kill -0 "$monitor_pid" >/dev/null 2>&1; then
    kill "$monitor_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "PvP match id: $match_id"
echo "Backend monitor log: $monitor_log"

(
  PVP_MONITOR_MATCH_ID="$match_id" \
  PVP_MONITOR_INTERVAL_MS="${PVP_MONITOR_INTERVAL_MS:-1000}" \
  PVP_MONITOR_MAX_SECONDS="${PVP_MONITOR_MAX_SECONDS:-180}" \
    ./apps/phoenix/scripts/monitor-mobile-test-pvp-match.sh "$match_id"
) > >(tee "$monitor_log") 2>&1 &
monitor_pid="$!"

run_maestro_flow() {
  local flow="$1"
  local email="$2"
  local display_name="$3"

  MOBILE_TEST_EMAIL="$email" \
  MOBILE_TEST_DISPLAY_NAME="$display_name" \
  MOBILE_TEST_MATCH_ID="$match_id" \
  TEST_MATCH_ID="$match_id" \
    ./scripts/maestro.sh test --platform "$platform" "$flow"
}

drive_match() {
  local step="$1"

  MOBILE_TEST_MATCH_ID="$match_id" \
  TEST_MATCH_ID="$match_id" \
    ./apps/phoenix/scripts/drive-mobile-test-pvp-match.sh "$match_id" "$step"
}

run_maestro_flow "$primary_flow" "$primary_email" "$primary_display_name"
drive_match end-turn
run_maestro_flow "$opponent_flow" "$opponent_email" "$opponent_display_name"
drive_match concede
run_maestro_flow "$replay_flow" "$primary_email" "$primary_display_name"

for _ in {1..10}; do
  if ! kill -0 "$monitor_pid" >/dev/null 2>&1; then
    wait "$monitor_pid" || true
    monitor_pid=""
    break
  fi

  sleep 1
done

if [[ -n "$monitor_pid" ]] && kill -0 "$monitor_pid" >/dev/null 2>&1; then
  kill "$monitor_pid" >/dev/null 2>&1 || true
  wait "$monitor_pid" || true
  monitor_pid=""
fi

echo "Backend monitor log saved to $monitor_log"
