import type { ReactNode } from "react";
import { View } from "react-native";

import { type Tone, TONE_CLASS } from "./tokens";

export interface CardProps {
  children: ReactNode;
  tone?: Tone | "neutral";
  className?: string;
  testID?: string;
}

// The only content container. Never wrap a collectible card (CardTile, pack
// reveal, gift card art) in it.
export function Card({ children, tone = "neutral", className, testID }: CardProps) {
  const colors =
    tone === "neutral"
      ? "bg-surface border-primaryBorder"
      : `${TONE_CLASS[tone].tint} ${TONE_CLASS[tone].border}`;

  return (
    <View
      testID={testID}
      className={`gap-ds-3 rounded-ds-lg border p-ds-4 ${colors} ${className ?? ""}`}
    >
      {children}
    </View>
  );
}
