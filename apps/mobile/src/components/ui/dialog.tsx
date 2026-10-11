import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { Button, type ButtonTone } from "./button";
import { IconTile } from "./icon-tile";
import {
  getBackdropColor,
  getElevation,
  type IconSlot,
  type Tone,
  useThemeName,
} from "./tokens";
import { THEME_VARS } from "../../theme/themes";

export interface DialogAction {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface DialogProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  body?: string;
  icon?: IconSlot;
  iconTone?: Tone;
  // Ghost on the left, primary on the right; a lone confirm is full width.
  cancel?: DialogAction;
  confirm?: DialogAction;
  children?: ReactNode;
  dismissible?: boolean;
  onShow?: () => void;
  testID?: string;
}

export function Dialog({
  visible,
  onClose,
  title,
  body,
  icon,
  iconTone = "primary",
  cancel,
  confirm,
  children,
  dismissible = true,
  onShow,
  testID,
}: DialogProps) {
  const themeName = useThemeName();

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
      <View className="flex-1" style={THEME_VARS[themeName]}>
        <Pressable
          accessible={false}
          focusable={false}
          className="flex-1 justify-center p-ds-6"
          style={{ backgroundColor: getBackdropColor(themeName) }}
          onPress={dismissible ? onClose : undefined}
        >
          <View
            testID={testID}
            accessibilityViewIsModal
            className="w-full max-w-[342px] gap-ds-4 self-center rounded-ds-xl bg-surface p-ds-5"
            style={{ boxShadow: getElevation(themeName, "overlay") }}
            onStartShouldSetResponder={() => true}
          >
            {icon || title || body ? (
              <View className="items-center gap-[6px]">
                {icon ? <IconTile icon={icon} tone={iconTone} size={48} /> : null}
                {title ? (
                  <Text
                    accessibilityRole="header"
                    className="text-center font-nunito-extrabold text-[20px] leading-[24px] text-fg"
                  >
                    {title}
                  </Text>
                ) : null}
                {body ? (
                  <Text className="text-center font-nunito text-ds-body text-fgMuted">
                    {body}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {children}
            {cancel || confirm ? (
              <View className="flex-row gap-ds-3">
                {cancel ? (
                  <Button
                    tone={cancel.tone ?? "ghost"}
                    onPress={cancel.onPress}
                    loading={cancel.loading}
                    disabled={cancel.disabled}
                    testID={cancel.testID}
                    className="flex-1"
                  >
                    {cancel.label}
                  </Button>
                ) : null}
                {confirm ? (
                  <Button
                    tone={confirm.tone ?? "primary"}
                    onPress={confirm.onPress}
                    loading={confirm.loading}
                    disabled={confirm.disabled}
                    testID={confirm.testID}
                    className="flex-1"
                  >
                    {confirm.label}
                  </Button>
                ) : null}
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}
