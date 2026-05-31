import * as SecureStore from "expo-secure-store";

import {
  ApiClient,
  ApiClientError,
  type AuthUser,
} from "@adventure-time/api-client";

import { queryClient } from "./query-client";
import { unregisterNotificationDeviceBeforeSessionClear } from "./widget-refresh-push";
import { API_BASE_URL } from "./api-config";
import { useSessionStore } from "../stores/session-store";

export { API_BASE_URL };

let refreshPromise: Promise<string | null> | null = null;

export async function getAccessToken() {
  return (
    useSessionStore.getState().accessToken ??
    (await SecureStore.getItemAsync("accessToken"))
  );
}

async function getRefreshToken() {
  return (
    useSessionStore.getState().refreshToken ??
    (await SecureStore.getItemAsync("refreshToken"))
  );
}

export async function getStoredUser() {
  const inMemoryUser = useSessionStore.getState().user;
  if (inMemoryUser) {
    return inMemoryUser;
  }

  const userJson = await SecureStore.getItemAsync("user");
  if (!userJson) {
    return null;
  }

  try {
    return JSON.parse(userJson) as AuthUser;
  } catch {
    return null;
  }
}

export async function clearAppSession() {
  await unregisterNotificationDeviceBeforeSessionClear();
  await useSessionStore.getState().clearSession();
  queryClient.clear();
}

export function shouldClearSessionForAuthError(error: unknown) {
  return (
    error instanceof ApiClientError &&
    (error.status === 401 || error.status === 403)
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
