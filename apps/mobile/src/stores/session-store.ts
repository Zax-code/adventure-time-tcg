import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { AuthUser } from "@adventure-time/api-client";

import { useLocaleStore } from "./locale-store";

const SESSION_SECURE_STORE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
} as const;

interface SessionState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  bootstrapPhase: "hydrating" | "restoring" | "ready";
  setHydrated: (hydrated: boolean) => void;
  setBootstrapPhase: (
    bootstrapPhase: SessionState["bootstrapPhase"],
  ) => void;
  setSession: (params: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  setUser: (user: AuthUser) => Promise<void>;
  patchUser: (updates: Partial<AuthUser>) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  bootstrapPhase: "hydrating",
  setHydrated(hydrated) {
    set({ hydrated });
  },
  setBootstrapPhase(bootstrapPhase) {
    set({ bootstrapPhase });
  },
  async setSession({ user, accessToken, refreshToken }) {
    await Promise.all([
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
    ]);

    await useLocaleStore.getState().setLocale(user.preferredLanguage);

    set({
      user,
      accessToken,
      refreshToken,
      hydrated: true,
      bootstrapPhase: "ready",
    });
  },
  async setUser(user) {
    await SecureStore.setItemAsync(
      "user",
      JSON.stringify(user),
      SESSION_SECURE_STORE_OPTIONS,
    );
    await useLocaleStore.getState().setLocale(user.preferredLanguage);

    set({ user, hydrated: true, bootstrapPhase: "ready" });
  },
  async patchUser(updates) {
    const currentUser = useSessionStore.getState().user;
    if (!currentUser) return;

    const nextUser: AuthUser = { ...currentUser, ...updates };
    await SecureStore.setItemAsync(
      "user",
      JSON.stringify(nextUser),
      SESSION_SECURE_STORE_OPTIONS,
    );
    await useLocaleStore.getState().setLocale(nextUser.preferredLanguage);
    set({ user: nextUser, hydrated: true, bootstrapPhase: "ready" });
  },
  async clearSession() {
    await Promise.all([
      SecureStore.deleteItemAsync("accessToken"),
      SecureStore.deleteItemAsync("refreshToken"),
      SecureStore.deleteItemAsync("user"),
    ]);

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: true,
      bootstrapPhase: "ready",
    });
  },
  async hydrateFromStorage() {
    const [accessToken, refreshToken, userJson] = await Promise.all([
      SecureStore.getItemAsync("accessToken"),
      SecureStore.getItemAsync("refreshToken"),
      SecureStore.getItemAsync("user"),
    ]);

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
        SecureStore.setItemAsync("user", userJson, SESSION_SECURE_STORE_OPTIONS),
      );
    }
    if (migrationWrites.length > 0) {
      await Promise.all(migrationWrites);
    }

    set({
      accessToken,
      refreshToken,
      user: userJson ? JSON.parse(userJson) : null,
      hydrated: true,
      bootstrapPhase: "hydrating",
    });
  },
}));
