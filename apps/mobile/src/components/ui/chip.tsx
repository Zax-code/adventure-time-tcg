import type { AccessibilityState } from "react-native";
import { Pressable, Text, View } from "react-native";

import { ON_PRIMARY } from "@adventure-time/theme";

import {
  type IconSlot,
  SlotIcon,
  type Tone,
  TONE_CLASS,
  type ThemePalette,
  toneTextColor,
  useThemePalette,
} from "./tokens";

export type ChipTone = Tone | "neutral" | "selected";

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  icon?: IconSlot;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  className?: string;
  testID?: string;
}

const NEUTRAL = {
  container: "bg-surface border-primaryBorder",
  text: "text-fgMuted",
};
const SELECTED = { container: "bg-primary border-primary", text: "text-white" };

function getChipClasses(tone: ChipTone) {
  if (tone === "neutral") return NEUTRAL;
  if (tone === "selected") return SELECTED;
  return {
    container: `${TONE_CLASS[tone].tint} ${TONE_CLASS[tone].border}`,
    text: TONE_CLASS[tone].text,
  };
}

function getChipColor(tc: ThemePalette, tone: ChipTone) {
  if (tone === "neutral") return tc.fgMuted;
  if (tone === "selected") return ON_PRIMARY;
  return toneTextColor(tc, tone);
}

// Sentence case only: never pass an uppercased label.
export function Chip({
  label,
  tone = "primary",
  icon,
  onPress,
  accessibilityLabel,
  accessibilityState,
  className,
  testID,
}: ChipProps) {
  const tc = useThemePalette();
  const classes = getChipClasses(tone);
  const containerClass = `h-[28px] flex-row items-center gap-[6px] self-start rounded-ds-pill border px-ds-3 ${
    classes.container
  } ${className ?? ""}`;
  const content = (
    <>
      <SlotIcon icon={icon} color={getChipColor(tc, tone)} size={14} />
      <Text
        className={`font-nunito-bold text-ds-caption ${classes.text}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return (
      <View className={containerClass} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={accessibilityState ?? { selected: tone === "selected" }}
      className={containerClass}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}
