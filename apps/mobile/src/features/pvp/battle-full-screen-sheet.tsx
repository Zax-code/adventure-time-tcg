import { useEffect, useState, type ReactNode } from "react";
import { ModalBottomSheet } from "@swmansion/react-native-bottom-sheet";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedExpoButton } from "../../components/expo-ui/themed-button";
import { XIcon } from "../../components/icons";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";

interface BattleFullScreenSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scrollable?: boolean;
  testID?: string;
  closeButtonTestID?: string;
}

export function BattleFullScreenSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  scrollable = true,
  testID,
  closeButtonTestID,
}: BattleFullScreenSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const [index, setIndex] = useState(visible ? 1 : 0);
  const [mounted, setMounted] = useState(visible);
  const topGap = Math.max(insets.top + 16, 56);
  const maxSheetHeight = Math.max(0, height - topGap);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setIndex(1);
      return;
    }

    setIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible && index === 0) {
      setMounted(false);
    }
  }, [index, visible]);

  if (!mounted) {
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
    <ModalBottomSheet
      index={index}
      onIndexChange={setIndex}
      onSettle={(nextIndex) => {
        if (nextIndex === 0 && visible) {
          onClose();
        }
      }}
      detents={[0, "content"]}
      scrimColor="rgba(0,0,0,0.65)"
      surface={
        <View
          className="bg-bg"
          style={[
            StyleSheet.absoluteFill,
            {
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
            },
          ]}
        />
      }
    >
      <View
        className="bg-bg"
        style={{
          maxHeight: maxSheetHeight,
          minHeight: Math.min(maxSheetHeight, height * 0.68),
        }}
        testID={testID}
      >
        <View>
          <View
            className="h-1 w-9 self-center rounded-full bg-muted"
            style={{ marginBottom: 8, marginTop: 12 }}
          />

          <View className="flex-row items-center border-b border-primaryTint px-5 pb-4">
            <View className="flex-1 items-center">
              <Text className="font-nunito-extrabold text-2xl text-fg">
                {title}
              </Text>
            </View>
            <ThemedExpoButton
              onPress={onClose}
              testID={closeButtonTestID}
              variant="ghost"
              fallbackAppearance={{
                backgroundColor: tc.surfaceMuted,
                borderColor: tc.surfaceMuted,
                borderRadius: 999,
                foregroundColor: tc.fgMuted,
                gradientColors: null,
                minHeight: 34,
                paddingHorizontal: 8,
                paddingVertical: 8,
              }}
              style={{
                minHeight: 34,
                minWidth: 34,
                position: "absolute",
                right: 20,
                top: 0,
              }}
            >
              <XIcon size={18} color={tc.fgMuted} />
            </ThemedExpoButton>
          </View>
        </View>

        {content}

        {footer ? (
          <View
            className="border-t border-primaryTint bg-surface px-4 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            {footer}
          </View>
        ) : (
          <View style={{ height: Math.max(insets.bottom, 12) }} />
        )}
      </View>
    </ModalBottomSheet>
  );
}
