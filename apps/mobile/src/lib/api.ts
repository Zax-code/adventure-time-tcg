import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  ApiClient,
  ApiClientError,
  isNetworkError,
  type AuthUser,
} from "@adventure-time/api-client";

import { queryClient } from "./query-client";
import { clearScheduledNotificationPreferencesForSession } from "./app-notifications";
import { clearLocalStepSnapshotForUser } from "./local-step-snapshot";
import {
  clearStepQuestWidgetSnapshot,
  clearStepQuestWidgetSyncContext,
} from "./step-quest-widget";
import { unregisterNotificationDeviceBeforeSessionClear } from "./widget-refresh-push";
import { API_BASE_URL } from "./api-config";
import { useSessionStore } from "../stores/session-store";

export { API_BASE_URL };

let refreshPromise: Promise<string | null> | null = null;
let installationIdPromise: Promise<string> | null = null;
const REFRESH_TOKEN_RACE_RETRY_DELAY_MS = 300;
const INSTALLATION_ID_KEY = "installationId";
const SESSION_CLEARABLE_403_CODES = new Set([
  "ACCESS_REQUEST_PENDING",
  "EMAIL_VERIFICATION_REQUIRED",
]);

async function getSecureStoreValue(key: "accessToken" | "refreshToken" | "user") {
  return SecureStore.getItemAsync(key);
}

async function getInstallationId() {
  if (!installationIdPromise) {
    installationIdPromise = (async () => {
      const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);

      if (existing) {
        return existing;
      }

      const next = Crypto.randomUUID();
      await SecureStore.setItemAsync(INSTALLATION_ID_KEY, next);
      return next;
    })();
  }

  return installationIdPromise;
}

async function getClientHeaders() {
  const nativeBuildVersion = (
    Constants as { nativeBuildVersion?: string | null }
  ).nativeBuildVersion;
  const buildNumber =
    nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    "unknown";

  return {
    "User-Agent": `AdventureTimeNative/${buildNumber} (${Platform.OS}; ${
      Constants.expoConfig?.version ?? "unknown"
    })`,
    "X-Adventure-Time-Client": "native",
    "X-Adventure-Time-Platform": Platform.OS,
    "X-Adventure-Time-App-Version":
      Constants.expoConfig?.version ?? "unknown",
    "X-Adventure-Time-Build-Number": buildNumber,
    "X-Adventure-Time-Installation-Id": await getInstallationId(),
  };
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
  const currentUser = await getStoredUser();
  await Promise.all([
    unregisterNotificationDeviceBeforeSessionClear(),
    clearScheduledNotificationPreferencesForSession(),
    currentUser?.id
      ? clearLocalStepSnapshotForUser(currentUser.id)
      : Promise.resolve(),
    clearStepQuestWidgetSnapshot(),
    clearStepQuestWidgetSyncContext(),
  ]);
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

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function refreshSessionWithToken(refreshToken: string) {
  const refreshClient = new ApiClient({
    baseUrl: API_BASE_URL,
    getAccessToken: async () => null,
    getClientHeaders,
  });

  const refreshed = await refreshClient.refresh({ refreshToken });

  await useSessionStore.getState().setSession({
    user: refreshed.user,
    accessToken: refreshed.tokens.accessToken,
    refreshToken: refreshed.tokens.refreshToken,
  });

  return refreshed.tokens.accessToken;
}

async function getChangedRefreshToken(previousRefreshToken: string) {
  const latestRefreshToken = await getRefreshToken();

  if (latestRefreshToken && latestRefreshToken !== previousRefreshToken) {
    return latestRefreshToken;
  }

  return null;
}

async function refreshWithChangedStoredToken(previousRefreshToken: string) {
  const immediateRefreshToken =
    await getChangedRefreshToken(previousRefreshToken);

  if (immediateRefreshToken) {
    return refreshSessionWithToken(immediateRefreshToken);
  }

  await wait(REFRESH_TOKEN_RACE_RETRY_DELAY_MS);

  const delayedRefreshToken = await getChangedRefreshToken(previousRefreshToken);

  if (delayedRefreshToken) {
    return refreshSessionWithToken(delayedRefreshToken);
  }

  return null;
}

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const [refreshToken, currentUser] = await Promise.all([
      getRefreshToken(),
      getStoredUser(),
    ]);

    if (!refreshToken || !currentUser) {
      return null;
    }

    try {
      return await refreshSessionWithToken(refreshToken);
    } catch (error) {
      if (shouldClearSessionForAuthError(error)) {
        try {
          const recoveredToken =
            await refreshWithChangedStoredToken(refreshToken);

          if (recoveredToken) {
            return recoveredToken;
          }
        } catch (retryError) {
          if (!shouldClearSessionForAuthError(retryError)) {
            throw retryError;
          }
        }

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
  getClientHeaders,
  refreshAccessToken,
  onAuthFailure: async () => {
    await clearAppSession();
  },
});

export { ApiClientError };
export { isNetworkError };
