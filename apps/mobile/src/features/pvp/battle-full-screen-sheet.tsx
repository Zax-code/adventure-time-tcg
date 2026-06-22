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
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
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
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          overflow: "hidden",
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

          <View className="flex-row items-center justify-center border-b border-primaryTint px-5 pb-4">
            <View className="flex-1 items-center">
              <Text className="font-nunito-extrabold text-2xl text-fg">
                {title}
              </Text>
            </View>
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
