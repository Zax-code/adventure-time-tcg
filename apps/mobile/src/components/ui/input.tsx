import { type ComponentProps, type ReactNode, useState } from "react";
import { View } from "react-native";

import { CONTROL } from "@adventure-time/theme";

import { ThemedExpoTextInput } from "../expo-ui/themed-text-input";
import { type IconSlot, SlotIcon, useThemePalette } from "./tokens";

type TextInputProps = Omit<
  ComponentProps<typeof ThemedExpoTextInput>,
  "style" | "hostStyle" | "textStyle"
>;

export interface InputProps extends TextInputProps {
  icon?: IconSlot;
  // Small trailing control such as a clear button.
  trailing?: ReactNode;
  invalid?: boolean;
  className?: string;
  containerTestID?: string;
}

export function Input({
  icon,
  trailing,
  invalid,
  className,
  containerTestID,
  onFocus,
  onBlur,
  multiline,
  ...props
}: InputProps) {
  const tc = useThemePalette();
  const [focused, setFocused] = useState(false);
  const borderClass = invalid
    ? "border-2 border-danger"
    : focused
      ? "border-2 border-primary"
      : "border border-primaryBorder";

  return (
    <View
      testID={containerTestID}
      className={`flex-row items-center gap-[10px] rounded-ds-md bg-surface px-ds-4 ${borderClass} ${
        multiline ? "py-ds-3" : ""
      } ${className ?? ""}`}
      style={{ minHeight: CONTROL.input }}
    >
      <SlotIcon icon={icon} color={tc.muted} size={18} />
      <ThemedExpoTextInput
        {...props}
        multiline={multiline}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        hostStyle={{ flex: 1 }}
        // Explicit padding keeps the React Native path, which lays out
        // reliably inside a decorated container.
        style={{
          paddingHorizontal: 0,
          paddingVertical: 0,
          height: multiline ? undefined : CONTROL.input - 4,
        }}
        textStyle={{
          color: tc.fg,
          fontFamily: "Nunito_400Regular",
          fontSize: 15,
        }}
      />
      {trailing}
    </View>
  );
}
