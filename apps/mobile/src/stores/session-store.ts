import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { AuthUser } from "@adventure-time/api-client";

import { runStartupTask } from "../lib/startup-recovery";
import { useLocaleStore } from "./locale-store";

const SESSION_SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const;
const SESSION_ACCESSIBILITY_MIGRATION_KEY =
  "sessionAfterFirstUnlockMigrationV1";

export type BootstrapPhase = "hydrating" | "restoring" | "ready" | "error";
type BootstrapFailure = "rejected" | "timeout" | null;

interface SessionState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  bootstrapPhase: BootstrapPhase;
  bootstrapFailure: BootstrapFailure;
  bootstrapAttempt: number;
  setHydrated: (hydrated: boolean) => void;
  setBootstrapPhase: (bootstrapPhase: BootstrapPhase) => void;
  retryBootstrap: () => void;
  setSession: (params: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  setUser: (user: AuthUser) => Promise<void>;
  patchUser: (updates: Partial<AuthUser>) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrateFromStorage: () => Promise<boolean>;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  bootstrapPhase: "hydrating",
  bootstrapFailure: null,
  bootstrapAttempt: 0,
  setHydrated(hydrated) {
    set({ hydrated });
  },
  setBootstrapPhase(bootstrapPhase) {
    set({ bootstrapPhase });
  },
  retryBootstrap() {
    set((state) => ({
      hydrated: false,
      bootstrapPhase: "hydrating",
      bootstrapFailure: null,
      bootstrapAttempt: state.bootstrapAttempt + 1,
    }));
  },
  async setSession({ user, accessToken, refreshToken }) {
    const persistenceResult = await runStartupTask(() =>
      Promise.all([
        SecureStore.setItemAsync(
          "accessToken",
          accessToken,
          SESSION_SECURE_STORE_OPTIONS,
        ),
        SecureStore.setItemAsync(
          "refreshToken",
          refreshToken,
          SESSION_SECURE_STORE_OPTIONS,
        ),
        SecureStore.setItemAsync(
          "user",
          JSON.stringify(user),
          SESSION_SECURE_STORE_OPTIONS,
        ),
        SecureStore.setItemAsync(
          SESSION_ACCESSIBILITY_MIGRATION_KEY,
          "1",
          SESSION_SECURE_STORE_OPTIONS,
        ),
      ]),
    );

    if (!persistenceResult.ok) {
      console.warn(
        `[startup] Session persistence ${persistenceResult.reason}; continuing with the in-memory session.`,
      );
    }

    await useLocaleStore.getState().setLocale(user.preferredLanguage);

    set({
      user,
      accessToken,
      refreshToken,
      hydrated: true,
      bootstrapPhase: "ready",
      bootstrapFailure: null,
    });
  },
  async setUser(user) {
    const persistenceResult = await runStartupTask(() =>
      SecureStore.setItemAsync(
        "user",
        JSON.stringify(user),
        SESSION_SECURE_STORE_OPTIONS,
      ),
    );
    if (!persistenceResult.ok) {
      console.warn(
        `[startup] User persistence ${persistenceResult.reason}; continuing with the in-memory user.`,
      );
    }
    await useLocaleStore.getState().setLocale(user.preferredLanguage);

    set({
      user,
      hydrated: true,
      bootstrapPhase: "ready",
      bootstrapFailure: null,
    });
  },
  async patchUser(updates) {
    const currentUser = useSessionStore.getState().user;
    if (!currentUser) return;

    const nextUser: AuthUser = { ...currentUser, ...updates };
    const persistenceResult = await runStartupTask(() =>
      SecureStore.setItemAsync(
        "user",
        JSON.stringify(nextUser),
        SESSION_SECURE_STORE_OPTIONS,
      ),
    );
    if (!persistenceResult.ok) {
      console.warn(
        `[startup] User persistence ${persistenceResult.reason}; continuing with the in-memory user.`,
      );
    }
    await useLocaleStore.getState().setLocale(nextUser.preferredLanguage);
    set({
      user: nextUser,
      hydrated: true,
      bootstrapPhase: "ready",
      bootstrapFailure: null,
    });
  },
  async clearSession() {
    const persistenceResult = await runStartupTask(() =>
      Promise.all([
        SecureStore.deleteItemAsync("accessToken"),
        SecureStore.deleteItemAsync("refreshToken"),
        SecureStore.deleteItemAsync("user"),
      ]),
    );
    if (!persistenceResult.ok) {
      console.warn(
        `[startup] Session cleanup ${persistenceResult.reason}; clearing the in-memory session.`,
      );
    }

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: true,
      bootstrapPhase: "ready",
      bootstrapFailure: null,
    });
  },
  async hydrateFromStorage() {
    const result = await runStartupTask(async () => {
      const [accessToken, refreshToken, userJson, migrationComplete] =
        await Promise.all([
          SecureStore.getItemAsync("accessToken"),
          SecureStore.getItemAsync("refreshToken"),
          SecureStore.getItemAsync("user"),
          SecureStore.getItemAsync(SESSION_ACCESSIBILITY_MIGRATION_KEY),
        ]);

      if (migrationComplete !== "1") {
        const migrationWrites: Array<Promise<void>> = [];
        if (accessToken) {
          migrationWrites.push(
            SecureStore.setItemAsync(
              "accessToken",
              accessToken,
              SESSION_SECURE_STORE_OPTIONS,
            ),
          );
        }
        if (refreshToken) {
          migrationWrites.push(
            SecureStore.setItemAsync(
              "refreshToken",
              refreshToken,
              SESSION_SECURE_STORE_OPTIONS,
            ),
          );
        }
        if (userJson) {
          migrationWrites.push(
            SecureStore.setItemAsync(
              "user",
              userJson,
              SESSION_SECURE_STORE_OPTIONS,
            ),
          );
        }
        migrationWrites.push(
          SecureStore.setItemAsync(
            SESSION_ACCESSIBILITY_MIGRATION_KEY,
            "1",
            SESSION_SECURE_STORE_OPTIONS,
          ),
        );
        await Promise.all(migrationWrites);
      }

      let user: AuthUser | null = null;
      if (userJson) {
        try {
          user = JSON.parse(userJson) as AuthUser;
        } catch {
          await Promise.all([
            SecureStore.deleteItemAsync("accessToken"),
            SecureStore.deleteItemAsync("refreshToken"),
            SecureStore.deleteItemAsync("user"),
          ]);
          return { accessToken: null, refreshToken: null, user: null };
        }
      }

      return { accessToken, refreshToken, user };
    });

    if (!result.ok) {
      set({
        hydrated: true,
        bootstrapPhase: "error",
        bootstrapFailure: result.reason,
      });
      return false;
    }

    set({
      ...result.value,
      hydrated: true,
      bootstrapPhase: "hydrating",
      bootstrapFailure: null,
    });
    return true;
  },
}));
