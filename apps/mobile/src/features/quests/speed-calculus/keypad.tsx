import { useCallback, type ReactNode } from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable } from "react-native-gesture-handler";

import { useTranslation } from "../../../i18n";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { KEYPAD_ROWS, type KeypadKey } from "./constants";
import { withAlpha } from "./palette";

type InteractiveKeyId = KeypadKey | "CLEAR" | "SUBMIT";

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
  className: string;
  children: ReactNode;
  onPressIn: () => void;
  scalePressed?: number;
  pressedOpacity?: number;
};

function KeyButton({
  testID,
  disabled,
  className,
  children,
  onPressIn,
  scalePressed = 0.95,
  pressedOpacity = 0.7,
}: KeyButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={onPressIn}
      className={className}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? pressedOpacity : 1,
        transform: [{ scale: pressed && !disabled ? scalePressed : 1 }],
      })}
    >
      {children}
    </Pressable>
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
    <View
      className="mx-4 mt-3 rounded-3xl border-2 border-primaryTint p-2"
      style={{
        backgroundColor: tc.surface,
        shadowColor: withAlpha(tc.primaryDark, "24"),
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="gap-2">
        {KEYPAD_ROWS.map((row) => (
          <View key={row.join("")} className="flex-row gap-2">
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

              const keyClassName =
                k === "DEL"
                  ? "flex-1 h-[58px] rounded-2xl border-2 border-dangerBorder bg-dangerTint items-center justify-center"
                  : k === "±"
                    ? "flex-1 h-[58px] rounded-2xl border-2 border-accentBorder bg-accentTint items-center justify-center"
                    : "flex-1 h-[58px] rounded-2xl border-2 border-primaryBorder bg-primaryTint items-center justify-center";

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
                  className={keyClassName}
                  onPressIn={() => activateKey(k)}
                >
                  <Text className={keyTextClass}>{label}</Text>
                </KeyButton>
              );
            })}
          </View>
        ))}
      </View>

      {/* Action row: Clear + Submit — same height/radius as grid keys */}
      <View className="flex-row gap-2 mt-2">
        <KeyButton
          testID={keyTestID("CLEAR")}
          disabled={keypadLocked || !answer}
          className="flex-1 h-[58px] rounded-2xl border-2 border-primaryBorder bg-primaryTint items-center justify-center"
          onPressIn={() => activateKey("CLEAR")}
        >
          <Text className="text-sm font-nunito-extrabold text-primaryDark">
            {t("quests.speedCalculusClear")}
          </Text>
        </KeyButton>

        <KeyButton
          testID={keyTestID("SUBMIT")}
          disabled={submitDisabled}
          className="flex-[2] h-[58px] rounded-2xl overflow-hidden"
          onPressIn={() => activateKey("SUBMIT")}
          scalePressed={0.99}
          pressedOpacity={0.9}
        >
          <LinearGradient
            colors={[tc.secondary, tc.secondaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
            }}
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
