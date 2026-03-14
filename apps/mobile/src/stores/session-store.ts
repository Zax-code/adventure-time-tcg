import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import type { AuthUser } from "@adventure-time/shared";

interface SessionState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setSession: (params: { user: AuthUser; accessToken: string; refreshToken: string }) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrateFromStorage: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  setHydrated(hydrated) {
    set({ hydrated });
  },
  async setSession({ user, accessToken, refreshToken }) {
    await Promise.all([
      SecureStore.setItemAsync("accessToken", accessToken),
      SecureStore.setItemAsync("refreshToken", refreshToken),
      SecureStore.setItemAsync("user", JSON.stringify(user)),
    ]);

    set({ user, accessToken, refreshToken, hydrated: true });
  },
  async clearSession() {
    await Promise.all([
      SecureStore.deleteItemAsync("accessToken"),
      SecureStore.deleteItemAsync("refreshToken"),
      SecureStore.deleteItemAsync("user"),
    ]);

    set({ user: null, accessToken: null, refreshToken: null, hydrated: true });
  },
  async hydrateFromStorage() {
    const [accessToken, refreshToken, userJson] = await Promise.all([
      SecureStore.getItemAsync("accessToken"),
      SecureStore.getItemAsync("refreshToken"),
      SecureStore.getItemAsync("user"),
    ]);

    set({
      accessToken,
      refreshToken,
      user: userJson ? JSON.parse(userJson) : null,
      hydrated: true,
    });
  },
}));
