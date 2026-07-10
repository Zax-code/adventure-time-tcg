import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import type {
  AppleAuthInput,
  AuthUser,
  GoogleAuthInput,
  LoginInput,
} from "@adventure-time/api-client";

import {
  createAppleWebSession,
  createGoogleWebSession,
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
  loginWithGoogle: (input: GoogleAuthInput) => Promise<AuthUser>;
  loginWithApple: (input: AppleAuthInput) => Promise<AuthUser>;
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
  const loginWithGoogle = useCallback(
    (input: GoogleAuthInput) => createGoogleWebSession(input),
    [],
  );
  const loginWithApple = useCallback(
    (input: AppleAuthInput) => createAppleWebSession(input),
    [],
  );
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
      loginWithGoogle,
      loginWithApple,
      logout,
      restore,
    }),
    [auth, login, loginWithApple, loginWithGoogle, logout, restore],
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
