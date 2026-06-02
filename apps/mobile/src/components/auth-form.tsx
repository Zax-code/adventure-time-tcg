import React, { useEffect, useEffectEvent, useRef, useState } from "react";
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
import { SectionErrorState } from "./error-state";
import { ApiClientError, apiClient, isNetworkError } from "../lib/api";
import { useTranslation } from "../i18n";
import { useLocaleStore } from "../stores/locale-store";
import { useSessionStore } from "../stores/session-store";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";
import { PrimaryButton } from "./button";
import { ThemedExpoTextInput } from "./expo-ui/themed-text-input";
import { CardsIcon, PackIcon, QuestIcon } from "./icons";
import { KeyboardScreenView } from "./keyboard-screen-view";

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
type AuthStage =
  | "credentials"
  | "verify"
  | "pendingApproval"
  | "resetRequest"
  | "resetPassword";
type AuthFormPrefill = {
  email?: string;
  code?: string;
  locale?: "en" | "fr";
  mode?: "login" | "verify" | "reset-password";
  autoVerify?: boolean;
};
type AuthErrorOptions = {
  cause?: unknown;
  onRetry?: () => void;
};

type AuthFormInitialState = {
  email: string;
  verificationCode: string;
  mode: AuthMode;
  stage: AuthStage;
  info: string | null;
};

let nativeGoogleConfigured = false;

