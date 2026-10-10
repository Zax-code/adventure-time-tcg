import { View } from "react-native";

import {
  type IconSlot,
  SlotIcon,
  type Tone,
  TONE_CLASS,
  toneTextColor,
  useThemePalette,
} from "./tokens";

export type IconTileSize = 32 | 40 | 48;

const SIZE_CLASS: Record<IconTileSize, string> = {
  32: "h-[32px] w-[32px]",
  40: "h-[40px] w-[40px]",
  48: "h-[48px] w-[48px]",
};

const ICON_SIZE: Record<IconTileSize, number> = { 32: 18, 40: 20, 48: 24 };

export interface IconTileProps {
  icon: IconSlot;
  tone?: Tone;
  size?: IconTileSize;
  // Surface fill for tiles that sit on a tinted container (Notice).
  onTint?: boolean;
  testID?: string;
}

export function IconTile({
  icon,
  tone = "primary",
  size = 40,
  onTint,
  testID,
}: IconTileProps) {
  const tc = useThemePalette();

  return (
    <View
      testID={testID}
      className={`items-center justify-center rounded-ds-md ${SIZE_CLASS[size]} ${
        onTint ? "bg-surface" : TONE_CLASS[tone].tint
      }`}
    >
      <SlotIcon icon={icon} color={toneTextColor(tc, tone)} size={ICON_SIZE[size]} />
    </View>
  );
}
