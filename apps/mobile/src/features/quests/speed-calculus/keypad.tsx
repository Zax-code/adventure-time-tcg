import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { KEYPAD_ROWS, type KeypadKey } from "./constants";
import { withAlpha } from "./palette";
import {
  getChangedTouchCount,
  pressForChangedTouches,
  releaseChangedTouches,
} from "./keypad-touch";

type InteractiveKeyId = KeypadKey | "CLEAR" | "SUBMIT";

const KEY_GAP = 8;
const KEY_HEIGHT = 58;
const KEY_RADIUS = 16;

const KEYPAD_GRID_STYLE: ViewStyle = { gap: KEY_GAP };
const KEYPAD_ROW_STYLE: ViewStyle = {
  flexDirection: "row",
  gap: KEY_GAP,
};
const ACTION_ROW_STYLE: ViewStyle = {
  flexDirection: "row",
  gap: KEY_GAP,
  marginTop: KEY_GAP,
};
const KEY_BASE_STYLE: ViewStyle = {
  flex: 1,
  height: KEY_HEIGHT,
  borderRadius: KEY_RADIUS,
  borderWidth: 2,
  alignItems: "center",
  justifyContent: "center",
  minWidth: 0,
};
const SUBMIT_KEY_STYLE: ViewStyle = {
  flex: 2,
  height: KEY_HEIGHT,
  borderRadius: KEY_RADIUS,
  overflow: "hidden",
  minWidth: 0,
};
const SUBMIT_GRADIENT_STYLE: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: KEY_RADIUS,
};

