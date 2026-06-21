#!/usr/bin/env bash

set -euo pipefail

args=("$@")
temp_flow=""
session_file=""

cleanup() {
  if [[ -n "$temp_flow" && -f "$temp_flow" ]]; then
    rm -f "$temp_flow"
  fi

  if [[ -n "$session_file" && -f "$session_file" ]]; then
    rm -f "$session_file"
  fi
}

trap cleanup EXIT

if [[ "${1:-}" == "test" ]]; then
  test_email="${MOBILE_TEST_EMAIL:-mobile-test@leaetzak.love}"
  test_opponent_email="${MOBILE_TEST_OPPONENT_EMAIL:-mobile-opponent@leaetzak.love}"
  test_password="${MOBILE_TEST_PASSWORD:-}"
  test_access_token=""
  test_refresh_token=""
  test_user=""
  test_match_id="${MOBILE_TEST_MATCH_ID:-${TEST_MATCH_ID:-}}"
  test_replay_id="${MOBILE_TEST_REPLAY_ID:-${TEST_REPLAY_ID:-}}"

  if [[ -z "$test_password" ]]; then
    echo "MOBILE_TEST_PASSWORD is required for Maestro smoke tests." >&2
    exit 1
  fi

  (
    cd /Users/zax/Develop/adventure-time-tcg/apps/phoenix
    MOBILE_TEST_EMAIL="$test_email" \
    MOBILE_TEST_PASSWORD="$test_password" \
      ./scripts/ensure-mobile-test-user.sh >/dev/null
  )

  if [[ "${#args[@]}" -ge 4 && -f "${args[3]}" ]] && grep -q '\${TEST_MATCH_ID}' "${args[3]}" && [[ -z "$test_match_id" ]]; then
    test_match_id="$(
      cd /Users/zax/Develop/adventure-time-tcg/apps/phoenix
      MOBILE_TEST_EMAIL="$test_email" \
      MOBILE_TEST_PASSWORD="$test_password" \
      ./scripts/ensure-mobile-test-pvp-fixture.sh
    )"
    test_match_id="$(printf '%s\n' "$test_match_id" | tail -n 1)"
  fi

  if [[ "${#args[@]}" -ge 4 && -f "${args[3]}" ]] && grep -q '\${TEST_REPLAY_ID}' "${args[3]}" && [[ -z "$test_replay_id" ]]; then
    test_replay_id="$(
      cd /Users/zax/Develop/adventure-time-tcg/apps/phoenix
      MOBILE_TEST_EMAIL="$test_email" \
      MOBILE_TEST_PASSWORD="$test_password" \
        ./scripts/ensure-mobile-test-pvp-replay-fixture.sh
    )"
    test_replay_id="$(printf '%s\n' "$test_replay_id" | tail -n 1)"
  fi

  session_file="$(mktemp)"
  TEST_EMAIL_VALUE="$test_email" TEST_PASSWORD_VALUE="$test_password" node <<'NODE' > "$session_file"
      (async () => {
        const response = await fetch("http://127.0.0.1:4200/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: process.env.TEST_EMAIL_VALUE,
            password: process.env.TEST_PASSWORD_VALUE,
          }),
        });

        const bodyText = await response.text();
        if (!response.ok) {
          console.error(
            `E2E backend login failed (${response.status}): ${bodyText}`,
          );
          process.exit(1);
        }

        const data = JSON.parse(bodyText);
        process.stdout.write(`${encodeURIComponent(data.tokens.accessToken)}\n`);
        process.stdout.write(`${encodeURIComponent(data.tokens.refreshToken)}\n`);
        process.stdout.write(`${encodeURIComponent(JSON.stringify(data.user))}\n`);
      })().catch((error) => {
        console.error(
          error instanceof Error ? error.message : "E2E backend login failed.",
        );
        process.exit(1);
      });
