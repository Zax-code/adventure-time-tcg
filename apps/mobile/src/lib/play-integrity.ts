import { Platform } from "react-native";

import type { AccessAssessmentChallenge } from "@adventure-time/api-client";

import PlayIntegrity from "../../modules/play-integrity/src/PlayIntegrityModule";
import { apiClient, ApiClientError } from "./api";

const cloudProjectNumber = Number(
  process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT_NUMBER,
);

let preparation: Promise<void> | null = null;

export function preparePlayIntegrity(): Promise<void> {
  if (
    Platform.OS !== "android" ||
    !PlayIntegrity ||
    !Number.isSafeInteger(cloudProjectNumber)
  ) {
    return Promise.resolve();
  }

  preparation ??= PlayIntegrity.prepareAsync(cloudProjectNumber).catch(() => {
    preparation = null;
  });

  return preparation;
}

export async function submitAssessmentChallenge(
  challenge: AccessAssessmentChallenge | undefined,
): Promise<void> {
  if (Platform.OS !== "android" || !PlayIntegrity || !challenge) {
    return;
  }

  try {
    await preparePlayIntegrity();
    const integrityToken = await PlayIntegrity.requestTokenAsync(
      challenge.requestHash,
    );
    await apiClient.submitAccessRequestIntegrity({
      challengeToken: challenge.token,
      integrityToken,
    });
  } catch {
    // Advisory evidence must never interrupt the existing authentication flow.
  }
}

export function assessmentChallengeFromError(
  error: unknown,
): AccessAssessmentChallenge | undefined {
  if (!(error instanceof ApiClientError)) {
    return undefined;
  }

  const value = error.details?.assessmentChallenge;
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const challenge = value as Record<string, unknown>;
  if (
    challenge.kind !== "play_integrity_standard" ||
    typeof challenge.token !== "string" ||
    typeof challenge.requestHash !== "string" ||
    typeof challenge.expiresAt !== "string"
  ) {
    return undefined;
  }

  return challenge as AccessAssessmentChallenge;
}