function buildAuthFormInitialState(
  prefill: AuthFormPrefill | undefined,
  t: (key: string) => string,
): AuthFormInitialState {
  let mode: AuthMode = "login";
  let stage: AuthStage = "credentials";
  let info: string | null = null;

  if (prefill?.mode === "verify") {
    mode = "register";
    stage = "verify";
    info = t("auth.status.deepLinkReady");
  } else if (prefill?.mode === "reset-password") {
    stage = "resetPassword";
    info = t("auth.status.deepLinkResetReady");
  } else if (prefill?.mode === "login" && prefill.email) {
    info = t("auth.status.emailVerifiedCanSignIn");
  }

  return {
    email: prefill?.email ?? "finn@example.com",
    verificationCode: prefill?.code ?? "",
    mode,
    stage,
    info,
  };
}

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
  setError: (value: string | null, options?: AuthErrorOptions) => void;
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
  const retryGoogleAuth = useEffectEvent(
    async (idToken?: string, accessToken?: string) => {
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
    },
  );
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
        if (cancelled) {
          return;
        }

        await retryGoogleAuth(idToken, accessToken);
      } catch (submitError) {
        if (!cancelled) {
          setError(
            submitError instanceof Error ? submitError.message : t("auth.errors.failed"),
            {
              cause: submitError,
              onRetry: () => void finishGoogleAuth(),
            },
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
      setError(
        submitError instanceof Error ? submitError.message : t("auth.errors.failed"),
        {
          cause: submitError,
          onRetry: () => void submitGoogle(),
        },
      );
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
  setError: (value: string | null, options?: AuthErrorOptions) => void;
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
          {
            cause: submitError,
            onRetry: () => void submitGoogle(),
          },
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
  const preferredLanguage = useLocaleStore((state) => state.locale);
  const setPreferredLanguage = useLocaleStore((state) => state.setLocale);

  useEffect(() => {
    if (prefill?.locale && prefill.locale !== preferredLanguage) {
      void setPreferredLanguage(prefill.locale);
    }
  }, [prefill?.locale, preferredLanguage, setPreferredLanguage]);

  const prefillKey = JSON.stringify(prefill ?? {});

  return <AuthFormInner key={prefillKey} prefill={prefill} />;
}

function AuthFormInner({ prefill }: { prefill?: AuthFormPrefill }) {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const preferredLanguage = useLocaleStore((state) => state.locale);
  const setPreferredLanguage = useLocaleStore((state) => state.setLocale);
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const initialState = buildAuthFormInitialState(prefill, t);
  const [displayName, setDisplayName] = useState("Finn Fan");
  const [email, setEmail] = useState(initialState.email);
  const [password, setPassword] = useState("password123");
  const [verificationCode, setVerificationCode] = useState(
    initialState.verificationCode,
  );
  const [resetPassword, setResetPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>(initialState.mode);
  const [stage, setStage] = useState<AuthStage>(initialState.stage);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCause, setErrorCause] = useState<unknown>(null);
  const [errorRetry, setErrorRetry] = useState<(() => void) | null>(null);
  const [info, setInfo] = useState<string | null>(initialState.info);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);
  const googleAuthConfigured = hasGoogleAuthConfig();
  const autoVerifyTriggeredRef = useRef(false);
  const submitAutoVerify = useEffectEvent(() => {
    void submit();
  });

  function setError(value: string | null, options?: AuthErrorOptions) {
    if (!value) {
      setErrorMessage(null);
      setErrorCause(null);
      setErrorRetry(null);
      return;
    }

    setErrorMessage(value);
    setErrorCause(options?.cause);
    setErrorRetry(() => options?.onRetry ?? null);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStage("credentials");
    setVerificationCode("");
    setResetPassword("");
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
    setResetPassword("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

  function enterPendingApprovalStage(nextInfo?: string | null) {
    setStage("pendingApproval");
    setMode("login");
    setPassword("");
    setVerificationCode("");
    setResetPassword("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

  function returnToSignIn(nextInfo?: string | null) {
    setStage("credentials");
    setMode("login");
    setPassword("");
    setVerificationCode("");
    setResetPassword("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

  function enterResetRequestStage(nextInfo?: string | null) {
    setStage("resetRequest");
    setMode("login");
    setPassword("");
    setVerificationCode("");
    setResetPassword("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

  function enterResetPasswordStage(
    nextInfo?: string | null,
    opts?: { preserveCode?: boolean },
  ) {
    setStage("resetPassword");
    setMode("login");
    setPassword("");
    if (!opts?.preserveCode) {
      setVerificationCode("");
    }
    setResetPassword("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

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
    submitAutoVerify();
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

    if (isNetworkError(submitError)) {
      return t("auth.errors.networkFallback");
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

      if (stage === "resetRequest") {
        await apiClient.requestPasswordReset({ email });
        setVerificationCode("");
        enterResetPasswordStage(t("auth.status.resetLinkSentCheckEmail"));
        return;
      }

      if (stage === "resetPassword") {
        await apiClient.resetPassword({
          email,
          code: verificationCode,
          password: resetPassword,
        });
        returnToSignIn(t("auth.status.passwordResetSuccess"));
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
      setError(getFriendlyError(submitError), {
        cause: submitError,
        onRetry: () => void submit(),
      });
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    setError(null);

    try {
      if (stage === "resetPassword") {
        await apiClient.requestPasswordReset({ email });
        setInfo(t("auth.status.newResetCodeSent"));
      } else {
        await apiClient.resendVerification({ email });
        setInfo(t("auth.status.newVerificationCodeSent"));
      }
    } catch (submitError) {
      setError(getFriendlyError(submitError), {
        cause: submitError,
        onRetry: () => void resendCode(),
      });
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

        <KeyboardScreenView fill={false}>
          <View className="gap-3">
            <ThemedExpoTextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              testID="auth-email-input"
              placeholder={t("auth.fields.email")}
              editable={stage !== "pendingApproval"}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              hostStyle={{ width: "100%" }}
              style={{
                backgroundColor: tc.primaryBg,
                borderColor: tc.primaryBorder,
                borderRadius: 16,
                borderWidth: 1,
                height: 50,
                paddingHorizontal: 16,
                width: "100%",
              }}
              textStyle={{
                color: tc.fg,
                fontFamily: "Nunito_400Regular",
                fontSize: 16,
              }}
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
            ) : stage === "resetRequest" ? (
              <View className="gap-3 rounded-2xl border border-infoBorder bg-infoTint p-4">
                <Text className="font-nunito-bold text-base text-infoText">
                  {t("auth.status.resetRequestTitle")}
                </Text>
                <Text className="font-nunito text-sm leading-6 text-infoText">
                  {t("auth.status.resetRequestBody")}
                </Text>
              </View>
            ) : stage === "resetPassword" ? (
              <View className="gap-3 rounded-2xl border border-infoBorder bg-infoTint p-4">
                <Text className="font-nunito-bold text-base text-infoText">
                  {t("auth.status.resetReadyTitle")}
                </Text>
                <Text className="font-nunito text-sm leading-6 text-infoText">
                  {t("auth.status.resetReadyBody")}
                </Text>
              </View>
            ) : null}

            {stage === "verify" ? (
              <ThemedExpoTextInput
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder={t("auth.fields.verificationCode")}
                hostStyle={{ width: "100%" }}
                style={{
                  backgroundColor: tc.primaryBg,
                  borderColor: tc.primaryBorder,
                  borderRadius: 16,
                  borderWidth: 1,
                  height: 50,
                  paddingHorizontal: 16,
                  width: "100%",
                }}
                textStyle={{
                  color: tc.fg,
                  fontFamily: "Nunito_400Regular",
                  fontSize: 16,
                }}
              />
            ) : stage === "resetPassword" ? (
              <>
                <ThemedExpoTextInput
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder={t("auth.fields.verificationCode")}
                  hostStyle={{ width: "100%" }}
                  style={{
                    backgroundColor: tc.primaryBg,
                    borderColor: tc.primaryBorder,
                    borderRadius: 16,
                    borderWidth: 1,
                    height: 50,
                    paddingHorizontal: 16,
                    width: "100%",
                  }}
                  textStyle={{
                    color: tc.fg,
                    fontFamily: "Nunito_400Regular",
                    fontSize: 16,
                  }}
                />
                <ThemedExpoTextInput
                  value={resetPassword}
                  onChangeText={setResetPassword}
                  secureTextEntry
                  placeholder={t("auth.fields.newPassword")}
                  autoComplete="new-password"
                  hostStyle={{ width: "100%" }}
                  style={{
                    backgroundColor: tc.primaryBg,
                    borderColor: tc.primaryBorder,
                    borderRadius: 16,
                    borderWidth: 1,
                    height: 50,
                    paddingHorizontal: 16,
                    width: "100%",
                  }}
                  textStyle={{
                    color: tc.fg,
                    fontFamily: "Nunito_400Regular",
                    fontSize: 16,
                  }}
                />
              </>
            ) : stage === "pendingApproval" ? (
              <View className="gap-3 rounded-2xl border border-successBorder bg-successTint p-4">
                <Text className="font-nunito-bold text-base text-successDark">
                  {t("auth.status.pendingApprovalTitle")}
                </Text>
                <Text className="font-nunito text-sm leading-6 text-successDark">
                  {t("auth.status.pendingApprovalBody")}
                </Text>
              </View>
            ) : stage === "resetRequest" ? null : (
              <>
                <ThemedExpoTextInput
                  value={password}
                  onChangeText={setPassword}
                  inputRef={passwordInputRef}
                  secureTextEntry
                  testID="auth-password-input"
                  placeholder={
                    mode === "register"
                      ? t("auth.fields.passwordMin")
                      : t("auth.fields.password")
                  }
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  returnKeyType={mode === "login" ? "go" : "next"}
                  onSubmitEditing={() => {
                    if (mode === "login") {
                      void submit();
                    }
                  }}
                  hostStyle={{ width: "100%" }}
                  style={{
                    backgroundColor: tc.primaryBg,
                    borderColor: tc.primaryBorder,
                    borderRadius: 16,
                    borderWidth: 1,
                    height: 50,
                    paddingHorizontal: 16,
                    width: "100%",
                  }}
                  textStyle={{
                    color: tc.fg,
                    fontFamily: "Nunito_400Regular",
                    fontSize: 16,
                  }}
                />
                {mode === "register" ? (
                  <ThemedExpoTextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder={t("auth.fields.displayNameOptional")}
                    hostStyle={{ width: "100%" }}
                    style={{
                      backgroundColor: tc.primaryBg,
                      borderColor: tc.primaryBorder,
                      borderRadius: 16,
                      borderWidth: 1,
                      height: 50,
                      paddingHorizontal: 16,
                      width: "100%",
                    }}
                    textStyle={{
                      color: tc.fg,
                      fontFamily: "Nunito_400Regular",
                      fontSize: 16,
                    }}
                  />
                ) : null}
              </>
            )}
          </View>
        </KeyboardScreenView>

        {info ? (
          <Text className="text-xs font-nunito-semibold text-successDark">
            {info}
          </Text>
        ) : null}

        {errorMessage && isNetworkError(errorCause) ? (
          <SectionErrorState
            error={errorCause}
            title={t("auth.errors.networkTitle")}
            body={t("auth.errors.networkBody")}
            detail={t("auth.errors.networkDetail")}
            retryLabel={t("auth.errors.networkAction")}
            onRetry={errorRetry ?? (() => void submit())}
          />
        ) : errorMessage ? (
          <View className="rounded-2xl border border-dangerBorder bg-dangerTint px-4 py-3">
            <Text className="font-nunito-bold text-sm text-dangerDark">
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <PrimaryButton
          onPress={() => void submit()}
          loading={loading}
          testID="auth-submit-button"
        >
          {stage === "pendingApproval"
            ? t("auth.actions.backToSignIn")
            : stage === "verify"
              ? t("auth.actions.verify")
              : stage === "resetRequest"
                ? t("auth.actions.sendResetLink")
                : stage === "resetPassword"
                  ? t("auth.actions.resetPassword")
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
        ) : stage === "resetRequest" ? (
          <Pressable onPress={() => returnToSignIn(null)} disabled={loading}>
            <Text className="text-center font-nunito text-sm text-primary">
              {t("auth.actions.backToSignIn")}
            </Text>
          </Pressable>
        ) : stage === "resetPassword" ? (
          <View className="gap-2">
            <Pressable onPress={() => void resendCode()} disabled={loading}>
              <Text className="text-center font-nunito-bold text-sm text-primaryStrong">
                {t("auth.actions.resendResetEmail")}
              </Text>
            </Pressable>
            <Pressable onPress={() => enterResetRequestStage(null)} disabled={loading}>
              <Text className="text-center font-nunito text-sm text-primary">
                {t("auth.actions.useDifferentEmail")}
              </Text>
            </Pressable>
          </View>
        ) : mode === "login" ? (
          <Pressable onPress={() => enterResetRequestStage(null)} disabled={loading}>
            <Text className="text-center font-nunito text-sm text-primaryStrong">
              {t("auth.actions.forgotPassword")}
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
