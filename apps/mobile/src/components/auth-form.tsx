import React, { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import Ionicons from "@react-native-vector-icons/ionicons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { SessionUrlProvider } from "expo-auth-session/build/SessionUrlProvider";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { ZodError, type ZodIssue } from "zod";
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
type AuthProvider = "email" | "google" | "apple";
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
type AuthSubmitErrorHandler = (
  error: unknown,
  provider: AuthProvider,
  onRetry: () => void,
) => void;

type AuthFormInitialState = {
  email: string;
  verificationCode: string;
  mode: AuthMode;
  stage: AuthStage;
  info: string | null;
};

let nativeGoogleConfigured = false;
type AuthTranslate = (key: string) => string;
type ParsedAuthIssue = {
  message?: unknown;
  path?: unknown;
};

function uniqueMessages(messages: Array<string | null | undefined>) {
  return [...new Set(messages.filter((message): message is string => Boolean(message)))];
}

async function sha256Hex(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

function getKnownAuthErrorMessage(message: string, t: AuthTranslate) {
  const normalized = message.trim();

  if (!normalized) {
    return null;
  }

  if (/invalid email address|email has invalid format|email (is required|can't be blank)/i.test(normalized)) {
    return t("auth.errors.invalidEmail");
  }

  if (
    /password (should have at least|must be at least|is required)|too_small/i.test(
      normalized,
    )
  ) {
    return t("auth.errors.passwordTooShort");
  }

  if (
    /verification code must be 6 digits|invalid string: must match pattern/i.test(
      normalized,
    )
  ) {
    return t("auth.errors.verificationCodeInvalid");
  }

  if (/display.?name/i.test(normalized)) {
    return t("auth.errors.displayNameInvalid");
  }

  if (
    /either idtoken or accesstoken is required|google did not return a usable token|apple did not return a usable token/i.test(
      normalized,
    )
  ) {
    return t("auth.errors.googleTokenMissing");
  }

  return null;
}

function formatAuthIssue(
  issue: ZodIssue | ParsedAuthIssue,
  t: AuthTranslate,
): string | null {
  const firstPathSegment = Array.isArray(issue.path)
    ? issue.path.find((segment): segment is string => typeof segment === "string") ?? null
    : null;

  switch (firstPathSegment) {
    case "email":
      return t("auth.errors.invalidEmail");
    case "password":
      return t("auth.errors.passwordTooShort");
    case "code":
      return t("auth.errors.verificationCodeInvalid");
    case "displayName":
      return t("auth.errors.displayNameInvalid");
    default:
      break;
  }

  if (typeof issue.message === "string") {
    return getKnownAuthErrorMessage(issue.message, t) ?? issue.message;
  }

  return null;
}

function extractAuthMessages(value: unknown, t: AuthTranslate): string[] {
  if (!value) {
    return [];
  }

  if (value instanceof ZodError) {
    return uniqueMessages(value.issues.map((issue) => formatAuthIssue(issue, t)));
  }

  if (typeof value === "string") {
    const knownMessage = getKnownAuthErrorMessage(value, t);
    if (knownMessage) {
      return [knownMessage];
    }

    const trimmedValue = value.trim();

    if (trimmedValue.startsWith("{") || trimmedValue.startsWith("[")) {
      try {
        return extractAuthMessages(JSON.parse(trimmedValue), t);
      } catch {
        return trimmedValue ? [trimmedValue] : [];
      }
    }

    return trimmedValue ? [trimmedValue] : [];
  }

  if (Array.isArray(value)) {
    return uniqueMessages(
      value.flatMap((entry) => {
        if (typeof entry === "string") {
          return extractAuthMessages(entry, t);
        }

        if (entry && typeof entry === "object") {
          const formatted = formatAuthIssue(entry as ParsedAuthIssue, t);
          return formatted ? [formatted] : [];
        }

        return [];
      }),
    );
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.issues)) {
      const issueMessages = extractAuthMessages(record.issues, t);
      if (issueMessages.length > 0) {
        return issueMessages;
      }
    }

    if (typeof record.error === "string") {
      const errorMessages = extractAuthMessages(record.error, t);
      if (errorMessages.length > 0) {
        return errorMessages;
      }
    }

    if (typeof record.message === "string") {
      const messageValues = extractAuthMessages(record.message, t);
      if (messageValues.length > 0) {
        return messageValues;
      }
    }
  }

  return [];
}

function formatAuthErrorMessage(
  error: unknown,
  t: AuthTranslate,
  fallback: string,
) {
  if (isNetworkError(error)) {
    return t("auth.errors.networkFallback");
  }

  if (error instanceof ApiClientError) {
    const detailMessages = extractAuthMessages(error.details, t);
    if (detailMessages.length > 0) {
      return detailMessages.join("\n");
    }
  }

  const extractedMessages = extractAuthMessages(error, t);
  if (extractedMessages.length > 0) {
    return extractedMessages.join("\n");
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

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

type SocialSignInProvider = "google" | "apple";

function SocialProviderMark({
  provider,
}: {
  provider: SocialSignInProvider;
}) {
  const iconName = provider === "apple" ? "logo-apple" : "logo-google";

  return <Ionicons name={iconName} size={24} color="white" />;
}

function SocialSignInButton({
  disabled,
  onPress,
  provider,
  tc,
  t,
}: {
  disabled: boolean;
  onPress: () => void;
  provider: SocialSignInProvider;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
  t: (key: string) => string;
}) {
  const isGoogle = provider === "google";
  const title = isGoogle
    ? t("auth.actions.continueWithGoogle")
    : t("auth.actions.continueWithApple");
  const buttonColor = isGoogle ? tc.infoDark : tc.accentDark;
  const disabledOpacity = disabled ? 0.52 : 1;

  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View
          className="min-h-[58px] flex-row items-center justify-center gap-3 rounded-[22px] border px-[18px] py-2.5"
          style={{
            backgroundColor: buttonColor,
            borderColor: buttonColor,
            opacity: disabledOpacity,
            transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
          }}
        >
          <SocialProviderMark provider={provider} />
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.84}
            className="font-nunito-extrabold text-base text-white"
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
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
    <SocialSignInButton
      disabled={disabled}
      onPress={onPress}
      provider="google"
      tc={tc}
      t={t}
    />
  );
}

function AppleSignInButton({
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
    <SocialSignInButton
      disabled={disabled}
      onPress={onPress}
      provider="apple"
      tc={tc}
      t={t}
    />
  );
}

function AppleAuthSection({
  handleAuthError,
  loading,
  preferredLanguage,
  setAppleLoading,
  setError,
  setSession,
  t,
  tc,
}: {
  handleAuthError: AuthSubmitErrorHandler;
  loading: boolean;
  preferredLanguage: "en" | "fr";
  setAppleLoading: (value: boolean) => void;
  setError: (value: string | null, options?: AuthErrorOptions) => void;
  setSession: (params: {
    user: import("@adventure-time/api-client").AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  t: (key: string) => string;
  tc: (typeof THEME_COLORS)[keyof typeof THEME_COLORS];
}) {
  const router = useRouter();

  async function submitApple() {
    setAppleLoading(true);
    setError(null);

    try {
      const nonce = Crypto.randomUUID();
      const appleNonce = await sha256Hex(nonce);
      const credential = await AppleAuthentication.signInAsync({
        nonce: appleNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple did not return a usable token.");
      }

      const authResult = await apiClient.appleAuth({
        identityToken: credential.identityToken,
        nonce,
        preferredLanguage,
        fullName: credential.fullName
          ? {
              givenName: credential.fullName.givenName,
              familyName: credential.fullName.familyName,
            }
          : undefined,
      });

      await setSession({
        user: authResult.user,
        accessToken: authResult.tokens.accessToken,
        refreshToken: authResult.tokens.refreshToken,
      });
      router.replace("/(tabs)");
    } catch (submitError) {
      if (
        submitError instanceof Error &&
        /ERR_REQUEST_CANCELED|canceled|cancelled/i.test(submitError.message)
      ) {
        return;
      }

      handleAuthError(submitError, "apple", () => void submitApple());
    } finally {
      setAppleLoading(false);
    }
  }

  return (
    <AppleSignInButton
      disabled={loading}
      onPress={() => void submitApple()}
      tc={tc}
      t={t}
    />
  );
}

function BrowserGoogleAuthSection({
  handleAuthError,
  loading,
  preferredLanguage,
  setError,
  setGoogleLoading,
  setSession,
  t,
  tc,
}: {
  handleAuthError: AuthSubmitErrorHandler;
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
          handleAuthError(submitError, "google", () => void finishGoogleAuth());
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
      handleAuthError(submitError, "google", () => void submitGoogle());
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
  handleAuthError,
  loading,
  preferredLanguage,
  setError,
  setGoogleLoading,
  setSession,
  t,
  tc,
}: {
  handleAuthError: AuthSubmitErrorHandler;
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
        handleAuthError(submitError, "google", () => void submitGoogle());
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
  const [pendingApprovalProvider, setPendingApprovalProvider] =
    useState<AuthProvider>("email");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);
  const googleAuthConfigured = hasGoogleAuthConfig();
  const appleAuthConfigured = Platform.OS === "ios" && appleAuthAvailable;
  const socialAuthConfigured = googleAuthConfigured || appleAuthConfigured;
  const autoVerifyTriggeredRef = useRef(false);
  const submitAutoVerify = useEffectEvent(() => {
    void submit();
  });

  useEffect(() => {
    let cancelled = false;

    async function checkAppleAvailability() {
      if (Platform.OS !== "ios") {
        setAppleAuthAvailable(false);
        return;
      }

      const available = await AppleAuthentication.isAvailableAsync();

      if (!cancelled) {
        setAppleAuthAvailable(available);
      }
    }

    void checkAppleAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

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
    setPendingApprovalProvider("email");
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
    setPendingApprovalProvider("email");
    if (!opts?.preserveCode) {
      setVerificationCode("");
    }
    setResetPassword("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

  function enterPendingApprovalStage(
    provider: AuthProvider,
    nextInfo?: string | null,
  ) {
    setStage("pendingApproval");
    setMode("login");
    setPendingApprovalProvider(provider);
    setPassword("");
    setVerificationCode("");
    setResetPassword("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

  function returnToSignIn(nextInfo?: string | null) {
    setStage("credentials");
    setMode("login");
    setPendingApprovalProvider("email");
    setPassword("");
    setVerificationCode("");
    setResetPassword("");
    setError(null);
    setInfo(nextInfo ?? null);
  }

  function enterResetRequestStage(nextInfo?: string | null) {
    setStage("resetRequest");
    setMode("login");
    setPendingApprovalProvider("email");
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
    setPendingApprovalProvider("email");
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

  function pendingApprovalInfo(provider: AuthProvider) {
    switch (provider) {
      case "apple":
        return t("auth.status.applePendingApproval");
      case "google":
        return t("auth.status.googlePendingApproval");
      case "email":
      default:
        return t("auth.status.emailVerifiedPendingApproval");
    }
  }

  function pendingApprovalBody(provider: AuthProvider) {
    switch (provider) {
      case "apple":
        return t("auth.status.pendingApprovalBodyApple");
      case "google":
        return t("auth.status.pendingApprovalBodyGoogle");
      case "email":
      default:
        return t("auth.status.pendingApprovalBodyEmail");
    }
  }

  function pendingApprovalFootnote(provider: AuthProvider) {
    switch (provider) {
      case "apple":
        return t("auth.status.pendingApprovalFootnoteApple");
      case "google":
        return t("auth.status.pendingApprovalFootnoteGoogle");
      case "email":
      default:
        return t("auth.status.pendingApprovalFootnoteEmail");
    }
  }

  function getFriendlyError(submitError: unknown, provider: AuthProvider) {
    if (submitError instanceof ApiClientError) {
      if (submitError.code === "ACCESS_REQUEST_PENDING") {
        const message = pendingApprovalInfo(provider);
        enterPendingApprovalStage(provider, message);
        return message;
      }

      if (submitError.code === "EMAIL_VERIFICATION_REQUIRED") {
        enterVerificationStage(t("auth.status.verificationCodeSentCheckEmail"));
        return t("auth.status.verificationCodeSentCheckEmail");
      }
    }

    return formatAuthErrorMessage(submitError, t, t("auth.errors.failed"));
  }

  function handleAuthError(
    submitError: unknown,
    provider: AuthProvider,
    onRetry: () => void,
  ) {
    setError(getFriendlyError(submitError, provider), {
      cause: submitError,
      onRetry,
    });
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
          enterPendingApprovalStage(
            "email",
            t("auth.status.emailVerifiedPendingApproval"),
          );
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
      handleAuthError(submitError, "email", () => void submit());
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
      handleAuthError(submitError, "email", () => void resendCode());
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
                  {pendingApprovalBody(pendingApprovalProvider)}
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
              {pendingApprovalFootnote(pendingApprovalProvider)}
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

      {stage !== "credentials" || !socialAuthConfigured ? null : (
        <View className="gap-4 pt-2">
          <View className="h-px bg-primaryBorder" />
          <View className="gap-3">
            {appleAuthConfigured ? (
              <AppleAuthSection
                handleAuthError={handleAuthError}
                loading={loading || googleLoading || appleLoading}
                preferredLanguage={preferredLanguage}
                setAppleLoading={setAppleLoading}
                setError={setError}
                setSession={setSession}
                t={t}
                tc={tc}
              />
            ) : null}

            {googleAuthConfigured ? (
              Platform.OS === "android" &&
              Constants.executionEnvironment !== ExecutionEnvironment.StoreClient ? (
                <NativeGoogleAuthSection
                  handleAuthError={handleAuthError}
                  loading={loading || googleLoading || appleLoading}
                  preferredLanguage={preferredLanguage}
                  setError={setError}
                  setGoogleLoading={setGoogleLoading}
                  setSession={setSession}
                  t={t}
                  tc={tc}
                />
              ) : (
                <BrowserGoogleAuthSection
                  handleAuthError={handleAuthError}
                  loading={loading || googleLoading || appleLoading}
                  preferredLanguage={preferredLanguage}
                  setError={setError}
                  setGoogleLoading={setGoogleLoading}
                  setSession={setSession}
                  t={t}
                  tc={tc}
                />
              )
            ) : null}
          </View>
        </View>
      )}

      <Text className="text-center font-nunito text-sm text-primary">
        {t("auth.labels.madeWithLoveBy")}
      </Text>
    </View>
  );
}
