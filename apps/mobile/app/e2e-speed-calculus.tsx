import { useCallback, useState } from "react";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnswerBox } from "../src/features/quests/speed-calculus/answer-box";
import {
  appendDigit,
  deleteDigit,
  toggleSign,
} from "../src/features/quests/speed-calculus/constants";
import { Keypad } from "../src/features/quests/speed-calculus/keypad";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS } from "../src/theme/themes";

const IS_E2E_BUILD = process.env.EXPO_PUBLIC_E2E_AUTH === "1";

export default function E2ESpeedCalculusScreen() {
  if (!IS_E2E_BUILD) {
    return <Redirect href="/" />;
  }

  return <SpeedCalculusKeypadHarness />;
}

function SpeedCalculusKeypadHarness() {
  const insets = useSafeAreaInsets();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];
  const shakeAnim = useSharedValue(0);
  const [answer, setAnswer] = useState("");

  const handleDigit = useCallback((digit: string) => {
    setAnswer((current) => appendDigit(current, digit));
  }, []);

  const handleDelete = useCallback(() => {
    setAnswer((current) => deleteDigit(current));
  }, []);

  const handleToggleSign = useCallback(() => {
    setAnswer((current) => toggleSign(current));
  }, []);

  return (
    <View
      testID="speed-calculus-appium-harness"
      className="flex-1 justify-center bg-primaryBg"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <Text className="mb-4 text-center font-nunito-extrabold text-xl text-primaryDark">
        Speed Calculus multi-touch
      </Text>

      <AnswerBox
        answer={answer}
        shakeAnim={shakeAnim}
        answerBoxBg={tc.surface}
        answerBoxBorder={tc.primaryBorder}
        answerBoxText={tc.primaryDark}
        answerPlaceholderText={tc.fgMuted}
      />

      <Keypad
        answer={answer}
        keypadLocked={false}
        submitDisabled
        submitting={false}
        onDigit={handleDigit}
        onDelete={handleDelete}
        onClear={() => setAnswer("")}
        onToggleSign={handleToggleSign}
        onSubmit={() => undefined}
      />
    </View>
  );
}
