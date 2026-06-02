import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { GhostButton, PrimaryButton } from "./button";
import { useTranslation } from "../i18n";
import { isNetworkError } from "../lib/api";
import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS } from "../theme/themes";

type ErrorStateVariant = "page" | "section";

type ErrorStateProps = {
  error?: unknown;
  onRetry?: () => void;
  onBack?: () => void;
  retryLabel?: string;
  backLabel?: string;
  title?: string;
  body?: string;
  detail?: string;
  variant?: ErrorStateVariant;
};

function ErrorPanel({
  error,
  onRetry,
  onBack,
  retryLabel,
  backLabel,
  title,
  body,
  detail,
  variant = "page",
}: ErrorStateProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const isPage = variant === "page";
  const networkFailure = isNetworkError(error);
  const iconName = networkFailure
    ? "cloud-offline-outline"
    : "alert-circle-outline";
  const eyebrow = networkFailure
    ? t("common.errorStates.network.eyebrow")
    : t("common.errorStates.generic.eyebrow");
  const resolvedTitle =
    title ??
    (networkFailure
      ? t("common.errorStates.network.title")
      : t("common.errorStates.generic.title"));
  const resolvedBody =
    body ??
    (networkFailure
      ? t("common.errorStates.network.body")
      : t("common.errorStates.generic.body"));
  const resolvedDetail =
    detail ??
    (networkFailure
      ? t("common.errorStates.network.detail")
      : t("common.errorStates.generic.detail"));
  const technicalMessage =
    !networkFailure && error instanceof Error ? error.message : null;

  return (
    <View
      className="w-full overflow-hidden border bg-surface"
      style={{
        maxWidth: isPage ? 420 : undefined,
        borderRadius: isPage ? 34 : 28,
        borderColor: tc.primaryBorder + "66",
        shadowColor: networkFailure ? tc.infoDark : tc.dangerDark,
        shadowOpacity: isPage ? 0.24 : 0.14,
        shadowRadius: isPage ? 22 : 14,
        shadowOffset: { width: 0, height: isPage ? 12 : 8 },
        elevation: isPage ? 10 : 5,
      }}
    >
      <LinearGradient
        colors={
          networkFailure
            ? [tc.surface, tc.infoTint, tc.primaryBg]
            : [tc.surface, tc.dangerTint, tc.primaryBg]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: isPage ? 24 : 20,
          paddingVertical: isPage ? 24 : 20,
        }}
      >
        <View className="items-center">
          <View
            className="items-center justify-center rounded-[26px]"
            style={{
              width: isPage ? 88 : 74,
              height: isPage ? 88 : 74,
              backgroundColor: networkFailure ? tc.infoTint : tc.dangerTint,
            }}
          >
            <LinearGradient
              colors={
                networkFailure
                  ? [tc.infoDark, tc.primary]
                  : [tc.dangerDark, tc.primaryDark]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: isPage ? 68 : 56,
                height: isPage ? 68 : 56,
                borderRadius: isPage ? 20 : 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={iconName}
                size={isPage ? 34 : 28}
                color="#fff"
              />
            </LinearGradient>
          </View>

          <View
            className="mt-4 rounded-full border px-3 py-1"
            style={{
              borderColor: networkFailure ? tc.infoBorder : tc.dangerBorder,
              backgroundColor: networkFailure ? tc.infoTint : tc.dangerTint,
            }}
          >
            <Text
              className="font-nunito-bold uppercase tracking-[2px]"
              style={{
                color: networkFailure ? tc.infoDark : tc.dangerDark,
                fontSize: 11,
              }}
            >
              {eyebrow}
            </Text>
          </View>

          <Text
            className="mt-4 text-center font-nunito-extrabold text-fg"
            style={{ fontSize: isPage ? 24 : 20, lineHeight: isPage ? 30 : 24 }}
          >
            {resolvedTitle}
          </Text>

          <Text
            className="mt-3 text-center font-nunito text-fgMuted"
            style={{
              fontSize: isPage ? 15 : 14,
              lineHeight: isPage ? 22 : 20,
            }}
          >
            {resolvedBody}
          </Text>

          <Text
            className="mt-2 text-center font-nunito-semibold"
            style={{
              color: networkFailure ? tc.infoDark : tc.primaryDark,
              fontSize: isPage ? 14 : 13,
              lineHeight: isPage ? 20 : 18,
            }}
          >
            {resolvedDetail}
          </Text>

          {technicalMessage ? (
            <View
              className="mt-5 w-full rounded-2xl border px-4 py-3"
              style={{
                borderColor: tc.primaryBorder + "88",
                backgroundColor: tc.surface + "dd",
              }}
            >
              <Text className="font-nunito-bold text-xs uppercase tracking-[1.5px] text-fgMuted">
                {t("common.errorStates.technicalLabel")}
              </Text>
              <Text className="mt-2 font-nunito text-sm text-fgMuted">
                {technicalMessage}
              </Text>
            </View>
          ) : null}

          <View className="mt-6 w-full gap-3">
            {onRetry ? (
              <PrimaryButton onPress={onRetry}>
                {retryLabel ??
                  (networkFailure
                    ? t("common.errorStates.network.action")
                    : t("common.errorStates.generic.action"))}
              </PrimaryButton>
            ) : null}
            {onBack ? (
              <GhostButton onPress={onBack}>
                {backLabel ?? t("common.errorStates.backAction")}
              </GhostButton>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

export function PageErrorState(props: ErrorStateProps) {
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

  return (
    <View className="flex-1 items-center justify-center overflow-hidden bg-bg px-6">
      <View
        className="absolute rounded-full"
        style={{
          top: 92,
          left: -44,
          width: 164,
          height: 164,
          backgroundColor: tc.secondaryTint,
          opacity: 0.55,
        }}
      />
      <View
        className="absolute rounded-full"
        style={{
          top: 174,
          right: -28,
          width: 124,
          height: 124,
          backgroundColor: tc.infoTint,
          opacity: 0.4,
        }}
      />
      <View
        className="absolute rounded-full"
        style={{
          bottom: 84,
          right: 20,
          width: 156,
          height: 156,
          backgroundColor: tc.primaryTint,
          opacity: 0.48,
        }}
      />
      <ErrorPanel {...props} variant="page" />
    </View>
  );
}

export function SectionErrorState(props: ErrorStateProps) {
  return <ErrorPanel {...props} variant="section" />;
}
