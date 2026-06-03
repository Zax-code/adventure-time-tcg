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
  test_password="${MOBILE_TEST_PASSWORD:-}"
  test_access_token=""
  test_refresh_token=""
  test_user=""
  test_match_id=""

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

  if [[ "${#args[@]}" -ge 4 && -f "${args[3]}" ]] && grep -q '\${TEST_MATCH_ID}' "${args[3]}"; then
    test_match_id="$(
      cd /Users/zax/Develop/adventure-time-tcg/apps/phoenix
      MOBILE_TEST_EMAIL="$test_email" \
      MOBILE_TEST_PASSWORD="$test_password" \
      ./scripts/ensure-mobile-test-pvp-fixture.sh
    )"
    test_match_id="$(printf '%s\n' "$test_match_id" | tail -n 1)"
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

  if [[ "${#args[@]}" -ge 4 && -f "${args[3]}" ]]; then
    flow_dir="$(dirname "${args[3]}")"
    temp_flow="$(mktemp "${flow_dir}/.maestro-flow.XXXXXX")"
    temp_flow="${temp_flow}.yaml"
    TEST_EMAIL_VALUE="$test_email" \
    TEST_PASSWORD_VALUE="$test_password" \
    TEST_ACCESS_TOKEN_VALUE="$test_access_token" \
    TEST_REFRESH_TOKEN_VALUE="$test_refresh_token" \
    TEST_USER_VALUE="$test_user" \
    TEST_MATCH_ID_VALUE="$test_match_id" \
      node -e '
        const fs = require("node:fs");
        const [source, target] = process.argv.slice(1);
        const replacements = {
          "${TEST_EMAIL}": process.env.TEST_EMAIL_VALUE ?? "",
          "${TEST_PASSWORD}": process.env.TEST_PASSWORD_VALUE ?? "",
          "${TEST_ACCESS_TOKEN}": process.env.TEST_ACCESS_TOKEN_VALUE ?? "",
          "${TEST_REFRESH_TOKEN}": process.env.TEST_REFRESH_TOKEN_VALUE ?? "",
          "${TEST_USER}": process.env.TEST_USER_VALUE ?? "",
          "${TEST_MATCH_ID}": process.env.TEST_MATCH_ID_VALUE ?? "",
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
