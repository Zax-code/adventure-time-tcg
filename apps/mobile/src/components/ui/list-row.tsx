import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import ChevronRight from "lucide-react-native/icons/chevron-right";

import { Chip, type ChipProps } from "./chip";
import { IconButton, type IconButtonProps } from "./icon-button";
import { IconTile } from "./icon-tile";
import {
  ICON_STROKE_WIDTH,
  type IconSlot,
  SlotIcon,
  type Tone,
  useThemePalette,
} from "./tokens";

export interface ListRowTrailingIcon {
  icon: IconSlot;
  color: string;
  size?: number;
}

export interface ListRowProps {
  title: string;
  meta?: string;
  icon?: IconSlot;
  iconTone?: Tone;
  // A Chip, a value or any small element.
  trailing?: ReactNode;
  // Data shortcuts for the common trailing elements, rendered after `trailing`.
  trailingChip?: ChipProps;
  trailingAction?: IconButtonProps;
  trailingIcon?: ListRowTrailingIcon;
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
  trailingChip,
  trailingAction,
  trailingIcon,
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
      {trailingChip ? <Chip {...trailingChip} /> : null}
      {trailingAction ? <IconButton {...trailingAction} /> : null}
      {trailingIcon ? (
        <SlotIcon
          icon={trailingIcon.icon}
          color={trailingIcon.color}
          size={trailingIcon.size ?? 22}
        />
      ) : null}
      {chevron ? (
        <ChevronRight size={18} color={tc.muted} strokeWidth={ICON_STROKE_WIDTH} />
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
