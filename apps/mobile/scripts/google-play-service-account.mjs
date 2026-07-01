import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_GOOGLE_PLAY_SERVICE_ACCOUNT_PATH = path.resolve(
  import.meta.dirname,
  "../credentials/android/google-play-service-account.json",
);

export function resolveGooglePlayServiceAccountPath(cliPath) {
  return (
    cliPath?.trim() ||
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH?.trim() ||
    DEFAULT_GOOGLE_PLAY_SERVICE_ACCOUNT_PATH
  );
}

export function loadGooglePlayServiceAccount(serviceAccountPath) {
  const inlineJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim();

  if (inlineJson) {
    const parsedInlineJson = JSON.parse(inlineJson);
    validateGooglePlayServiceAccount(
      parsedInlineJson,
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON",
    );
    return parsedInlineJson;
  }

  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      [
        `Google Play service account key not found at ${serviceAccountPath}.`,
        "Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH,",
        "or place the Android service-account JSON at apps/mobile/credentials/android/google-play-service-account.json.",
      ].join(" "),
    );
  }

  const parsedFileJson = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  validateGooglePlayServiceAccount(parsedFileJson, serviceAccountPath);
  return parsedFileJson;
}

export function ensureGooglePlayServiceAccountConfigured(serviceAccountPath) {
  loadGooglePlayServiceAccount(serviceAccountPath);
}

function validateGooglePlayServiceAccount(serviceAccount, sourceLabel) {
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error(
      [
        `Google Play service account JSON from ${sourceLabel} is missing client_email or private_key.`,
        "This repo's apps/mobile/credentials.json is reserved for iOS credentials and cannot be used for Play release notes.",
      ].join(" "),
    );
  }
}
