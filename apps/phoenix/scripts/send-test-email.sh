#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$APP_DIR/.env"

usage() {
  cat <<'EOF'
Usage: ./scripts/send-test-email.sh recipient@example.com [verification_code]

Sends a Phoenix verification-style test email through the configured local mailer.

Examples:
  ./scripts/send-test-email.sh abouliatimz@yahoo.com
  ./scripts/send-test-email.sh abouliatimz@yahoo.com 482731
  ./scripts/send-test-email.sh abouliatimz@yahoo.com 482731 fr
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

RECIPIENT=${1:-}
CODE=${2:-$(printf '%06d' "$(( RANDOM % 1000000 ))")}
LOCALE=${3:-en}

if [[ -z "$RECIPIENT" ]]; then
  usage >&2
  exit 1
fi

if [[ ! "$RECIPIENT" =~ ^[^[:space:]@]+@[^[:space:]@]+$ ]]; then
  echo "Invalid recipient email: $RECIPIENT" >&2
  exit 1
fi

if [[ ! "$CODE" =~ ^[0-9]{6}$ ]]; then
  echo "Verification code must be exactly 6 digits." >&2
  exit 1
fi

if [[ ! "$LOCALE" =~ ^(en|fr)$ ]]; then
  echo "Locale must be either en or fr." >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

cd "$APP_DIR"

RECIPIENT="$RECIPIENT" CODE="$CODE" LOCALE="$LOCALE" mix run --no-compile -e '
recipient = System.fetch_env!("RECIPIENT")
code = System.fetch_env!("CODE")
locale = System.fetch_env!("LOCALE") |> String.to_atom()

case AdventureTimeApi.Accounts.EmailDelivery.send_verification_code(recipient, code, locale: locale) do
  :ok ->
    IO.puts("Sent test verification email to #{recipient} with code #{code} (#{locale})")

  {:error, message} ->
    IO.puts(:stderr, "Failed to send test verification email: #{message}")
    System.halt(1)
end
'
