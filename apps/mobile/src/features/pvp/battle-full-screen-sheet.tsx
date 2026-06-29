import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { XIcon } from "../../components/icons";
import { useTranslation } from "../../i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../../theme/themes";

interface BattleFullScreenSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scrollable?: boolean;
  testID?: string;
}

export function BattleFullScreenSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  scrollable = true,
  testID,
}: BattleFullScreenSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const topPadding = Math.max(insets.top + 10, 16);
  const bottomPadding = Math.max(insets.bottom + 10, 16);
  const horizontalPadding = width > height ? 20 : 12;
  const modalHeight = Math.max(0, height - topPadding - bottomPadding);
  const modalMaxWidth = Math.min(width - horizontalPadding * 2, 980);

  if (!visible) {
    return null;
  }

  const content = scrollable ? (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className="flex-1">{children}</View>
  );

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        className="flex-1"
        style={[
          StyleSheet.absoluteFill,
          THEME_VARS[themeName] as never,
          {
            backgroundColor:
              themeName === "nightosphere"
                ? "rgba(5,1,10,0.88)"
                : "rgba(38,22,30,0.68)",
            paddingBottom: bottomPadding,
            paddingHorizontal: horizontalPadding,
            paddingTop: topPadding,
            zIndex: 50,
          },
        ]}
      >
        <View className="flex-1 items-center justify-center">
          <View
            accessibilityViewIsModal
            className="w-full overflow-hidden rounded-[30px] border border-primaryTint bg-bg"
            style={{
              height: modalHeight,
              maxWidth: modalMaxWidth,
              boxShadow:
                themeName === "nightosphere"
                  ? "0px 20px 40px rgba(0, 0, 0, 0.42)"
                  : "0px 20px 40px rgba(90, 45, 12, 0.18)",
            }}
            testID={testID}
          >
            <View className="flex-row items-center border-b border-primaryTint px-4 py-3">
              <View className="w-11" />
              <View className="flex-1 items-center px-2">
                <Text
                  className="text-center font-nunito-extrabold text-2xl text-fg"
                  numberOfLines={2}
                >
                  {title}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={t("common.close")}
                accessibilityRole="button"
                className="h-11 w-11 items-center justify-center rounded-full bg-surfaceMuted"
                hitSlop={6}
                onPress={onClose}
                testID={testID ? `${testID}-close-button` : undefined}
              >
                <XIcon size={20} color={tc.fg} />
              </Pressable>
            </View>

            {content}

            {footer ? (
              <View
                className="border-t border-primaryTint bg-surface px-4"
                style={{
                  justifyContent: "center",
                  minHeight: 76,
                  paddingVertical: 12,
                }}
              >
                {footer}
              </View>
            ) : (
              <View style={{ height: Math.max(insets.bottom, 12) }} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
