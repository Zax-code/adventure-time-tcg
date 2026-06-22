#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MOBILE_ROOT="$REPO_ROOT/apps/mobile"
EXPO_DEV_PORT="${EXPO_DEV_PORT:-8081}"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="${TMPDIR:-/tmp}/adventure-time-mobile-both-$RUN_ID"

mkdir -p "$LOG_DIR"

metro_pid=""
ios_pid=""
android_pid=""

cleanup() {
  for pid in "$ios_pid" "$android_pid" "$metro_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

tail_log() {
  local label="$1"
  local log_path="$2"

  echo "$label log: $log_path"
  if [[ -f "$log_path" ]]; then
    tail -n 80 "$log_path"
  fi
}

wait_for_metro() {
  local metro_log="$1"

  for _ in $(seq 1 90); do
    if ! kill -0 "$metro_pid" >/dev/null 2>&1; then
      echo "Expo dev server exited before it became ready."
      tail_log "Metro" "$metro_log"
      exit 1
    fi

    if curl -fsS "http://127.0.0.1:$EXPO_DEV_PORT/status" 2>/dev/null | rg -q "packager-status:running"; then
      return 0
    fi

    sleep 1
  done

  echo "Timed out waiting for Expo dev server on port $EXPO_DEV_PORT."
  tail_log "Metro" "$metro_log"
  exit 1
}

wait_for_launcher() {
  local label="$1"
  local pid="$2"
  local log_path="$3"

  if wait "$pid"; then
    echo "$label launch completed."
    return 0
  fi

  echo "$label launch failed."
  tail_log "$label" "$log_path"
  return 1
}

trap cleanup INT TERM EXIT

metro_log="$LOG_DIR/metro.log"
ios_log="$LOG_DIR/ios.log"
android_log="$LOG_DIR/android.log"

echo "Starting local Expo dev server..."
"$REPO_ROOT/infra/scripts/expo-dev-client.sh" --port "$EXPO_DEV_PORT" >"$metro_log" 2>&1 &
metro_pid="$!"

wait_for_metro "$metro_log"
echo "Expo dev server is ready on port $EXPO_DEV_PORT."
echo "Logs are in $LOG_DIR"

(
  cd "$MOBILE_ROOT"
  EXPO_NO_BUNDLER=1 ./scripts/run-ios.sh
) >"$ios_log" 2>&1 &
ios_pid="$!"

(
  cd "$MOBILE_ROOT"
  EXPO_NO_BUNDLER=1 ./scripts/run-android.sh
) >"$android_log" 2>&1 &
android_pid="$!"

ios_status=0
android_status=0

wait_for_launcher "iOS" "$ios_pid" "$ios_log" || ios_status=$?
wait_for_launcher "Android" "$android_pid" "$android_log" || android_status=$?

if (( ios_status != 0 || android_status != 0 )); then
  exit 1
fi

echo "Both native launch commands completed. Metro is still running; press Ctrl-C to stop it."
wait "$metro_pid"
