import React, { useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import { SessionUrlProvider } from "expo-auth-session/build/SessionUrlProvider";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View, Platform } from "react-native";

import { ApiClientError, apiClient } from "../lib/api";
import { useSessionStore } from "../stores/session-store";
import { GhostButton, PrimaryButton } from "./button";

WebBrowser.maybeCompleteAuthSession();

const sessionUrlProvider = new SessionUrlProvider();
const expoProxyProjectName = "@zax-code/adventure-time-native";
const expoProxyRedirectUri = sessionUrlProvider.getRedirectUrl({ projectNameForProxy: expoProxyProjectName });
const expoProxyReturnUrl = sessionUrlProvider.getDefaultReturnUrl();

export function AuthForm() {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const [displayName, setDisplayName] = useState("Finn Fan");
  const [email, setEmail] = useState("finn@example.com");
  const [password, setPassword] = useState("password123");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const [request, _response, promptAsync] = Google.useAuthRequest(
    isExpoGo
      ? {
          clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          redirectUri: expoProxyRedirectUri,
          responseType: "token",
          scopes: ["openid", "profile", "email"],
          selectAccount: true,
          shouldAutoExchangeCode: false,
        }
      : {
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
          androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
          webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
          scopes: ["openid", "profile", "email"],
          selectAccount: true,
        },
  );

  function getFriendlyError(submitError: unknown) {
    if (submitError instanceof ApiClientError && submitError.code === "ACCESS_REQUEST_PENDING") {
      return "This Google account is pending approval. Your access request has been submitted.";
    }

    if (submitError instanceof Error) {
      return submitError.message;
    }

    return "Authentication failed";
  }

  async function submit() {
    setLoading(true);
    setError(null);

    try {
      const result =
        mode === "login"
          ? await apiClient.login({ email, password })
          : await apiClient.register({ email, password, displayName });

      await setSession({
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
      router.replace("/(tabs)");
    } catch (submitError) {
      setError(getFriendlyError(submitError));
    } finally {
      setLoading(false);
    }
  }

  async function submitGoogle() {
    if (!isExpoGo && Platform.OS === "android" && !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) {
      setError("Google sign-in is not configured for Android yet.");
      return;
    }

    if (!request) {
      setError("Google sign-in is still loading. Please try again.");
      return;
    }

    setGoogleLoading(true);
    setError(null);

    try {
      const result = await (isExpoGo
        ? (() => {
            if (!request.url) {
              throw new Error("Google sign-in is still loading. Please try again.");
            }

            return WebBrowser.openAuthSessionAsync(
              sessionUrlProvider.getStartUrl(
                request.url,
                expoProxyReturnUrl,
                Constants.expoConfig?.originalFullName ?? expoProxyProjectName,
              ),
              expoProxyReturnUrl,
            ).then((webResult) => {
              if (webResult.type !== "success") {
                return { type: webResult.type };
              }

              return request.parseReturnUrl(webResult.url);
            });
          })()
        : promptAsync());

      if (result.type !== "success") {
        return;
      }

      const idToken = result.authentication?.idToken ?? result.params.id_token;
      const accessToken = result.authentication?.accessToken ?? result.params.access_token;
      if (!idToken && !accessToken) {
        throw new Error("Google did not return a usable token.");
      }

      const authResult = await apiClient.googleAuth({ idToken, accessToken });
      await setSession({
        user: authResult.user,
        accessToken: authResult.tokens.accessToken,
        refreshToken: authResult.tokens.refreshToken,
      });
      router.replace("/(tabs)");
    } catch (submitError) {
      setError(getFriendlyError(submitError));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View className="w-full gap-3 rounded-3xl border border-primaryBorder bg-white p-6">
      <Text className="font-nunito-extrabold text-3xl text-fg">Adventure Time</Text>
      <Text className="font-nunito text-base text-fgMuted">
        Sign in to the new native-first build.
      </Text>
      {mode === "register" ? (
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor="#9CA3AF"
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        placeholder="Email"
        placeholderTextColor="#9CA3AF"
        className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#9CA3AF"
        className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
      />
      {error ? <Text className="text-sm text-red-700">{error}</Text> : null}
      <PrimaryButton onPress={() => void submit()} loading={loading}>
        {mode === "login" ? "Login" : "Create account"}
      </PrimaryButton>
      <GhostButton onPress={() => void submitGoogle()} loading={googleLoading} disabled={!request || loading}>
        Continue with Google
      </GhostButton>
      <Pressable onPress={() => setMode((current) => (current === "login" ? "register" : "login"))}>
        <Text className="text-center font-nunito text-sm text-primaryText">
          {mode === "login"
            ? "Need an account? Register"
            : "Already have an account? Login"}
        </Text>
      </Pressable>
    </View>
  );
}
