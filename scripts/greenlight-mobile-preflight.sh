#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/adventure-time-greenlight.XXXXXX")"

cleanup() {
  rm -rf "$TMP_ROOT"
}

trap cleanup EXIT

mkdir -p "$TMP_ROOT/apps"

rsync -a \
  --exclude node_modules \
  --exclude .expo \
  --exclude local-build \
  --exclude ios/build \
  --exclude android/.gradle \
  --exclude android/app/build \
  "$REPO_ROOT/apps/mobile/" \
  "$TMP_ROOT/apps/mobile/"

cd "$TMP_ROOT"
greenlight preflight apps/mobile "$@"
