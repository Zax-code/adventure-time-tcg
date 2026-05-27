import * as SecureStore from "expo-secure-store";

import type { Locale } from "../i18n/types";

const PENDING_GOOGLE_AUTH_KEY = "pendingGoogleAuth";

export interface PendingGoogleAuthSession {
  clientId: string;
  codeVerifier: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  preferredLanguage: Locale;
}

export async function savePendingGoogleAuthSession(
  session: PendingGoogleAuthSession,
) {
  await SecureStore.setItemAsync(
    PENDING_GOOGLE_AUTH_KEY,
    JSON.stringify(session),
  );
}

export async function getPendingGoogleAuthSession() {
  const value = await SecureStore.getItemAsync(PENDING_GOOGLE_AUTH_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as PendingGoogleAuthSession;
  } catch {
    await SecureStore.deleteItemAsync(PENDING_GOOGLE_AUTH_KEY);
    return null;
  }
}

export async function clearPendingGoogleAuthSession() {
  await SecureStore.deleteItemAsync(PENDING_GOOGLE_AUTH_KEY);
}
