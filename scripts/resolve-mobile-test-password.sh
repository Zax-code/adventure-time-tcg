#!/usr/bin/env bash

resolve_mobile_test_password() {
  local test_email="${1:-${MOBILE_TEST_EMAIL:-mobile-test@leaetzak.love}}"
  local script_dir repo_root password_file password

  if [[ -n "${MOBILE_TEST_PASSWORD:-}" ]]; then
    printf '%s\n' "$MOBILE_TEST_PASSWORD"
    return 0
  fi

  script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
  repo_root=$(cd -- "$script_dir/.." && pwd)
  password_file="${MOBILE_TEST_PASSWORD_FILE:-$repo_root/.maestro/.env.local}"

  if [[ -f "$password_file" ]]; then
    password="$(
      /bin/bash -lc '
        set -a
        source "$1" >/dev/null 2>&1
        printf "%s" "${MOBILE_TEST_PASSWORD:-}"
      ' _ "$password_file"
    )"
    if [[ -n "$password" ]]; then
      printf '%s\n' "$password"
      return 0
    fi
  fi

  if command -v security >/dev/null 2>&1; then
    password="$(
      security find-generic-password \
        -a "$test_email" \
        -s "adventure-time-mobile-test-password" \
        -w 2>/dev/null || true
    )"
    if [[ -n "$password" ]]; then
      printf '%s\n' "$password"
      return 0
    fi
  fi

  return 1
}

print_mobile_test_password_help() {
  local test_email="${1:-mobile-test@leaetzak.love}"

  cat >&2 <<EOF
Unable to resolve MOBILE_TEST_PASSWORD for $test_email.

Use one of these local options:
  1. Export it for the current shell:
     MOBILE_TEST_PASSWORD='your-password' ./scripts/maestro.sh ...

  2. Store it in an ignored local file:
     .maestro/.env.local
     MOBILE_TEST_PASSWORD=your-password

  3. Store it in the macOS keychain for this test account:
     security add-generic-password -U -a "$test_email" -s adventure-time-mobile-test-password -w 'your-password'
EOF
}
