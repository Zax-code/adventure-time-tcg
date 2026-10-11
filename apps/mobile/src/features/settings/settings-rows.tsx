import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import Circle from "lucide-react-native/icons/circle";
import CircleCheck from "lucide-react-native/icons/circle-check";

import { ThemedExpoSwitch } from "../../components/expo-ui/themed-switch";
import { IconTile } from "../../components/ui/icon-tile";
import { ICON_STROKE_WIDTH, useThemePalette } from "../../components/ui/tokens";

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      className="font-nunito-extrabold text-ds-h3 text-fg"
    >
      {children}
    </Text>
  );
}

// StatTile anatomy with the compact 15/800 value the settings summary uses.
export function CompactStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View className="flex-1 gap-ds-1 rounded-ds-md border border-primaryBorder bg-surface px-ds-4 py-ds-3">
      <Text
        className="font-nunito-bold text-ds-caption text-fgMuted"
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        className="font-nunito-extrabold text-ds-body text-fg"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// Bordered ListRow group used for single-choice lists and toggles.
export function SelectList({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-ds-md border border-primaryBorder">
      {children}
    </View>
  );
}

// ListRow anatomy plus a selected state (tint fill, circle-check trailing).
export function SelectRow({
  disabled,
  divider,
  icon,
  meta,
  onPress,
  selected,
  testID,
  title,
  titleTestID,
}: {
  disabled?: boolean;
  divider: boolean;
  icon: LucideIcon;
  meta: string;
  onPress: () => void;
  selected: boolean;
  testID: string;
  title: string;
  titleTestID?: string;
}) {
  const tc = useThemePalette();
  const Indicator = selected ? CircleCheck : Circle;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
      testID={testID}
      className={`min-h-[56px] flex-row items-center gap-ds-3 px-ds-4 py-ds-3 ${
        selected ? "bg-primaryTint" : ""
      } ${divider ? "border-b border-primaryBorder" : ""} ${
        disabled ? "opacity-[0.65]" : ""
      }`}
    >
      <IconTile icon={icon} />
      <View className="flex-1 gap-[2px]">
        <Text
          className="font-nunito-bold text-ds-body text-fg"
          numberOfLines={2}
          testID={titleTestID}
        >
          {title}
        </Text>
        <Text className="font-nunito text-ds-sm text-fgMuted" numberOfLines={3}>
          {meta}
        </Text>
      </View>
      <Indicator
        size={22}
        color={selected ? tc.primaryText : tc.muted}
        strokeWidth={ICON_STROKE_WIDTH}
      />
    </Pressable>
  );
}

export function ToggleRow({
  description,
  disabled,
  divider,
  icon,
  onToggle,
  testIDPrefix,
  title,
  value,
}: {
  description: string;
  disabled?: boolean;
  divider: boolean;
  icon: LucideIcon;
  onToggle: (nextValue: boolean) => void;
  testIDPrefix: string;
  title: string;
  value: boolean;
}) {
  return (
    <Pressable
      onPress={() => onToggle(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      className={`min-h-[56px] flex-row items-center gap-ds-3 px-ds-4 py-ds-3 ${
        divider ? "border-b border-primaryBorder" : ""
      } ${disabled ? "opacity-[0.65]" : ""}`}
    >
      <IconTile icon={icon} />
      <View className="flex-1 gap-[2px]">
        <Text
          className="font-nunito-bold text-ds-body text-fg"
          testID={`${testIDPrefix}-title`}
        >
          {title}
        </Text>
        <Text
          className="font-nunito text-ds-sm text-fgMuted"
          testID={`${testIDPrefix}-description`}
        >
          {description}
        </Text>
      </View>
      <ThemedExpoSwitch
        disabled={disabled}
        onValueChange={onToggle}
        value={value}
      />
    </Pressable>
  );
}
