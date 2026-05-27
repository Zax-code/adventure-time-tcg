import * as SecureStore from "expo-secure-store";

import type { Locale } from "../i18n/types";

const PENDING_GOOGLE_AUTH_KEY = "pendingGoogleAuth";
let pendingGoogleAuthSession: PendingGoogleAuthSession | null = null;

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
  pendingGoogleAuthSession = session;
  SecureStore.setItem(PENDING_GOOGLE_AUTH_KEY, JSON.stringify(session));
}

export async function getPendingGoogleAuthSession() {
  if (pendingGoogleAuthSession) {
    return pendingGoogleAuthSession;
  }

  const value =
    SecureStore.getItem(PENDING_GOOGLE_AUTH_KEY) ??
    (await SecureStore.getItemAsync(PENDING_GOOGLE_AUTH_KEY));

  if (!value) {
    return null;
  }

  try {
    const session = JSON.parse(value) as PendingGoogleAuthSession;
    pendingGoogleAuthSession = session;
    return session;
  } catch {
    await SecureStore.deleteItemAsync(PENDING_GOOGLE_AUTH_KEY);
    pendingGoogleAuthSession = null;
    return null;
  }
}

export async function clearPendingGoogleAuthSession() {
  pendingGoogleAuthSession = null;
  await SecureStore.deleteItemAsync(PENDING_GOOGLE_AUTH_KEY);
}
