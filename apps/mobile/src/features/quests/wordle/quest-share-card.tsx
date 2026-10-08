import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { THEME_COLORS } from "../../../theme/themes";
import type {
  WordleQuestShareResult,
  WordleTileStatus,
} from "./share-result";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export type WordleQuestShareCardStrings = {
  brand: string;
  resultLine: string;
  footer: string;
  wordLanguage: string;
  date?: string;
};

type WordleQuestShareCardProps = {
  result: WordleQuestShareResult;
  colors: ThemeColors;
  strings: WordleQuestShareCardStrings;
};

const CARD_WIDTH = 360;
const TILE_SIZE = 44;
const TILE_GAP = 8;

// Mirrors the in-game tile color mapping (see tileBgBorderClass in
// app/quests/wordle.tsx), but resolved through the active theme palette so the
// captured image matches the player's current theme regardless of NativeWind
// CSS-variable scope on the offscreen capture view.
function tileColors(
  status: WordleTileStatus,
  colors: ThemeColors,
): { backgroundColor: string; borderColor: string } {
  switch (status) {
    case "correct":
      return { backgroundColor: colors.successDark, borderColor: colors.successDark };
    case "present":
      return { backgroundColor: colors.secondary, borderColor: colors.secondary };
    case "absent":
      return { backgroundColor: colors.muted, borderColor: colors.muted };
    default:
      return { backgroundColor: colors.surface, borderColor: colors.primaryTint };
  }
}

export function WordleQuestShareCard({
  result,
  colors,
  strings,
}: WordleQuestShareCardProps) {
  const resultPillBg = result.solved ? colors.successTint : colors.dangerTint;
  const resultPillText = result.solved ? colors.successText : colors.dangerText;

  return (
    <View
      style={{
        width: CARD_WIDTH,
        backgroundColor: colors.bg,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: colors.primaryTint,
        paddingHorizontal: 24,
        paddingVertical: 28,
        alignItems: "center",
        gap: 18,
      }}
    >
      {/* Brand badge */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 7,
          borderRadius: 999,
        }}
      >
        <Text
          className="text-[11px] font-nunito-extrabold uppercase"
          style={{ color: "#ffffff", letterSpacing: 1.5 }}
        >
          {strings.brand}
        </Text>
      </LinearGradient>

      {/* Title + date */}
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text
          className="text-[24px] font-nunito-extrabold text-center"
          style={{ color: colors.primaryStrong }}
        >
          {result.questTitle}
        </Text>
        {strings.date ? (
          <Text
            className="text-[13px] font-nunito-bold text-center"
            style={{ color: colors.fgMuted }}
          >
            {strings.date}
          </Text>
        ) : null}
        <Text
          className="text-[13px] font-nunito-extrabold text-center uppercase"
          style={{ color: colors.secondaryDark }}
        >
          {strings.wordLanguage}
        </Text>
      </View>

      {/* Result line */}
      <View
        style={{
          backgroundColor: resultPillBg,
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 8,
        }}
      >
        <Text
          className="text-[15px] font-nunito-extrabold text-center"
          style={{ color: resultPillText }}
        >
          {strings.resultLine}
        </Text>
      </View>

      {/* Spoiler-safe grid */}
      <View style={{ gap: TILE_GAP }}>
        {result.attempts.map((attempt, rowIndex) => (
          <View
            key={`share-row-${rowIndex}`}
            style={{ flexDirection: "row", gap: TILE_GAP }}
          >
            {attempt.statuses.map((status, colIndex) => {
              const { backgroundColor, borderColor } = tileColors(status, colors);
              return (
                <View
                  key={`share-tile-${rowIndex}-${colIndex}`}
                  style={{
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    borderRadius: 10,
                    borderWidth: 2,
                    backgroundColor,
                    borderColor,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>

      {/* Footer */}
      <Text
        className="text-[11px] font-nunito-bold uppercase"
        style={{ color: colors.fgMuted, letterSpacing: 1.5 }}
      >
        {strings.footer}
      </Text>
    </View>
  );
}
