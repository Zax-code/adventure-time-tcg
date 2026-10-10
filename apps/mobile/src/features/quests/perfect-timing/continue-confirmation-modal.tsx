import Ionicons from "@react-native-vector-icons/ionicons";
import { useRef } from "react";
import { AccessibilityInfo, findNodeHandle, Text, View } from "react-native";

import { Button } from "../../../components/ui/button";
import { ThemedModal } from "../../../components/themed-modal";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import type { Translate } from "./types";

export function ContinueConfirmationModal({
  visible,
  loading,
  onDiscard,
  onStay,
  t,
}: {
  visible: boolean;
  loading: boolean;
  onDiscard: () => void;
  onStay: () => void;
  t: Translate;
}) {
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const titleRef = useRef<Text>(null);

  const focusTitle = () => {
    const node = findNodeHandle(titleRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };

  return (
    <ThemedModal
      visible={visible}
      onClose={onStay}
      dismissible={!loading}
      onShow={focusTitle}
      testID="perfect-timing-continue-confirmation-modal"
    >
      <View className="items-center gap-5">
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          className="h-16 w-16 items-center justify-center rounded-full border border-dangerBorder bg-dangerTint"
        >
          <Ionicons name="warning-outline" size={34} color={tc.dangerDark} />
        </View>

        <View className="gap-2">
          <Text
            ref={titleRef}
            accessibilityRole="header"
            className="text-center font-nunito-extrabold text-2xl text-fg"
          >
            {t("quests.perfectTiming.continueConfirmTitle")}
          </Text>
          <Text className="text-center font-nunito text-base leading-6 text-fgMuted">
            {t("quests.perfectTiming.continueConfirmBody")}
          </Text>
        </View>

        <View className="w-full gap-3">
          <Button
            tone="primary"
            size="lg"
            onPress={onStay}
            disabled={loading}
            style={{ width: "100%" }}
            testID="perfect-timing-continue-confirmation-stay"
          >
            {t("quests.perfectTiming.continueConfirmStayAction")}
          </Button>
          <Button
            tone="danger"
            size="lg"
            onPress={onDiscard}
            loading={loading}
            style={{ width: "100%" }}
            testID="perfect-timing-continue-confirmation-discard"
          >
            {t("quests.perfectTiming.continueConfirmAction")}
          </Button>
        </View>
      </View>
    </ThemedModal>
  );
}
