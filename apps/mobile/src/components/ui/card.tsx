import type { ReactNode } from "react";
import { View } from "react-native";

import { type Tone, TONE_CLASS } from "./tokens";

export interface CardProps {
  children: ReactNode;
  tone?: Tone | "neutral";
  // No padding or gap, for ListRows that draw their own insets and dividers.
  flush?: boolean;
  className?: string;
  testID?: string;
}

// The only content container. Never wrap a collectible card (CardTile, pack
// reveal, gift card art) in it.
export function Card({
  children,
  tone = "neutral",
  flush,
  className,
  testID,
}: CardProps) {
  const colors =
    tone === "neutral"
      ? "bg-surface border-primaryBorder"
      : `${TONE_CLASS[tone].tint} ${TONE_CLASS[tone].border}`;

  return (
    <View
      testID={testID}
      className={`overflow-hidden rounded-ds-lg border ${
        flush ? "" : "gap-ds-3 p-ds-4"
      } ${colors} ${className ?? ""}`}
    >
      {children}
    </View>
  );
}
