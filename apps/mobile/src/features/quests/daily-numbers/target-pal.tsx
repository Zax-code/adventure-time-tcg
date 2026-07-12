import { Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";

import type { THEME_COLORS } from "../../../theme/themes";

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

export type DailyNumbersTargetPalMood =
  "smug" | "nervous" | "caught" | "escaped";

type DailyNumbersTargetPalProps = {
  colors: ThemeColors;
  mood: DailyNumbersTargetPalMood;
  value?: number | string;
  width: number;
};

const BODY_HEIGHT_RATIO = 0.84;

function TargetPalFace({
  colors,
  mood,
}: Pick<DailyNumbersTargetPalProps, "colors" | "mood">) {
  const faceColor = colors.fg;

  if (mood === "smug") {
    return (
      <>
        <Path
          d="M41 43 Q48 38 56 43"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={4}
        />
        <Path
          d="M82 43 Q90 38 98 43"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={4}
        />
        <Path
          d="M42 34 L55 31 M84 31 L98 34"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={3}
        />
        <Path d="M54 58 Q70 70 87 57 Q80 71 67 70" fill={faceColor} />
      </>
    );
  }

  if (mood === "nervous") {
    return (
      <>
        <Ellipse cx={49} cy={44} fill={faceColor} rx={7} ry={9} />
        <Ellipse cx={91} cy={44} fill={faceColor} rx={7} ry={9} />
        <Circle cx={51} cy={42} fill={colors.primaryTint} r={2.3} />
        <Circle cx={89} cy={42} fill={colors.primaryTint} r={2.3} />
        <Path
          d="M40 30 Q49 25 57 31 M82 31 Q91 25 100 30"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={3}
        />
        <Path
          d="M53 64 Q59 58 65 64 Q71 70 77 64 Q83 58 89 64"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={4}
        />
      </>
    );
  }

  if (mood === "caught") {
    return (
      <>
        <Path
          d="M39 43 Q48 51 57 43 M82 43 Q91 51 100 43"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={4}
        />
        <Path
          d="M39 31 Q49 25 58 31 M81 31 Q91 25 101 31"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={3}
        />
        <Ellipse cx={70} cy={64} fill={faceColor} rx={10} ry={8} />
        <Ellipse cx={70} cy={62} fill={colors.primaryTint} rx={5} ry={3} />
      </>
    );
  }

  return (
    <>
      <Path
        d="M42 43 Q49 49 56 43 M84 43 Q91 49 98 43"
        fill="none"
        stroke={faceColor}
        strokeLinecap="round"
        strokeWidth={4}
      />
      <Path
        d="M41 32 L57 29 M83 29 L99 32"
        fill="none"
        stroke={faceColor}
        strokeLinecap="round"
        strokeWidth={3}
      />
      <Path
        d="M51 58 Q70 78 91 57 Q87 76 70 77 Q55 75 51 58"
        fill={faceColor}
      />
      <Path
        d="M61 70 Q70 65 80 70 Q76 76 69 76 Q64 75 61 70"
        fill={colors.primary}
      />
    </>
  );
}

export function DailyNumbersTargetPal({
  colors,
  mood,
  value,
  width,
}: DailyNumbersTargetPalProps) {
  const height = width * BODY_HEIGHT_RATIO;

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ height, width }}
    >
      <Svg fill="none" height={height} viewBox="0 0 140 118" width={width}>
        <Path
          d={
            mood === "caught"
              ? "M23 57 Q12 52 9 41 M117 57 Q128 52 132 41"
              : "M23 57 Q13 60 8 51 M117 57 Q128 59 133 49"
          }
          fill="none"
          stroke={colors.primaryText}
          strokeLinecap="round"
          strokeWidth={5}
        />
        <Path
          d="M51 98 Q48 108 41 112 M89 98 Q92 108 100 111"
          fill="none"
          stroke={colors.primaryText}
          strokeLinecap="round"
          strokeWidth={5}
        />
        <Path
          d="M25 19 C35 7 51 8 61 12 C72 3 91 7 98 18 C115 17 126 28 124 43 C135 52 132 68 120 75 C121 93 106 104 90 100 C78 112 57 110 48 99 C31 103 18 92 20 77 C7 70 8 52 19 45 C15 35 17 26 25 19 Z"
          fill={colors.primaryTint}
        />
        <Circle cx={29} cy={71} fill={colors.primary} opacity={0.34} r={6} />
        <Circle cx={111} cy={70} fill={colors.primary} opacity={0.34} r={6} />
        <TargetPalFace colors={colors} mood={mood} />
      </Svg>

      {value == null ? null : (
        <Text
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1}
          numberOfLines={1}
          style={{
            bottom: height * 0.08,
            color: colors.primaryText,
            fontFamily: "Nunito_800ExtraBold",
            fontSize: width * 0.2,
            fontVariant: ["tabular-nums"],
            left: width * 0.27,
            lineHeight: width * 0.23,
            position: "absolute",
            textAlign: "center",
            width: width * 0.46,
          }}
        >
          {value}
        </Text>
      )}
    </View>
  );
}
