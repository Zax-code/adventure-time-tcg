import { Text, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

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

const BODY_HEIGHT_RATIO = 138 / 160;

function GuideFace({
  colors,
  mood,
}: Pick<DailyNumbersTargetPalProps, "colors" | "mood">) {
  const faceColor = colors.fg;

  if (mood === "smug") {
    return (
      <G>
        <Path
          d="M55 42 Q62 38 69 42 M91 42 Q98 38 105 42"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={3.4}
        />
        <Path
          d="M58 35 L68 33 M92 33 L102 35"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={2.4}
        />
        <Path d="M65 54 Q79 63 96 53 Q89 64 77 63" fill={faceColor} />
      </G>
    );
  }

  if (mood === "nervous") {
    return (
      <G>
        <Ellipse cx={64} cy={43} fill={faceColor} rx={4.7} ry={6.2} />
        <Ellipse cx={96} cy={43} fill={faceColor} rx={4.7} ry={6.2} />
        <Circle cx={65.5} cy={41.5} fill={colors.surface} r={1.5} />
        <Circle cx={94.5} cy={41.5} fill={colors.surface} r={1.5} />
        <Path
          d="M57 33 Q64 29 71 34 M89 34 Q96 29 103 33"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={2.4}
        />
        <Path
          d="M65 57 Q70 52 75 57 Q80 62 85 57 Q90 52 95 57"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={3.1}
        />
      </G>
    );
  }

  if (mood === "caught") {
    return (
      <G>
        <Path
          d="M56 43 Q63 50 70 43 M90 43 Q97 50 104 43"
          fill="none"
          stroke={faceColor}
          strokeLinecap="round"
          strokeWidth={3.4}
        />
        <Path
          d="M64 55 Q80 69 97 54 Q93 68 80 68 Q68 68 64 55"
          fill={faceColor}
        />
        <Path
          d="M73 64 Q80 60 88 64 Q85 68 79 68 Q76 68 73 64"
          fill={colors.primary}
        />
      </G>
    );
  }

  return (
    <G>
      <Path
        d="M57 43 Q63 48 69 43"
        fill="none"
        stroke={faceColor}
        strokeLinecap="round"
        strokeWidth={3.4}
      />
      <Ellipse cx={97} cy={43} fill={faceColor} rx={4.5} ry={5.6} />
      <Circle cx={98.5} cy={41.5} fill={colors.surface} r={1.35} />
      <Path
        d="M64 55 Q80 68 97 54 Q92 68 79 67 Q68 66 64 55"
        fill={faceColor}
      />
      <Path
        d="M73 64 Q80 60 88 64"
        fill="none"
        stroke={colors.primary}
        strokeLinecap="round"
        strokeWidth={2.2}
      />
    </G>
  );
}

function GuideLimbs({
  colors,
  mood,
}: Pick<DailyNumbersTargetPalProps, "colors" | "mood">) {
  const leftArm =
    mood === "caught"
      ? "M31 53 C19 48 17 35 22 27"
      : mood === "nervous"
        ? "M31 57 C20 58 17 68 22 76"
        : mood === "escaped"
          ? "M31 59 C18 62 13 72 17 82"
          : "M31 58 C21 63 20 73 26 78";
  const rightArm =
    mood === "caught"
      ? "M129 53 C142 47 144 34 138 26"
      : mood === "nervous"
        ? "M129 57 C140 59 143 69 137 77"
        : mood === "escaped"
          ? "M129 58 C140 53 144 42 139 34"
          : "M129 58 C139 63 140 73 134 78";
  const legs =
    mood === "caught"
      ? "M54 115 C51 124 44 128 38 133 M106 115 C110 124 117 128 124 132"
      : mood === "escaped"
        ? "M54 115 C48 122 39 123 31 126 M105 115 C111 122 116 128 122 133"
        : "M54 115 C52 123 48 128 43 133 M106 115 C108 123 113 128 118 133";

  return (
    <G>
      {[leftArm, rightArm, legs].map((path) => (
        <G key={path}>
          <Path
            d={path}
            fill="none"
            stroke={colors.fg}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={7.2}
          />
          <Path
            d={path}
            fill="none"
            stroke={colors.successDark}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={4.2}
          />
        </G>
      ))}

      {mood === "caught" ? (
        <G fill="none" stroke={colors.accent} strokeLinecap="round">
          <Path d="M17 11 L17 20 M12.5 15.5 L21.5 15.5" strokeWidth={2.5} />
          <Path d="M143 13 L143 22 M138.5 17.5 L147.5 17.5" strokeWidth={2.5} />
          <Path d="M151 34 L151 39 M148.5 36.5 L153.5 36.5" strokeWidth={2} />
        </G>
      ) : null}

      {mood === "nervous" ? (
        <Path
          d="M139 39 C145 47 143 52 139 52 C135 52 133 47 139 39 Z"
          fill={colors.info}
          stroke={colors.fg}
          strokeWidth={1.7}
        />
      ) : null}

      {mood === "escaped" ? (
        <G fill="none" stroke={colors.primaryText} strokeLinecap="round">
          <Path d="M10 88 L20 87" strokeWidth={2.5} />
          <Path d="M14 96 L24 93" strokeWidth={2} />
        </G>
      ) : null}
    </G>
  );
}

export function DailyNumbersTargetPal({
  colors,
  mood,
  value,
  width,
}: DailyNumbersTargetPalProps) {
  const height = width * BODY_HEIGHT_RATIO;
  const showValue = value != null;

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ height, width }}
    >
      <Svg fill="none" height={height} viewBox="0 0 160 138" width={width}>
        <GuideLimbs colors={colors} mood={mood} />

        <Rect
          x={31}
          y={13}
          width={106}
          height={108}
          rx={20}
          fill={colors.primaryBorder}
          opacity={0.42}
        />
        <Rect
          x={27}
          y={8}
          width={106}
          height={109}
          rx={20}
          fill={colors.successDark}
          stroke={colors.fg}
          strokeWidth={3.2}
        />
        <Path
          d="M39 19 C34 25 33 36 33 51"
          fill="none"
          stroke={colors.success}
          strokeLinecap="round"
          strokeWidth={3.5}
        />
        <Path
          d="M43 112 C67 115 99 115 119 108"
          fill="none"
          stroke={colors.successText}
          strokeLinecap="round"
          strokeWidth={2.4}
          opacity={0.36}
        />

        <Circle cx={38} cy={18} fill={colors.success} r={2.2} />
        <Circle cx={122} cy={18} fill={colors.success} r={2.2} />

        <Rect
          x={39}
          y={21}
          width={82}
          height={51}
          rx={12}
          fill={colors.surface}
          stroke={colors.fg}
          strokeWidth={3}
        />
        <Rect
          x={43}
          y={25}
          width={74}
          height={43}
          rx={8.5}
          fill={colors.successTint}
        />
        <Path
          d="M49 30 C63 27 87 27 108 29"
          fill="none"
          stroke={colors.surface}
          strokeLinecap="round"
          strokeWidth={2.2}
          opacity={0.72}
        />

        {!showValue ? <GuideFace colors={colors} mood={mood} /> : null}

        <G fill={colors.fg} opacity={0.82}>
          <Circle cx={37} cy={81} r={1.8} />
          <Circle cx={37} cy={87} r={1.8} />
          <Circle cx={37} cy={93} r={1.8} />
        </G>

        <Rect x={72} y={80} width={17} height={4} rx={2} fill={colors.fg} />
        <Circle
          cx={99}
          cy={82}
          r={3.8}
          fill={colors.secondary}
          stroke={colors.fg}
          strokeWidth={1.8}
        />

        <Path
          d="M49 89 H57 V81 H64 V89 H72 V96 H64 V104 H57 V96 H49 Z"
          fill={colors.secondary}
          stroke={colors.fg}
          strokeLinejoin="round"
          strokeWidth={2.4}
        />
        <Path
          d="M96 101 L103 88 L110 101 Z"
          fill={colors.accent}
          stroke={colors.fg}
          strokeLinejoin="round"
          strokeWidth={2.2}
        />
        <Circle
          cx={118}
          cy={87}
          r={5.2}
          fill={colors.primary}
          stroke={colors.fg}
          strokeWidth={2.2}
        />
        <Circle
          cx={118}
          cy={103}
          r={7}
          fill={colors.danger}
          stroke={colors.fg}
          strokeWidth={2.2}
        />
      </Svg>

      {showValue ? (
        <Text
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1}
          numberOfLines={1}
          style={{
            color: colors.fg,
            fontFamily: "Nunito_800ExtraBold",
            fontSize: width * 0.22,
            fontVariant: ["tabular-nums"],
            left: width * (39 / 160),
            lineHeight: width * (50 / 160),
            position: "absolute",
            textAlign: "center",
            top: width * (21 / 160),
            width: width * (82 / 160),
          }}
        >
          {value}
        </Text>
      ) : null}
    </View>
  );
}
