import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const DEFAULT_PACKAGE_NAME = "love.leaetzak.adventuretime";
const DEFAULT_TRACK = "internal";
const DEFAULT_LOCALE = "en-US";
const DEFAULT_SERVICE_ACCOUNT_PATH = path.resolve(
  import.meta.dirname,
  "../credentials.json",
);
const ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";

function printHelp() {
  process.stdout.write(`Usage: npm run play:release-notes -w @adventure-time/mobile -- --version-code <code> --note "<text>" [options]\n\nOptions:\n  --version-code <code>    Android versionCode to update\n  --note <text>            Short Google Play release note\n  --track <name>           Play track to update (default: ${DEFAULT_TRACK})\n  --locale <code>          Play note locale (default: ${DEFAULT_LOCALE})\n  --package <name>         Android package name (default: ${DEFAULT_PACKAGE_NAME})\n  --service-account <path> Service account JSON path\n  --help                   Show this help\n`);
}

function parseCliOptions() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      locale: { type: "string" },
      note: { type: "string" },
      package: { type: "string" },
      "service-account": { type: "string" },
      track: { type: "string" },
      "version-code": { type: "string" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const versionCode = values["version-code"]?.trim();
  const note = values.note?.trim();

  if (!versionCode) {
    throw new Error("Missing required --version-code value.");
  }

  if (!note) {
    throw new Error("Missing required --note value.");
  }

  return {
    locale: values.locale?.trim() || DEFAULT_LOCALE,
    note,
    packageName: values.package?.trim() || DEFAULT_PACKAGE_NAME,
    serviceAccountPath:
      values["service-account"]?.trim() ||
      process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH ||
      DEFAULT_SERVICE_ACCOUNT_PATH,
    track: values.track?.trim() || DEFAULT_TRACK,
    versionCode,
  };
}

function loadServiceAccount(serviceAccountPath) {
  const inlineJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;

  if (inlineJson) {
    return JSON.parse(inlineJson);
  }

  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      `Google Play service account key not found at ${serviceAccountPath}.`,
    );
  }

  return JSON.parse(readFileSync(serviceAccountPath, "utf8"));
}

function base64UrlEncode(value) {
  const input = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(input).toString("base64url");
}

async function fetchAccessToken(serviceAccount) {
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error(
      "Service account JSON is missing client_email or private_key.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    iss: serviceAccount.client_email,
    scope: ANDROID_PUBLISHER_SCOPE,
  };
  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
  const signer = createSign("RSA-SHA256");

  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(serviceAccount.private_key, "base64url");
  const assertion = `${unsignedToken}.${signature}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Google access token: ${response.status} ${await response.text()}`,
    );
  }

  const payloadJson = await response.json();

  if (!payloadJson.access_token) {
    throw new Error("Google access token response did not include access_token.");
  }

  return payloadJson.access_token;
}

async function googlePlayRequest(accessToken, resourcePath, options = {}) {
  const url = new URL(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/${resourcePath}`,
  );

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    method: options.method || "GET",
  });

  if (!response.ok) {
    const responseText = await response.text();
    const error = new Error(
      `Google Play API request failed for ${resourcePath}: ${response.status} ${responseText}`,
    );

    error.status = response.status;
    error.responseText = responseText;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function commitEdit(accessToken, packageName, editId) {
  try {
    await googlePlayRequest(
      accessToken,
      `applications/${packageName}/edits/${editId}:commit`,
      {
        method: "POST",
        query: { changesNotSentForReview: "true" },
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes(
        "changesNotSentForReview must not be set",
      )
    ) {
      await googlePlayRequest(
        accessToken,
        `applications/${packageName}/edits/${editId}:commit`,
        {
          method: "POST",
        },
      );
      return;
    }

    throw error;
  }
}

function updateReleaseNotes(trackResponse, versionCode, locale, note) {
  const releases = Array.isArray(trackResponse.releases)
    ? trackResponse.releases
    : [];
  const releaseIndex = releases.findIndex((release) =>
    Array.isArray(release.versionCodes)
      ? release.versionCodes.map(String).includes(versionCode)
      : false,
  );

  if (releaseIndex === -1) {
    const knownVersionCodes = releases
      .flatMap((release) =>
        Array.isArray(release.versionCodes)
          ? release.versionCodes.map(String)
          : [],
      )
      .join(", ");

    throw new Error(
      `No ${trackResponse.track ?? DEFAULT_TRACK} track release contains versionCode ${versionCode}. Known version codes: ${knownVersionCodes || "none"}.`,
    );
  }

  const release = releases[releaseIndex];
  const otherReleaseNotes = Array.isArray(release.releaseNotes)
    ? release.releaseNotes.filter((entry) => entry.language !== locale)
    : [];
  const updatedRelease = {
    ...release,
    releaseNotes: [...otherReleaseNotes, { language: locale, text: note }],
  };
  const updatedReleases = releases.map((currentRelease, index) =>
    index === releaseIndex ? updatedRelease : currentRelease,
  );

  return { releases: updatedReleases, updatedRelease };
}

async function main() {
  const options = parseCliOptions();
  const serviceAccount = loadServiceAccount(options.serviceAccountPath);
  const accessToken = await fetchAccessToken(serviceAccount);
  const packageName = encodeURIComponent(options.packageName);
  const trackName = encodeURIComponent(options.track);
  const edit = await googlePlayRequest(
    accessToken,
    `applications/${packageName}/edits`,
    { body: {}, method: "POST" },
  );
  const trackResponse = await googlePlayRequest(
    accessToken,
    `applications/${packageName}/edits/${edit.id}/tracks/${trackName}`,
  );
  const { releases, updatedRelease } = updateReleaseNotes(
    trackResponse,
    options.versionCode,
    options.locale,
    options.note,
  );

  await googlePlayRequest(
    accessToken,
    `applications/${packageName}/edits/${edit.id}/tracks/${trackName}`,
    {
      body: { releases },
      method: "PUT",
    },
  );
  await commitEdit(accessToken, packageName, edit.id);

  process.stdout.write(
    `Updated Google Play ${options.track} release note for versionCode ${options.versionCode} (${updatedRelease.status ?? "unknown status"}) in ${options.locale}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
