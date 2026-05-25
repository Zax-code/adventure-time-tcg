import * as SecureStore from "expo-secure-store";

import { ApiClient, ApiClientError } from "@adventure-time/api-client";

import { queryClient } from "./query-client";
import { useSessionStore } from "../stores/session-store";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://app.leaetzak.love";

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

export async function clearAppSession() {
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
    const currentUser = useSessionStore.getState().user;

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