type KeypadProps = {
  answer: string;
  keypadLocked: boolean;
  submitDisabled: boolean;
  submitting: boolean;
  onDigit: (key: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onToggleSign: () => void;
  onSubmit: () => void;
};

type KeyButtonProps = {
  testID: string;
  disabled: boolean;
  style: ViewStyle;
  children: ReactNode;
  onPress: () => void;
  scalePressed?: number;
  pressedOpacity?: number;
};

function KeyButton({
  testID,
  disabled,
  style,
  children,
  onPress,
  scalePressed = 0.95,
  pressedOpacity = 0.7,
}: KeyButtonProps) {
  const activeTouchCountRef = useRef(0);
  const [pressed, setPressed] = useState(false);
  const showPressed = pressed && !disabled;

  const releaseTouches = useCallback((event: GestureResponderEvent) => {
    activeTouchCountRef.current = releaseChangedTouches(
      activeTouchCountRef.current,
      event,
    );
    if (activeTouchCountRef.current === 0) {
      setPressed(false);
    }
  }, []);

  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (disabled) return;
      const changedTouchCount = getChangedTouchCount(event);
      activeTouchCountRef.current += changedTouchCount;
      setPressed(true);
      pressForChangedTouches(event, onPress);
    },
    [disabled, onPress],
  );

  return (
    <View
      testID={testID}
      accessibilityLabel={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessible
      onAccessibilityTap={() => {
        if (!disabled) onPress();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={releaseTouches}
      onTouchCancel={releaseTouches}
      style={{
        ...style,
        opacity: disabled ? 0.45 : showPressed ? pressedOpacity : 1,
        transform: [{ scale: showPressed ? scalePressed : 1 }],
      }}
    >
      {children}
    </View>
  );
}

function keyTestID(keyId: InteractiveKeyId) {
  if (keyId === "±") return "speed-calculus-key-sign";
  if (keyId === "DEL") return "speed-calculus-key-delete";
  return `speed-calculus-key-${keyId.toLowerCase()}`;
}

export function Keypad({
  answer,
  keypadLocked,
  submitDisabled,
  submitting,
  onDigit,
  onDelete,
  onClear,
  onToggleSign,
  onSubmit,
}: KeypadProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  const keypadContainerStyle = useMemo<ViewStyle>(
    () => ({
      backgroundColor: tc.surface,
      borderColor: tc.primaryTint,
      borderWidth: 2,
      padding: KEY_GAP,
      shadowColor: withAlpha(tc.primaryDark, "24"),
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    }),
    [tc.primaryDark, tc.primaryTint, tc.surface],
  );
  const primaryKeyStyle = useMemo<ViewStyle>(
    () => ({
      ...KEY_BASE_STYLE,
      backgroundColor: tc.primaryTint,
      borderColor: tc.primaryBorder,
    }),
    [tc.primaryBorder, tc.primaryTint],
  );
  const accentKeyStyle = useMemo<ViewStyle>(
    () => ({
      ...KEY_BASE_STYLE,
      backgroundColor: tc.accentTint,
      borderColor: tc.accentBorder,
    }),
    [tc.accentBorder, tc.accentTint],
  );
  const dangerKeyStyle = useMemo<ViewStyle>(
    () => ({
      ...KEY_BASE_STYLE,
      backgroundColor: tc.dangerTint,
      borderColor: tc.dangerBorder,
    }),
    [tc.dangerBorder, tc.dangerTint],
  );

  const activateKey = useCallback(
    (keyId: InteractiveKeyId) => {
      if (keyId === "CLEAR") onClear();
      else if (keyId === "SUBMIT") onSubmit();
      else if (keyId === "±") onToggleSign();
      else if (keyId === "DEL") onDelete();
      else onDigit(keyId);
    },
    [onClear, onDelete, onDigit, onSubmit, onToggleSign],
  );

  return (
    <View className="mx-4 mt-3 rounded-3xl" style={keypadContainerStyle}>
      <View style={KEYPAD_GRID_STYLE}>
        {KEYPAD_ROWS.map((row) => (
          <View key={row.join("")} style={KEYPAD_ROW_STYLE}>
            {row.map((key) => {
              const k = key as KeypadKey;
              const isDisabled =
                k === "DEL" ? keypadLocked || !answer : keypadLocked;
              const isDigit = /^\d$/.test(k);
              const fontSizeClass = isDigit
                ? "text-[28px]"
                : k === "±"
                  ? "text-[20px]"
                  : "text-sm";

              const label =
                k === "±"
                  ? t("quests.speedCalculusToggleNegative")
                  : k === "DEL"
                    ? t("quests.speedCalculusDelete")
                    : k;

              const keyStyle =
                k === "DEL"
                  ? dangerKeyStyle
                  : k === "±"
                    ? accentKeyStyle
                    : primaryKeyStyle;

              const keyTextClass =
                k === "DEL"
                  ? `font-nunito-extrabold text-center text-dangerDark ${fontSizeClass}`
                  : k === "±"
                    ? `font-nunito-extrabold text-center text-accentDark ${fontSizeClass}`
                    : `font-nunito-extrabold text-center text-primaryDark ${fontSizeClass}`;

              return (
                <KeyButton
                  key={k}
                  testID={keyTestID(k)}
                  disabled={isDisabled}
                  style={keyStyle}
                  onPress={() => activateKey(k)}
                >
                  <Text className={keyTextClass}>{label}</Text>
                </KeyButton>
              );
            })}
          </View>
        ))}
      </View>

      {/* Action row: Clear + Submit — same height/radius as grid keys */}
      <View style={ACTION_ROW_STYLE}>
        <KeyButton
          testID={keyTestID("CLEAR")}
          disabled={keypadLocked || !answer}
          style={primaryKeyStyle}
          onPress={() => activateKey("CLEAR")}
        >
          <Text className="text-sm font-nunito-extrabold text-primaryDark">
            {t("quests.speedCalculusClear")}
          </Text>
        </KeyButton>

        <KeyButton
          testID={keyTestID("SUBMIT")}
          disabled={submitDisabled}
          style={SUBMIT_KEY_STYLE}
          onPress={() => activateKey("SUBMIT")}
          scalePressed={0.99}
          pressedOpacity={0.9}
        >
          <LinearGradient
            colors={[tc.secondary, tc.secondaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={SUBMIT_GRADIENT_STYLE}
          >
            <Text className="text-base font-nunito-extrabold text-secondaryText">
              {submitting ? "···" : t("quests.speedCalculusSubmit")}
            </Text>
          </LinearGradient>
        </KeyButton>
      </View>
    </View>
  );
}
