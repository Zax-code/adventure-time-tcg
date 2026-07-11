import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useThemeStore } from "../stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../theme/themes";

type ThemedModalProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  panelStyle?: StyleProp<ViewStyle>;
  dismissible?: boolean;
  onShow?: () => void;
  testID?: string;
};

export function ThemedModal({
  visible,
  onClose,
  children,
  panelStyle,
  dismissible = true,
  onShow,
  testID,
}: ThemedModalProps) {
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const backdropColor =
    themeName === "nightosphere"
      ? "rgba(6, 1, 10, 0.84)"
      : "rgba(74, 34, 50, 0.44)";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={onShow}
      onRequestClose={() => {
        if (dismissible) onClose();
      }}
    >
      <View style={[{ flex: 1 }, THEME_VARS[themeName] as never]}>
        <Pressable
          accessible={false}
          focusable={false}
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: backdropColor,
          }}
          onPress={dismissible ? onClose : undefined}
        >
          <View
            testID={testID}
            accessibilityViewIsModal
            style={[
              {
                width: "100%",
                maxWidth: 440,
                alignSelf: "center",
                borderRadius: 28,
                borderWidth: 1,
                borderColor: tc.primaryBorder,
                backgroundColor: tc.surface,
                padding: 20,
                boxShadow:
                  themeName === "nightosphere"
                    ? "0px 14px 28px rgba(0, 0, 0, 0.36)"
                    : "0px 14px 28px rgba(122, 86, 24, 0.16)",
              },
              panelStyle,
            ]}
            onStartShouldSetResponder={() => true}
          >
            {children}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}
