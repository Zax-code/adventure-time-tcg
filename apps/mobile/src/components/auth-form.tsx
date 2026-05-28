import React, { useEffect, useRef, useState } from "react";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as Google from "expo-auth-session/providers/google";
import { SessionUrlProvider } from "expo-auth-session/build/SessionUrlProvider";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ApiClientError, apiClient } from "../lib/api";
import { useTranslation } from "../i18n";
import { useLocaleStore } from "../stores/locale-store";
import { useSessionStore } from "../stores/session-store";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";
import { PrimaryButton } from "./button";
import { CardsIcon, PackIcon, QuestIcon } from "./icons";

WebBrowser.maybeCompleteAuthSession();

const sessionUrlProvider = new SessionUrlProvider();
const expoProxyProjectName = "@zax-code/adventure-time-tcg";
const expoProxyRedirectUri = sessionUrlProvider.getRedirectUrl({
  projectNameForProxy: expoProxyProjectName,
});
const expoProxyReturnUrl = sessionUrlProvider.getDefaultReturnUrl();
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type AuthMode = "login" | "register";
type AuthStage = "credentials" | "verify" | "pendingApproval";
type AuthFormPrefill = {
  email?: string;
  code?: string;
  locale?: "en" | "fr";
  mode?: "login" | "verify";
  autoVerify?: boolean;
};
let nativeGoogleConfigured = false;

function hasGoogleAuthConfig() {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return Boolean(googleWebClientId);
  }

  if (Platform.OS === "ios") {
    return Boolean(googleIosClientId || googleWebClientId);
  }

  if (Platform.OS === "android") {
    return Boolean(googleWebClientId);
  }

  return Boolean(googleWebClientId);
}

function configureNativeGoogleSignIn() {
  if (nativeGoogleConfigured || Platform.OS !== "android" || !googleWebClientId) {
    return;
  }

  GoogleSignin.configure({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
    offlineAccess: false,
  });
  nativeGoogleConfigured = true;
}

