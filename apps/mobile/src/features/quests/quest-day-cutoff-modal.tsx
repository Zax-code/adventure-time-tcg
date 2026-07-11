import Ionicons from "@react-native-vector-icons/ionicons";
import { useRef } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  ScrollView,
  Text,
  View,
} from "react-native";

import { PrimaryButton } from "../../components/button";
import { ThemedModal } from "../../components/themed-modal";
import { useTranslation } from "../../i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";

type QuestDayCutoffModalProps = {
  visible: boolean;
  status: "error" | "ready" | "refreshing";
  onContinue: () => void;
  onRetry: () => void;
};

export function QuestDayCutoffModal({
  visible,
  status,
  onContinue,
  onRetry,
}: QuestDayCutoffModalProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const titleRef = useRef<Text>(null);
  const body = t(
    status === "refreshing"
      ? "quests.dailyCutoff.refreshingBody"
      : status === "error"
        ? "quests.dailyCutoff.errorBody"
        : "quests.dailyCutoff.body",
  );

  const focusTitle = () => {
    const node = findNodeHandle(titleRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={onContinue}
      dismissible={false}
      onShow={focusTitle}
      panelStyle={{ maxHeight: "85%" }}
      testID="quest-day-cutoff-modal"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center", gap: 16, width: "100%" }}
      >
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          className="h-16 w-16 items-center justify-center rounded-full border border-primaryBorder bg-primaryTint"
        >
          <Ionicons name="time-outline" size={34} color={tc.primaryDark} />
        </View>
        <View className="gap-2">
          <Text
            ref={titleRef}
            className="text-center font-nunito-extrabold text-2xl text-fg"
            accessibilityRole="header"
          >
            {t("quests.dailyCutoff.title")}
          </Text>
          <Text
            className="text-center font-nunito text-base leading-6 text-fgMuted"
            accessibilityLiveRegion="polite"
          >
            {body}
          </Text>
        </View>
        <PrimaryButton
          onPress={status === "error" ? onRetry : onContinue}
          disabled={status === "refreshing"}
          loading={status === "refreshing"}
          fallbackAppearance={{ borderRadius: 16 }}
          style={{ width: "100%" }}
          testID={
            status === "refreshing"
              ? "quest-day-cutoff-loading"
              : status === "error"
                ? "quest-day-cutoff-retry"
                : "quest-day-cutoff-continue"
          }
        >
          {t(
            status === "error"
              ? "quests.dailyCutoff.retry"
              : "quests.dailyCutoff.cta",
          )}
        </PrimaryButton>
      </ScrollView>
    </ThemedModal>
  );
}
