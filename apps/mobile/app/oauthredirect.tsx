import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  AccessTokenRequest,
  type TokenResponse,
} from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useLocalSearchParams, useRouter } from "expo-router";

import { apiClient } from "../src/lib/api";
import {
  clearPendingGoogleAuthSession,
  getPendingGoogleAuthSession,
} from "../src/lib/google-auth-session";
import { useTranslation } from "../src/i18n";
import { useSessionStore } from "../src/stores/session-store";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS } from "../src/theme/themes";

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function OAuthRedirectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const setSession = useSessionStore((state) => state.setSession);
  const tc = THEME_COLORS[themeName];
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function completeGoogleAuth() {
      try {
        const providerError = getParamValue(params.error);
        if (providerError) {
          const description = getParamValue(params.error_description);
          throw new Error(description ?? providerError);
        }

        const pendingSession = await getPendingGoogleAuthSession();
        if (!pendingSession) {
          throw new Error("Google sign-in session expired. Please try again.");
        }

        const responseState = getParamValue(params.state);
        if (responseState !== pendingSession.state) {
          throw new Error("Google sign-in state mismatch. Please try again.");
        }

        let idToken = getParamValue(params.id_token);
        let accessToken = getParamValue(params.access_token);

        if (!idToken && !accessToken) {
          const code = getParamValue(params.code);
          if (!code) {
            throw new Error("Google did not return a usable token.");
          }

          const tokenRequest = new AccessTokenRequest({
            clientId: pendingSession.clientId,
            code,
            redirectUri: pendingSession.redirectUri,
            scopes: pendingSession.scopes,
            extraParams: {
              code_verifier: pendingSession.codeVerifier,
            },
          });
          const authentication: TokenResponse =
            await tokenRequest.performAsync(Google.discovery);

          idToken = authentication.idToken;
          accessToken = authentication.accessToken;
        }

        if (!idToken && !accessToken) {
          throw new Error("Google did not return a usable token.");
        }

        const authResult = await apiClient.googleAuth({
          idToken,
          accessToken,
          preferredLanguage: pendingSession.preferredLanguage,
        });

        await setSession({
          user: authResult.user,
          accessToken: authResult.tokens.accessToken,
          refreshToken: authResult.tokens.refreshToken,
        });
        await clearPendingGoogleAuthSession();

        if (!cancelled) {
          router.replace("/(tabs)");
        }
      } catch (callbackError) {
        await clearPendingGoogleAuthSession();

        if (!cancelled) {
          setError(
            callbackError instanceof Error
              ? callbackError.message
              : t("auth.errors.failed"),
          );
        }
      }
    }

    void completeGoogleAuth();

    return () => {
      cancelled = true;
    };
  }, [params, router, setSession, t]);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-primaryBg px-6">
      {error ? (
        <>
          <Text className="text-center font-nunito-extrabold text-3xl text-primaryStrong">
            {t("auth.errors.failed")}
          </Text>
          <Text className="text-center font-nunito text-base text-primaryText">
            {error}
          </Text>
          <Pressable
            className="rounded-full bg-primary px-6 py-3"
            onPress={() => router.replace("/login")}
          >
            <Text className="font-nunito-bold text-white">
              {t("common.goBack")}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={tc.primaryDark} />
          <Text className="text-center font-nunito-bold text-lg text-primaryStrong">
            {t("auth.actions.enterCandyKingdom")}
          </Text>
          <Text className="text-center font-nunito text-base text-primaryText">
            {t("auth.status.completingGoogleSignIn")}
          </Text>
        </>
      )}
    </View>
  );
}
