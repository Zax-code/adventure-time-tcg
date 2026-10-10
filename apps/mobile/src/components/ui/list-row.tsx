import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";

import { IconTile } from "./icon-tile";
import { type IconSlot, type Tone, useThemePalette } from "./tokens";

export interface ListRowProps {
  title: string;
  meta?: string;
  icon?: IconSlot;
  iconTone?: Tone;
  // A Chip, a value or any small element.
  trailing?: ReactNode;
  chevron?: boolean;
  // Hairline under the row; turn it off for the last row of a Card.
  divider?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function ListRow({
  title,
  meta,
  icon,
  iconTone = "primary",
  trailing,
  chevron,
  divider = true,
  onPress,
  accessibilityLabel,
  testID,
}: ListRowProps) {
  const tc = useThemePalette();
  const className = `min-h-[56px] flex-row items-center gap-ds-3 px-ds-4 py-ds-3 ${
    divider ? "border-b border-primaryBorder" : ""
  }`;
  const content = (
    <>
      {icon ? <IconTile icon={icon} tone={iconTone} /> : null}
      <View className="flex-1 gap-[2px]">
        <Text className="font-nunito-bold text-ds-body text-fg" numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text className="font-nunito text-ds-sm text-fgMuted" numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? (
        <Ionicons name="chevron-forward" size={18} color={tc.muted} />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View className={className} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      className={className}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}