NODE
  test_access_token="$(sed -n '1p' "$session_file")"
  test_refresh_token="$(sed -n '2p' "$session_file")"
  test_user="$(sed -n '3p' "$session_file")"
  test_email_uri="$(node -p 'encodeURIComponent(process.argv[1])' "$test_email")"
  test_opponent_email_uri="$(node -p 'encodeURIComponent(process.argv[1])' "$test_opponent_email")"
  test_password_uri="$(node -p 'encodeURIComponent(process.argv[1])' "$test_password")"

  export TEST_EMAIL="$test_email"
  export TEST_OPPONENT_EMAIL="$test_opponent_email"
  export TEST_PASSWORD="$test_password"
  export TEST_EMAIL_URI="$test_email_uri"
  export TEST_OPPONENT_EMAIL_URI="$test_opponent_email_uri"
  export TEST_PASSWORD_URI="$test_password_uri"
  export TEST_ACCESS_TOKEN="$test_access_token"
  export TEST_REFRESH_TOKEN="$test_refresh_token"
  export TEST_USER="$test_user"
  export TEST_MATCH_ID="$test_match_id"
  export TEST_REPLAY_ID="$test_replay_id"

  if [[ "${#args[@]}" -ge 4 && -f "${args[3]}" ]]; then
    flow_dir="$(dirname "${args[3]}")"
    temp_flow="$(mktemp "${flow_dir}/.maestro-flow.XXXXXX")"
    temp_flow="${temp_flow}.yaml"
    TEST_EMAIL_VALUE="$test_email" \
    TEST_OPPONENT_EMAIL_VALUE="$test_opponent_email" \
    TEST_PASSWORD_VALUE="$test_password" \
    TEST_EMAIL_URI_VALUE="$test_email_uri" \
    TEST_OPPONENT_EMAIL_URI_VALUE="$test_opponent_email_uri" \
    TEST_PASSWORD_URI_VALUE="$test_password_uri" \
    TEST_ACCESS_TOKEN_VALUE="$test_access_token" \
    TEST_REFRESH_TOKEN_VALUE="$test_refresh_token" \
    TEST_USER_VALUE="$test_user" \
    TEST_MATCH_ID_VALUE="$test_match_id" \
    TEST_REPLAY_ID_VALUE="$test_replay_id" \
      node -e '
        const fs = require("node:fs");
        const [source, target] = process.argv.slice(1);
        const replacements = {
          "${TEST_EMAIL}": process.env.TEST_EMAIL_VALUE ?? "",
          "${TEST_OPPONENT_EMAIL}": process.env.TEST_OPPONENT_EMAIL_VALUE ?? "",
          "${TEST_PASSWORD}": process.env.TEST_PASSWORD_VALUE ?? "",
          "${TEST_EMAIL_URI}": process.env.TEST_EMAIL_URI_VALUE ?? "",
          "${TEST_OPPONENT_EMAIL_URI}": process.env.TEST_OPPONENT_EMAIL_URI_VALUE ?? "",
          "${TEST_PASSWORD_URI}": process.env.TEST_PASSWORD_URI_VALUE ?? "",
          "${TEST_ACCESS_TOKEN}": process.env.TEST_ACCESS_TOKEN_VALUE ?? "",
          "${TEST_REFRESH_TOKEN}": process.env.TEST_REFRESH_TOKEN_VALUE ?? "",
          "${TEST_USER}": process.env.TEST_USER_VALUE ?? "",
          "${TEST_MATCH_ID}": process.env.TEST_MATCH_ID_VALUE ?? "",
          "${TEST_REPLAY_ID}": process.env.TEST_REPLAY_ID_VALUE ?? "",
        };
        let content = fs.readFileSync(source, "utf8");
        for (const [token, value] of Object.entries(replacements)) {
          content = content.split(token).join(value);
        }
        fs.writeFileSync(target, content);
      ' "${args[3]}" "$temp_flow"
    args[3]="$temp_flow"
  fi
fi

if command -v maestro >/dev/null 2>&1; then
  exec maestro "${args[@]}"
fi

MAESTRO_LOCAL_BIN="$HOME/.maestro/bin/maestro"

if [[ -x "$MAESTRO_LOCAL_BIN" ]]; then
  exec "$MAESTRO_LOCAL_BIN" "${args[@]}"
fi

echo "Maestro CLI is not installed." >&2
echo "Install it with: curl -fsSL https://get.maestro.mobile.dev | bash" >&2
exit 1
