import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import type { AuthUser } from "@adventure-time/api-client";

import { API_BASE_URL, apiClient } from "../src/lib/api";
import { useSessionStore } from "../src/stores/session-store";
import { THEME_COLORS } from "../src/theme/themes";
import { useThemeStore } from "../src/stores/theme-store";

const e2eAuthEnabled = process.env.EXPO_PUBLIC_E2E_AUTH === "1";
const e2eAuthEmail = process.env.EXPO_PUBLIC_E2E_EMAIL ?? "mobile-test@leaetzak.love";
const e2eAuthPassword = process.env.EXPO_PUBLIC_E2E_PASSCODE ?? "";

function decodeParam(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseSessionUser(serialized: string) {
  try {
    const parsed = JSON.parse(serialized) as Partial<AuthUser>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.preferredLanguage !== "string"
    ) {
      return null;
    }

    return parsed as AuthUser;
  } catch {
    return null;
  }
}

function parseRedirectHref(redirect: string): Href {
  const [pathnamePart, queryPart = ""] = redirect.split("?");
  const pathname = pathnamePart.trim();

  if (!pathname || !queryPart) {
    return (pathname || "/pvp") as Href;
  }

  const params = Object.fromEntries(new URLSearchParams(queryPart).entries());
  return { pathname, params } as Href;
}

export default function E2EAuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string;
    password?: string;
    redirect?: string;
  }>();
  const setSession = useSessionStore((state) => state.setSession);
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Starting test sign-in...");
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    let cancelled = false;
    const accessToken = decodeParam(
      (params as Record<string, string | string[] | undefined>).accessToken,
    );
    const refreshToken = decodeParam(
      (params as Record<string, string | string[] | undefined>).refreshToken,
    );
    const serializedUser = decodeParam(
      (params as Record<string, string | string[] | undefined>).user,
    );
    const email = decodeParam(params.email) ?? e2eAuthEmail;
    const password = decodeParam(params.password) ?? e2eAuthPassword;
    const redirectPath = parseRedirectHref(decodeParam(params.redirect) ?? "/pvp");

    const runAuth = async () => {
      if (!e2eAuthEnabled) {
        setError("E2E auth is disabled for this build.");
        return;
      }

      if (accessToken && refreshToken && serializedUser) {
        const sessionUser = parseSessionUser(serializedUser);
        if (!sessionUser) {
          setError("Invalid e2e session payload.");
          return;
        }

        setStatus("Applying precomputed test session...");
        await setSession({
          user: sessionUser,
          accessToken,
          refreshToken,
        });
        if (cancelled) return;
        setStatus("Opening requested screen...");
        router.replace(redirectPath);
        return;
      }

      if (!email || !password) {
        setError("Missing e2e auth credentials.");
        return;
      }

      setStatus("Signing in test account...");

      try {
        const result = await apiClient.login({ email, password });
        if (cancelled) return;
        await setSession({
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        });
        if (cancelled) return;
        setStatus("Opening requested screen...");
        router.replace(redirectPath);
      } catch (caughtError) {
        if (cancelled) return;
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to sign in test account.";
        setError(
          `${message} (email=${email}, passwordLength=${password.length}, baseUrl=${API_BASE_URL})`,
        );
      }
    };

    void runAuth();
    return () => {
      cancelled = true;
    };
  }, [
    params,
    router,
    setSession,
  ]);

  return (
    <View
      testID="e2e-auth-screen"
      className="flex-1 items-center justify-center px-6"
      style={{ backgroundColor: tc.bg }}
    >
      <View
        className="w-full max-w-md rounded-3xl border p-6"
        style={{
          backgroundColor: tc.surface,
          borderColor: error ? tc.dangerBorder : tc.primaryBorder,
        }}
      >
        <Text
          className="text-center font-nunito-bold text-2xl"
          style={{ color: error ? tc.dangerDark : tc.primaryStrong }}
        >
          {error ? "E2E auth failed" : "Preparing PvP validation"}
        </Text>

        <Text
          className="mt-3 text-center font-nunito text-base leading-6"
          style={{ color: error ? tc.dangerDark : tc.fg }}
        >
          {error ?? status}
        </Text>

        {!error ? (
          <View className="mt-6 items-center">
            <ActivityIndicator color={tc.primary} size="large" />
          </View>
        ) : null}
      </View>
    </View>
  );
}
