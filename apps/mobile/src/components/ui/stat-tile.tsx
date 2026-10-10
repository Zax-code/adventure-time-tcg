import { Text, View } from "react-native";

import { type Tone, TONE_CLASS } from "./tokens";

export interface StatTileProps {
  label: string;
  value: string | number;
  caption?: string;
  tone?: Tone | "neutral";
  className?: string;
  testID?: string;
}

export function StatTile({
  label,
  value,
  caption,
  tone = "neutral",
  className,
  testID,
}: StatTileProps) {
  const neutral = tone === "neutral";
  const container = neutral
    ? "bg-surface border-primaryBorder"
    : `${TONE_CLASS[tone].tint} ${TONE_CLASS[tone].border}`;
  const muted = neutral ? "text-fgMuted" : TONE_CLASS[tone].text;
  const strong = neutral ? "text-fg" : TONE_CLASS[tone].text;

  return (
    <View
      testID={testID}
      className={`gap-ds-1 rounded-ds-md border px-ds-4 py-ds-3 ${container} ${
        className ?? ""
      }`}
    >
      <Text className={`font-nunito-bold text-ds-caption ${muted}`} numberOfLines={1}>
        {label}
      </Text>
      <Text
        className={`font-nunito-extrabold text-[24px] leading-[29px] ${strong}`}
        numberOfLines={1}
      >
        {value}
      </Text>
      {caption ? (
        <Text className={`font-nunito text-ds-caption ${muted}`} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
