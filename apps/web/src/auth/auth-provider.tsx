import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import type { AuthUser, LoginInput } from "@adventure-time/api-client";

import {
  createWebSession,
  destroyWebSession,
  getAuthSnapshot,
  restoreWebSession,
  subscribeToAuth,
  type AuthStatus,
} from "./session";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  restoreError: string | null;
  login: (input: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  restore: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const auth = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getAuthSnapshot,
  );
  const login = useCallback((input: LoginInput) => createWebSession(input), []);
  const logout = useCallback(() => destroyWebSession(), []);
  const restore = useCallback(() => restoreWebSession(), []);

  useEffect(() => {
    if (auth.status === "restoring") {
      void restore();
    }
  }, [auth.status, restore]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: auth.status,
      user: auth.user,
      restoreError: auth.restoreError,
      login,
      logout,
      restore,
    }),
    [auth, login, logout, restore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