function GoogleSignInButton({
  disabled,
  onPress,
  tc,
  t,
}: {
  disabled: boolean;
  onPress: () => void;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  t: (key: string) => string;
}) {
  return (
    <View className="gap-3">
      <Text className="text-center font-nunito text-xs uppercase tracking-widest text-primaryText">
        {t("auth.actions.orContinueWithGoogle")}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
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
            {t("auth.actions.enterCandyKingdom")}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function BrowserGoogleAuthSection({
  loading,
  preferredLanguage,
  setError,
  setGoogleLoading,
  setSession,
  t,
  tc,
}: {
  loading: boolean;
  preferredLanguage: "en" | "fr";
  setError: (value: string | null) => void;
  setGoogleLoading: (value: boolean) => void;
  setSession: (params: {
    user: import("@adventure-time/api-client").AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  t: (key: string) => string;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
}) {
  const router = useRouter();
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const [request, response, promptAsync] = Google.useAuthRequest(
    isExpoGo
      ? {
          clientId: googleWebClientId,
          redirectUri: expoProxyRedirectUri,
          responseType: "token",
          scopes: ["openid", "profile", "email"],
          selectAccount: true,
          shouldAutoExchangeCode: false,
        }
      : {
          iosClientId: googleIosClientId,
          webClientId: googleWebClientId,
          scopes: ["openid", "profile", "email"],
          selectAccount: true,
        },
  );

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type !== "success") {
      setGoogleLoading(false);
      return;
    }

    const idToken = response.authentication?.idToken ?? response.params.id_token;
    const accessToken =
      response.authentication?.accessToken ?? response.params.access_token;

    if (!idToken && !accessToken) {
      setError("Google did not return a usable token.");
      setGoogleLoading(false);
      return;
    }

    let cancelled = false;

    async function finishGoogleAuth() {
      try {
        const authResult = await apiClient.googleAuth({
          idToken,
          accessToken,
          preferredLanguage,
        });

        if (cancelled) {
          return;
        }

        await setSession({
          user: authResult.user,
          accessToken: authResult.tokens.accessToken,
          refreshToken: authResult.tokens.refreshToken,
        });
        router.replace("/(tabs)");
      } catch (submitError) {
        if (!cancelled) {
          setError(
            submitError instanceof Error ? submitError.message : t("auth.errors.failed"),
          );
        }
      } finally {
        if (!cancelled) {
          setGoogleLoading(false);
        }
      }
    }

    void finishGoogleAuth();

    return () => {
      cancelled = true;
    };
  }, [
    preferredLanguage,
    response,
    router,
    setError,
    setGoogleLoading,
    setSession,
    t,
  ]);

  async function submitGoogle() {
    if (!hasGoogleAuthConfig()) {
      setError(t("auth.status.googleNotConfigured"));
      return;
    }

    if (!request) {
      setError(t("auth.status.googleLoading"));
      return;
    }

    setGoogleLoading(true);
    setError(null);

    try {
      const result = await (isExpoGo
        ? (() => {
            if (!request.url) {
              throw new Error(t("auth.status.googleLoading"));
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
        setGoogleLoading(false);
        return;
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("auth.errors.failed"));
      setGoogleLoading(false);
    }
  }

  return (
    <GoogleSignInButton
      disabled={!request || loading}
      onPress={() => void submitGoogle()}
      tc={tc}
      t={t}
    />
  );
}

function NativeGoogleAuthSection({
  loading,
  preferredLanguage,
  setError,
  setGoogleLoading,
  setSession,
  t,
  tc,
}: {
  loading: boolean;
  preferredLanguage: "en" | "fr";
  setError: (value: string | null) => void;
  setGoogleLoading: (value: boolean) => void;
  setSession: (params: {
    user: import("@adventure-time/api-client").AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  t: (key: string) => string;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
}) {
  const router = useRouter();

  async function submitGoogle() {
    if (!googleWebClientId) {
      setError(t("auth.status.googleNotConfigured"));
      return;
    }

    configureNativeGoogleSignIn();
    setGoogleLoading(true);
    setError(null);

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const response = await GoogleSignin.signIn();
      if (isCancelledResponse(response)) {
        return;
      }

      if (!isSuccessResponse(response)) {
        throw new Error(t("auth.errors.failed"));
      }

      const tokens = await GoogleSignin.getTokens();
      const idToken = response.data.idToken ?? tokens.idToken;
      const accessToken = tokens.accessToken;

      if (!idToken && !accessToken) {
        throw new Error("Google did not return a usable token.");
      }

      const authResult = await apiClient.googleAuth({
        idToken,
        accessToken,
        preferredLanguage,
      });

      await setSession({
        user: authResult.user,
        accessToken: authResult.tokens.accessToken,
        refreshToken: authResult.tokens.refreshToken,
      });
      router.replace("/(tabs)");
    } catch (submitError) {
      if (
        isErrorWithCode(submitError) &&
        submitError.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
      ) {
        setError(submitError.message);
      } else if (
        isErrorWithCode(submitError) &&
        submitError.code === statusCodes.IN_PROGRESS
      ) {
        setError(submitError.message);
      } else {
        setError(
          submitError instanceof Error ? submitError.message : t("auth.errors.failed"),
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <GoogleSignInButton
      disabled={loading}
      onPress={() => void submitGoogle()}
      tc={tc}
      t={t}
    />
  );
}

export function AuthForm({ prefill }: { prefill?: AuthFormPrefill }) {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const preferredLanguage = useLocaleStore((state) => state.locale);
  const setPreferredLanguage = useLocaleStore((state) => state.setLocale);
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const [displayName, setDisplayName] = useState("Finn Fan");
  const [email, setEmail] = useState("finn@example.com");
  const [password, setPassword] = useState("password123");
  const [verificationCode, setVerificationCode] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [stage, setStage] = useState<AuthStage>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleAuthConfigured = hasGoogleAuthConfig();
  const appliedPrefillRef = useRef(false);
  const autoVerifyTriggeredRef = useRef(false);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStage("credentials");
    setVerificationCode("");
    setError(null);
    setInfo(null);
  }

  function enterVerificationStage(
    nextInfo?: string | null,
    opts?: { preserveCode?: boolean },
  ) {
    setStage("verify");
    setMode("register");
    if (!opts?.preserveCode) {
      setVerificationCode("");
    }
    setError(null);
    setInfo(nextInfo ?? null);
  }

  function enterPendingApprovalStage(nextInfo?: string | null) {
    setStage("pendingApproval");
    setMode("login");
    setPassword("");
    setVerificationCode("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

  function returnToSignIn(nextInfo?: string | null) {
    setStage("credentials");
    setMode("login");
    setVerificationCode("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

  useEffect(() => {
    if (!prefill || appliedPrefillRef.current) {
      return;
    }

    appliedPrefillRef.current = true;

    if (prefill.locale && prefill.locale !== preferredLanguage) {
      void setPreferredLanguage(prefill.locale);
    }

    if (prefill.email) {
      setEmail(prefill.email);
    }

    if (prefill.code) {
      setVerificationCode(prefill.code);
    }

    if (prefill.mode === "verify") {
      enterVerificationStage(t("auth.status.deepLinkReady"), { preserveCode: true });
      return;
    }

    if (prefill.mode === "login" && prefill.email) {
      returnToSignIn(t("auth.status.emailVerifiedCanSignIn"));
    }
  }, [prefill, preferredLanguage, setPreferredLanguage, t]);

  useEffect(() => {
    if (
      !prefill?.autoVerify ||
      autoVerifyTriggeredRef.current ||
      stage !== "verify" ||
      !String(email).includes("@") ||
      !/^\d{6}$/.test(verificationCode)
    ) {
      return;
    }

    autoVerifyTriggeredRef.current = true;
    setInfo(t("auth.status.deepLinkVerifying"));
    void submit();
  }, [email, prefill?.autoVerify, stage, t, verificationCode]);

  function getFriendlyError(submitError: unknown) {
    if (submitError instanceof ApiClientError) {
      if (submitError.code === "ACCESS_REQUEST_PENDING") {
        if (stage === "verify" || mode === "register") {
          enterPendingApprovalStage(t("auth.status.emailVerifiedPendingApproval"));
          return t("auth.status.emailVerifiedPendingApproval");
        }

        return stage === "pendingApproval"
          ? t("auth.status.emailVerifiedPendingApproval")
          : t("auth.status.googlePendingApproval");
      }

      if (submitError.code === "EMAIL_VERIFICATION_REQUIRED") {
        enterVerificationStage(t("auth.status.verificationCodeSentCheckEmail"));
        return t("auth.status.verificationCodeSentCheckEmail");
      }
    }

    if (submitError instanceof Error) {
      return submitError.message;
    }

    return t("auth.errors.failed");
  }

  async function submit() {
    if (stage === "pendingApproval") {
      returnToSignIn(info);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (stage === "verify") {
        const result = await apiClient.verifyEmail({
          email,
          code: verificationCode,
        });

        if (result.authorized) {
          returnToSignIn(t("auth.status.emailVerifiedCanSignIn"));
        } else {
          enterPendingApprovalStage(t("auth.status.emailVerifiedPendingApproval"));
        }
        return;
      }

      if (mode === "login") {
        const result = await apiClient.login({ email, password });
        await setSession({
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        });
        router.replace("/(tabs)");
        return;
      }

      const result = await apiClient.register({
        email,
        password,
        displayName,
        preferredLanguage,
      });
      setVerificationCode("");
      enterVerificationStage(
        result.accessRequestPending
          ? t("auth.status.verificationCodeSentAccessRequested")
          : t("auth.status.verificationCodeSentCheckEmail"),
      );
    } catch (submitError) {
      setError(getFriendlyError(submitError));
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    setError(null);

    try {
      await apiClient.resendVerification({ email });
      setInfo(t("auth.status.newVerificationCodeSent"));
    } catch (submitError) {
      setError(getFriendlyError(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="w-full gap-4 rounded-3xl border border-primaryBorder bg-primaryBg p-6">
      <View className="items-center gap-1">
        <Text className="font-nunito-bold text-xl text-primary">
          {t("auth.welcomeTo")}
        </Text>
        <Text className="font-nunito-extrabold text-3xl text-primary">
          {t("auth.gameTitle")}
        </Text>
      </View>

      <View className="rounded-2xl border border-primaryTint bg-primaryBg p-4">
        <Text className="text-center font-nunito text-sm text-primaryText">
          {t("auth.description")}
        </Text>
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1 items-center gap-1.5 rounded-xl border border-infoBorder bg-infoTint p-2.5">
          <PackIcon size={24} color={tc.infoText} />
          <Text className="text-center font-nunito-semibold text-[11px] text-infoText">
            {t("auth.features.openPacks")}
          </Text>
        </View>
        <View className="flex-1 items-center gap-1.5 rounded-xl border border-accentBorder bg-accentTint p-2.5">
          <CardsIcon size={24} color={tc.accentText} />
          <Text className="text-center font-nunito-semibold text-[11px] text-accentText">
            {t("auth.features.collectCards")}
          </Text>
        </View>
        <View className="flex-1 items-center gap-1.5 rounded-xl border border-successBorder bg-successTint p-2.5">
          <QuestIcon size={24} color={tc.successDark} />
          <Text className="text-center font-nunito-semibold text-[11px] text-successDark">
            {t("auth.features.completeQuests")}
          </Text>
        </View>
      </View>

      <View className="rounded-2xl border border-primaryTint bg-primaryBg p-3 gap-3">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => switchMode("login")}
            disabled={stage === "pendingApproval"}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor:
                stage === "pendingApproval"
                  ? tc.surfaceMuted
                  : mode === "login"
                    ? tc.primaryDark
                    : tc.surfaceMuted,
            }}
          >
            <Text
              style={{
                fontFamily: "Nunito-Bold",
                fontSize: 14,
                color: mode === "login" ? "white" : tc.primaryStrong,
              }}
            >
              {t("auth.tabs.signIn")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode("register")}
            disabled={stage === "pendingApproval"}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor:
                stage === "pendingApproval"
                  ? tc.surfaceMuted
                  : mode === "register"
                    ? tc.primaryDark
                    : tc.surfaceMuted,
            }}
          >
            <Text
              style={{
                fontFamily: "Nunito-Bold",
                fontSize: 14,
                color: mode === "register" ? "white" : tc.primaryStrong,
              }}
            >
              {t("auth.tabs.register")}
            </Text>
          </Pressable>
        </View>

        <View className="gap-2">
          <Text className="font-nunito-bold text-sm text-primaryStrong">
            {t("auth.language.label")}
          </Text>
          <View className="flex-row gap-2">
            {(["en", "fr"] as const).map((language) => (
              <Pressable
                key={language}
                className={`flex-1 items-center rounded-full border px-4 py-3 ${
                  preferredLanguage === language
                    ? "border-primary bg-primary"
                    : "border-primaryBorder bg-primaryBg"
                }`}
                onPress={() => void setPreferredLanguage(language)}
              >
                <Text
                  className={`font-nunito-semibold ${
                    preferredLanguage === language
                      ? "text-white"
                      : "text-primaryText"
                  }`}
                >
                  {language === "fr"
                    ? t("settings.french")
                    : t("settings.english")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={t("auth.fields.email")}
          placeholderTextColor={tc.muted}
          editable={stage !== "pendingApproval"}
          className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
        />

        {stage === "verify" ? (
          <View className="gap-3 rounded-2xl border border-infoBorder bg-infoTint p-4">
            <Text className="font-nunito-bold text-base text-infoText">
              {t("auth.status.verifyTitle")}
            </Text>
            <Text className="font-nunito text-sm leading-6 text-infoText">
              {t("auth.status.verifyBody")}
            </Text>
          </View>
        ) : null}

        {stage === "verify" ? (
          <TextInput
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder={t("auth.fields.verificationCode")}
            placeholderTextColor={tc.muted}
            className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
          />
        ) : stage === "pendingApproval" ? (
          <View className="gap-3 rounded-2xl border border-successBorder bg-successTint p-4">
            <Text className="font-nunito-bold text-base text-successDark">
              {t("auth.status.pendingApprovalTitle")}
            </Text>
            <Text className="font-nunito text-sm leading-6 text-successDark">
              {t("auth.status.pendingApprovalBody")}
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={
                mode === "register"
                  ? t("auth.fields.passwordMin")
                  : t("auth.fields.password")
              }
              placeholderTextColor={tc.muted}
              className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
            />
            {mode === "register" ? (
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={t("auth.fields.displayNameOptional")}
                placeholderTextColor={tc.muted}
                className="rounded-2xl border border-primaryBorder bg-primaryBg px-4 py-3 font-nunito text-fg"
              />
            ) : null}
          </>
        )}

        {info ? (
          <Text className="text-xs font-nunito-semibold text-successDark">
            {info}
          </Text>
        ) : null}

        {error ? (
          <Text className="text-xs font-nunito-semibold text-danger">
            {error}
          </Text>
        ) : null}

        <PrimaryButton onPress={() => void submit()} loading={loading}>
          {stage === "pendingApproval"
            ? t("auth.actions.backToSignIn")
            : stage === "verify"
            ? t("auth.actions.verify")
            : mode === "login"
              ? t("auth.actions.signIn")
              : t("auth.actions.register")}
        </PrimaryButton>

        {stage === "verify" ? (
          <View className="gap-2">
            <Pressable onPress={() => void resendCode()} disabled={loading}>
              <Text className="text-center font-nunito-bold text-sm text-primaryStrong">
                {t("auth.actions.resendCode")}
              </Text>
            </Pressable>
            <Pressable onPress={() => switchMode("register")} disabled={loading}>
              <Text className="text-center font-nunito text-sm text-primary">
                {t("auth.actions.useDifferentEmail")}
              </Text>
            </Pressable>
          </View>
        ) : stage === "pendingApproval" ? (
          <Pressable onPress={() => returnToSignIn(info)} disabled={loading}>
            <Text className="text-center font-nunito text-sm text-primary">
              {t("auth.status.pendingApprovalFootnote")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {stage !== "credentials" || !googleAuthConfigured
        ? null
        : Platform.OS === "android" &&
            Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
          ? (
            <NativeGoogleAuthSection
              loading={loading || googleLoading}
              preferredLanguage={preferredLanguage}
              setError={setError}
              setGoogleLoading={setGoogleLoading}
              setSession={setSession}
              t={t}
              tc={tc}
            />
          )
          : (
            <BrowserGoogleAuthSection
              loading={loading || googleLoading}
              preferredLanguage={preferredLanguage}
              setError={setError}
              setGoogleLoading={setGoogleLoading}
              setSession={setSession}
              t={t}
              tc={tc}
            />
          )}

      <Text className="text-center font-nunito text-sm text-primary">
        {t("auth.labels.madeWithLoveBy")}
      </Text>
    </View>
  );
}
