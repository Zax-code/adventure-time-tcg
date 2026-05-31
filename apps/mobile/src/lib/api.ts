import * as SecureStore from "expo-secure-store";

import {
  ApiClient,
  ApiClientError,
  ApiNetworkError,
  isNetworkError,
  type AuthUser,
} from "@adventure-time/api-client";

import { queryClient } from "./query-client";
import { clearScheduledNotificationPreferencesForSession } from "./app-notifications";
import { unregisterNotificationDeviceBeforeSessionClear } from "./widget-refresh-push";
import { API_BASE_URL } from "./api-config";
import { useSessionStore } from "../stores/session-store";

export { API_BASE_URL };

let refreshPromise: Promise<string | null> | null = null;
const SESSION_CLEARABLE_403_CODES = new Set([
  "ACCESS_REQUEST_PENDING",
  "EMAIL_VERIFICATION_REQUIRED",
]);

async function getSecureStoreValue(key: "accessToken" | "refreshToken" | "user") {
  return SecureStore.getItemAsync(key);
}

export async function getAccessToken() {
  return (
    (await getSecureStoreValue("accessToken")) ??
    useSessionStore.getState().accessToken
  );
}

async function getRefreshToken() {
  return (
    (await getSecureStoreValue("refreshToken")) ??
    useSessionStore.getState().refreshToken
  );
}

export async function getStoredUser() {
  const userJson = await getSecureStoreValue("user");
  if (!userJson) {
    return useSessionStore.getState().user;
  }

  try {
    return JSON.parse(userJson) as AuthUser;
  } catch {
    return useSessionStore.getState().user;
  }
}

export async function clearAppSession() {
  await unregisterNotificationDeviceBeforeSessionClear();
  await clearScheduledNotificationPreferencesForSession();
  await useSessionStore.getState().clearSession();
  queryClient.clear();
}

export function shouldClearSessionForAuthError(error: unknown) {
  return (
    error instanceof ApiClientError &&
    (error.status === 401 ||
      (error.status === 403 &&
        error.code != null &&
        SESSION_CLEARABLE_403_CODES.has(error.code)))
  );
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    const currentUser = await getStoredUser();

    if (!refreshToken || !currentUser) {
      return null;
    }

    const refreshClient = new ApiClient({
      baseUrl: API_BASE_URL,
      getAccessToken: async () => null,
    });

    try {
      const refreshed = await refreshClient.refresh({ refreshToken });

      await useSessionStore.getState().setSession({
        user: refreshed.user,
        accessToken: refreshed.tokens.accessToken,
        refreshToken: refreshed.tokens.refreshToken,
      });

      return refreshed.tokens.accessToken;
    } catch (error) {
      if (shouldClearSessionForAuthError(error)) {
        await clearAppSession();
        return null;
      }

      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken,
  refreshAccessToken,
  onAuthFailure: async () => {
    await clearAppSession();
  },
});

export { ApiClientError };
export { ApiNetworkError, isNetworkError };
