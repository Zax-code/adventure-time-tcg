import {
  appleAuthSchema,
  googleAuthSchema,
  loginSchema,
  webAuthConfigSchema,
  webSessionResponseSchema,
  type AppleAuthInput,
  type AuthUser,
  type GoogleAuthInput,
  type LoginInput,
  type WebAuthConfig,
  type WebSessionResponse,
} from "@adventure-time/api-client";

import {
  configureWebApiAuth,
  isAuthenticationError,
  webApiClient,
  webJsonRequest,
} from "../lib/api";

export type AuthStatus = "restoring" | "authenticated" | "anonymous";

export type AuthSnapshot = {
  status: AuthStatus;
  user: AuthUser | null;
  restoreError: string | null;
};

let accessToken: string | null = null;
let snapshot: AuthSnapshot = {
  status: "restoring",
  user: null,
  restoreError: null,
};
let refreshPromise: Promise<WebSessionResponse> | null = null;
const listeners = new Set<() => void>();

function publish(next: AuthSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function applySession(session: WebSessionResponse) {
  accessToken = session.accessToken;
  publish({
    status: "authenticated",
    user: session.user,
    restoreError: null,
  });
}

function requestSessionRefresh() {
  if (!refreshPromise) {
    refreshPromise = webJsonRequest(
      "/web/session/refresh",
      { method: "POST", body: "{}" },
      (data) => webSessionResponseSchema.parse(data),
    ).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export function getAuthSnapshot() {
  return snapshot;
}

export function subscribeToAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken() {
  return accessToken;
}

export function clearLocalWebSession(restoreError: string | null = null) {
  accessToken = null;
  publish({ status: "anonymous", user: null, restoreError });
}

export async function createWebSession(input: LoginInput) {
  const body = loginSchema.parse(input);
  const session = await webJsonRequest(
    "/web/session",
    { method: "POST", body: JSON.stringify(body) },
    (data) => webSessionResponseSchema.parse(data),
  );

  applySession(session);
  return session.user;
}

export async function getWebAuthConfig() {
  return webJsonRequest<WebAuthConfig>(
    "/web/auth/config",
    { method: "GET" },
    (data) => webAuthConfigSchema.parse(data),
  );
}

export async function createGoogleWebSession(input: GoogleAuthInput) {
  const body = googleAuthSchema.parse(input);
  const session = await webJsonRequest(
    "/web/session/google",
    { method: "POST", body: JSON.stringify(body) },
    (data) => webSessionResponseSchema.parse(data),
  );

  applySession(session);
  return session.user;
}

export async function createAppleWebSession(input: AppleAuthInput) {
  const body = appleAuthSchema.parse(input);
  const session = await webJsonRequest(
    "/web/session/apple",
    { method: "POST", body: JSON.stringify(body) },
    (data) => webSessionResponseSchema.parse(data),
  );

  applySession(session);
  return session.user;
}

export async function restoreWebSession() {
  if (snapshot.status !== "authenticated") {
    publish({ status: "restoring", user: null, restoreError: null });
  }

  try {
    const session = await requestSessionRefresh();
    applySession(session);
    return session.user;
  } catch (error) {
    if (isAuthenticationError(error)) {
      clearLocalWebSession();
      return null;
    }

    const restoreError =
      error instanceof Error
        ? error.message
        : "We could not restore your browser session.";

    // A network error, 5xx or rate limit must not sign out an authenticated user;
    // only the initial restore settles as anonymous.
    if (snapshot.status === "authenticated") {
      publish({ ...snapshot, restoreError });
      return snapshot.user;
    }

    clearLocalWebSession(restoreError);
    return null;
  }
}

/**
 * Reloads the current user (coins, dust, profile) after a mutation without
 * rotating the session. Authentication failures are handled by the API client;
 * any other failure keeps the user already shown.
 */
export async function refreshCurrentUser() {
  try {
    const user = await webApiClient.me();

    if (snapshot.status === "authenticated") {
      publish({ ...snapshot, user });
    }

    return user;
  } catch {
    return snapshot.user;
  }
}

async function refreshAccessTokenForApi() {
  try {
    const session = await requestSessionRefresh();
    applySession(session);
    return session.accessToken;
  } catch (error) {
    if (isAuthenticationError(error)) {
      clearLocalWebSession();
      return null;
    }

    throw error;
  }
}

export async function destroyWebSession() {
  try {
    await webJsonRequest(
      "/web/session",
      { method: "DELETE" },
      () => undefined,
    );
  } finally {
    clearLocalWebSession();
  }
}

configureWebApiAuth({
  getAccessToken,
  refreshAccessToken: refreshAccessTokenForApi,
  onAuthFailure: clearLocalWebSession,
});
