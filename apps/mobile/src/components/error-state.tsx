import { Text, View } from "react-native";

import CircleAlert from "lucide-react-native/icons/circle-alert";
import CloudOff from "lucide-react-native/icons/cloud-off";

import { Button } from "./ui/button";
import { Chip } from "./ui/chip";
import { IconTile } from "./ui/icon-tile";
import { useTranslation } from "../i18n";
import { isNetworkError } from "../lib/api";

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
  const isPage = variant === "page";
  const networkFailure = isNetworkError(error);
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

  const tone = networkFailure ? "info" : "danger";

  return (
    <View
      accessibilityRole="alert"
      className={`w-full items-center gap-ds-3 rounded-ds-lg border border-primaryBorder bg-surface p-ds-6 ${
        isPage ? "max-w-[420px]" : ""
      }`}
    >
      <IconTile
        size={48}
        tone={tone}
        icon={networkFailure ? CloudOff : CircleAlert}
      />
      <Chip tone={tone} label={eyebrow} />
      <Text className="text-center font-nunito-extrabold text-ds-h3 text-fg">
        {resolvedTitle}
      </Text>
      <Text className="text-center font-nunito text-ds-body text-fgMuted">
        {resolvedBody}
      </Text>
      <Text
        className={`text-center font-nunito-semibold text-ds-sm ${
          networkFailure ? "text-infoText" : "text-dangerText"
        }`}
      >
        {resolvedDetail}
      </Text>

      {technicalMessage ? (
        <View className="w-full gap-ds-1 rounded-ds-md border border-primaryBorder bg-surfaceMuted px-ds-4 py-ds-3">
          <Text className="font-nunito-bold text-ds-overline uppercase tracking-[1px] text-fgMuted">
            {t("common.errorStates.technicalLabel")}
          </Text>
          <Text className="font-nunito text-ds-sm text-fgMuted">
            {technicalMessage}
          </Text>
        </View>
      ) : null}

      {onRetry || onBack ? (
        <View className="w-full gap-ds-2">
          {onRetry ? (
            <Button onPress={onRetry}>
              {retryLabel ??
                (networkFailure
                  ? t("common.errorStates.network.action")
                  : t("common.errorStates.generic.action"))}
            </Button>
          ) : null}
          {onBack ? (
            <Button tone="ghost" onPress={onBack}>
              {backLabel ?? t("common.errorStates.backAction")}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function PageErrorState(props: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center bg-bg px-ds-6">
      <ErrorPanel {...props} variant="page" />
    </View>
  );
}

export function SectionErrorState(props: ErrorStateProps) {
  return <ErrorPanel {...props} variant="section" />;
}
