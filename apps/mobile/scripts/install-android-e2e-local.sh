#!/usr/bin/env bash

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MOBILE_ROOT="$WORKSPACE_ROOT/apps/mobile"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
ANDROID_CMDLINE_TOOLS_ROOT="${ANDROID_HOME}/cmdline-tools/latest"
HOMEBREW_CMDLINE_TOOLS_ROOT="/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest"
AVD_NAME="${ANDROID_AVD_NAME:-AdventureTime-Pixel-8}"
SYSTEM_IMAGE="${ANDROID_SYSTEM_IMAGE:-system-images;android-36;google_apis;arm64-v8a}"
PLATFORM_PACKAGE="${ANDROID_PLATFORM_PACKAGE:-platforms;android-36}"
BUILD_TOOLS_PACKAGE="${ANDROID_BUILD_TOOLS_PACKAGE:-build-tools;36.0.0}"
NDK_PACKAGE="${ANDROID_NDK_PACKAGE:-ndk;27.1.12297006}"
DEVICE_NAME="${ANDROID_AVD_DEVICE:-pixel_8}"
EMULATOR_LOG="${TMPDIR:-/tmp}/adventure-time-android-emulator.log"
APK_PATH="${1:-$MOBILE_ROOT/local-build/android-e2e.apk}"
SDKMANAGER_BIN="${ANDROID_CMDLINE_TOOLS_ROOT}/bin/sdkmanager"
AVDMANAGER_BIN="${ANDROID_CMDLINE_TOOLS_ROOT}/bin/avdmanager"
APP_ID="love.leaetzak.adventuretime"

export ANDROID_SDK_ROOT ANDROID_HOME JAVA_HOME
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:${ANDROID_CMDLINE_TOOLS_ROOT}/bin:$PATH"

require_command() {
  local command_name="$1"

  if [[ "$command_name" == */* ]]; then
    [[ -x "$command_name" ]] && return 0
  elif command -v "$command_name" >/dev/null 2>&1; then
    return 0
  fi

  echo "$command_name is required for Android E2E installation."
  exit 1
}

ensure_directory() {
  local dir_path="$1"

  if [[ ! -d "$dir_path" ]]; then
    echo "Missing required directory: $dir_path"
    exit 1
  fi
}

ensure_sdk_package() {
  local package_name="$1"
  local package_dir="$2"
  local marker_path="${3:-}"

  if [[ -d "$package_dir" ]]; then
    if [[ -z "$marker_path" || -f "$marker_path" ]]; then
      return 0
    fi
  fi

  if [[ -n "$marker_path" && -f "$marker_path" ]]; then
    return 0
  fi

  echo "Installing Android SDK package: $package_name"
  yes | "$SDKMANAGER_BIN" --install "$package_name" >/dev/null
}

bootstrap_cmdline_tools() {
  if [[ -x "$AVDMANAGER_BIN" && -x "$SDKMANAGER_BIN" ]]; then
    return 0
  fi

  if [[ ! -d "$HOMEBREW_CMDLINE_TOOLS_ROOT" ]]; then
    echo "Android command-line tools are missing. Open Android Studio and install Command-line Tools."
    exit 1
  fi

  echo "Copying Android command-line tools into $ANDROID_HOME"
  mkdir -p "$(dirname "$ANDROID_CMDLINE_TOOLS_ROOT")"
  rm -rf "$ANDROID_CMDLINE_TOOLS_ROOT"
  cp -R "$HOMEBREW_CMDLINE_TOOLS_ROOT" "$ANDROID_CMDLINE_TOOLS_ROOT"
}

booted_emulator_serial() {
  adb devices | awk 'NR > 1 && $2 == "device" && $1 ~ /^emulator-/ { print $1; exit }'
}

ensure_avd() {
  if emulator -list-avds | rg -qx "$AVD_NAME"; then
    return 0
  fi

  echo "Creating Android emulator: $AVD_NAME"
  printf 'no\n' | "$AVDMANAGER_BIN" create avd --force --name "$AVD_NAME" --package "$SYSTEM_IMAGE" --tag google_apis --abi arm64-v8a --device "$DEVICE_NAME" >/dev/null
}

start_emulator_if_needed() {
  local serial
  serial="$(booted_emulator_serial || true)"

  if [[ -n "$serial" ]]; then
    echo "Using running Android emulator: $serial"
    return 0
  fi

  echo "Starting Android emulator: $AVD_NAME"
  rm -f "$EMULATOR_LOG"
  nohup emulator -avd "$AVD_NAME" -netdelay none -netspeed full >"$EMULATOR_LOG" 2>&1 &
}

wait_for_boot() {
  local serial=""

  for _ in $(seq 1 120); do
    serial="$(booted_emulator_serial || true)"
    if [[ -n "$serial" ]]; then
      break
    fi
    sleep 2
  done

  if [[ -z "$serial" ]]; then
    echo "Android emulator did not appear in adb."
    [[ -f "$EMULATOR_LOG" ]] && tail -n 80 "$EMULATOR_LOG" || true
    exit 1
  fi

  adb -s "$serial" wait-for-device >/dev/null

  for _ in $(seq 1 180); do
    if [[ "$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      echo "Android emulator is ready: $serial"
      printf '%s\n' "$serial"
      return 0
    fi
    sleep 2
  done

  echo "Android emulator boot did not complete in time."
  exit 1
}

for command_name in adb emulator npx rg; do
  require_command "$command_name"
done

require_command "$JAVA_HOME/bin/java"
ensure_directory "$ANDROID_HOME"

if [[ ! -f "$APK_PATH" ]]; then
  echo "Missing local Android E2E artifact: $APK_PATH"
  exit 1
fi

bootstrap_cmdline_tools
require_command "$AVDMANAGER_BIN"
require_command "$SDKMANAGER_BIN"

ensure_sdk_package "platform-tools" "$ANDROID_HOME/platform-tools"
ensure_sdk_package "emulator" "$ANDROID_HOME/emulator"
ensure_sdk_package "$PLATFORM_PACKAGE" "$ANDROID_HOME/platforms/android-36"
ensure_sdk_package "$BUILD_TOOLS_PACKAGE" "$ANDROID_HOME/build-tools/36.0.0"
ensure_sdk_package "$NDK_PACKAGE" "$ANDROID_HOME/ndk/27.1.12297006" "$ANDROID_HOME/ndk/27.1.12297006/source.properties"
ensure_sdk_package "$SYSTEM_IMAGE" "$ANDROID_HOME/system-images/android-36/google_apis/arm64-v8a"

ensure_avd
start_emulator_if_needed
serial="$(wait_for_boot)"

adb -s "$serial" uninstall "$APP_ID" >/dev/null 2>&1 || true
adb -s "$serial" install -r "$APK_PATH"

echo "Installed Android E2E app from $APK_PATH on $serial."
