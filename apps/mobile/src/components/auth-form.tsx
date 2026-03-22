import React, { useState } from "react";
import * as Google from "expo-auth-session/providers/google";
import { SessionUrlProvider } from "expo-auth-session/build/SessionUrlProvider";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import {
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { ApiClientError, apiClient } from "../lib/api";
import { useTranslation } from "../i18n";
import { useSessionStore } from "../stores/session-store";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";
import { PrimaryButton } from "./button";
import { CardsIcon, PackIcon, QuestIcon } from "./icons";

WebBrowser.maybeCompleteAuthSession();

const sessionUrlProvider = new SessionUrlProvider();
const expoProxyProjectName = "@zax-code/adventure-time-native";
const expoProxyRedirectUri = sessionUrlProvider.getRedirectUrl({
  projectNameForProxy: expoProxyProjectName,
});
const expoProxyReturnUrl = sessionUrlProvider.getDefaultReturnUrl();

export function AuthForm() {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const [displayName, setDisplayName] = useState("Finn Fan");
  const [email, setEmail] = useState("finn@example.com");
  const [password, setPassword] = useState("password123");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
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
    if (
      submitError instanceof ApiClientError &&
      submitError.code === "ACCESS_REQUEST_PENDING"
    ) {
      return t("native.auth.googlePendingApproval");
    }

    if (submitError instanceof Error) {
      return submitError.message;
    }

    return t("native.auth.failed");
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
    if (
      !isExpoGo &&
      Platform.OS === "android" &&
      !process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
    ) {
      setError(t("native.auth.googleNotConfiguredAndroid"));
      return;
    }

    if (!request) {
      setError(t("native.auth.googleLoading"));
      return;
    }

    setGoogleLoading(true);
    setError(null);

    try {
      const result = await (isExpoGo
        ? (() => {
            if (!request.url) {
              throw new Error(t("native.auth.googleLoading"));
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
      const accessToken =
        result.authentication?.accessToken ?? result.params.access_token;
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
    <View className="w-full gap-4 rounded-3xl border border-primaryBorder bg-primaryBg p-6">
      {/* Card Header */}
      <View className="items-center gap-1">
        <Text className="font-nunito-bold text-xl text-primary">
          {t("authLogin.welcomeTo")}
        </Text>
        <Text className="font-nunito-extrabold text-3xl text-primary">
          {t("authLogin.gameTitle")}
        </Text>
      </View>

      {/* Description */}
      <View className="rounded-2xl border border-primaryTint bg-primaryBg p-4">
        <Text className="text-center font-nunito text-sm text-primaryText">
          {t("authLogin.description")}
        </Text>
      </View>

      {/* Feature Grid */}
      <View className="flex-row gap-2">
        <View className="flex-1 items-center gap-1.5 rounded-xl border border-infoBorder bg-infoTint p-2.5">
          <PackIcon size={24} color={tc.infoText} />
          <Text className="text-center font-nunito-semibold text-[11px] text-infoText">
            {t("authLogin.features.openPacks")}
          </Text>
        </View>
        <View className="flex-1 items-center gap-1.5 rounded-xl border border-accentBorder bg-accentTint p-2.5">
          <CardsIcon size={24} color={tc.accentText} />
          <Text className="text-center font-nunito-semibold text-[11px] text-accentText">
            {t("authLogin.features.collectCards")}
          </Text>
        </View>
        <View className="flex-1 items-center gap-1.5 rounded-xl border border-successBorder bg-successTint p-2.5">
          <QuestIcon size={24} color={tc.successDark} />
          <Text className="text-center font-nunito-semibold text-[11px] text-successDark">
            {t("authLogin.features.completeQuests")}
          </Text>
        </View>
      </View>

      {/* Tab Switcher + Form */}
      <View className="rounded-2xl border border-primaryTint bg-primaryBg p-3 gap-3">
        {/* Pills */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setMode("login")}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: mode === "login" ? tc.primaryDark : tc.surfaceMuted,
            }}
          >
            <Text
              style={{
                fontFamily: "Nunito-Bold",
                fontSize: 14,
                color: mode === "login" ? "white" : tc.primaryStrong,
              }}
            >
              {t("authLogin.tabs.signIn")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("register")}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: mode === "register" ? tc.primaryDark : tc.surfaceMuted,
            }}
          >
            <Text
              style={{
                fontFamily: "Nunito-Bold",
                fontSize: 14,
                color: mode === "register" ? "white" : tc.primaryStrong,
              }}
            >
              {t("authLogin.tabs.register")}
            </Text>
          </Pressable>
        </View>

        {/* Form Fields */}
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={t("authLogin.fields.email")}
          placeholderTextColor={tc.muted}
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder={
            mode === "register"
              ? t("authLogin.fields.passwordMin")
              : t("authLogin.fields.password")
          }
          placeholderTextColor={tc.muted}
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />
        {mode === "register" ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t("authLogin.fields.displayNameOptional")}
            placeholderTextColor={tc.muted}
            className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
          />
        ) : null}

        {error ? (
          <Text className="text-xs font-nunito-semibold text-danger">
            {error}
          </Text>
        ) : null}

        <PrimaryButton onPress={() => void submit()} loading={loading}>
          {mode === "login"
            ? t("authLogin.actions.signIn")
            : t("authLogin.actions.register")}
        </PrimaryButton>
      </View>

      {/* Google Button */}
      <View className="gap-3">
        <Text className="text-center font-nunito text-xs uppercase tracking-widest text-primaryText">
          {t("authLogin.actions.orContinueWithGoogle")}
        </Text>
        <TouchableOpacity
          onPress={() => void submitGoogle()}
          disabled={!request || loading || googleLoading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[tc.primary, tc.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderRadius: 999,
              paddingVertical: 16,
              paddingHorizontal: 24,
            }}
          >
            <Text
              style={{
                fontFamily: "Nunito-Bold",
                fontSize: 16,
                color: "white",
              }}
            >
              G
            </Text>
            <Text
              style={{
                fontFamily: "Nunito-Bold",
                fontSize: 16,
                color: "white",
              }}
            >
              {t("authLogin.actions.enterCandyKingdom")}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <Text className="text-center font-nunito text-sm text-primary">
        {t("authLogin.labels.madeWithLoveBy")}
      </Text>
    </View>
  );
}
