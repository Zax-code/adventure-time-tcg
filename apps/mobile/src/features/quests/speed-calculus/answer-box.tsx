import { Text } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { useTranslation } from "../../../i18n";

type AnswerBoxProps = {
  answer: string;
  shakeAnim: SharedValue<number>;
  answerBoxBg: string;
  answerBoxBorder: string;
  answerBoxText: string;
  answerPlaceholderText: string;
};

export function AnswerBox({
  answer,
  shakeAnim,
  answerBoxBg,
  answerBoxBorder,
  answerBoxText,
  answerPlaceholderText,
}: AnswerBoxProps) {
  const { t } = useTranslation();
  const answerTestID = `speed-calculus-answer-value-${answer || "empty"}`;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  // Input anatomy (board 04): 56 high, radius 16, surface fill and the
  // "Answer" placeholder. Feedback tints the field and a wrong answer
  // shakes it.
  return (
    <Animated.View
      testID={answerTestID}
      accessibilityLabel={answerTestID}
      accessible
      className="h-[56px] flex-row items-center rounded-ds-md border px-ds-4"
      style={[
        {
          borderColor: answerBoxBorder,
          backgroundColor: answerBoxBg,
        },
        animatedStyle,
      ]}
    >
      <Text
        testID={answerTestID}
        accessibilityLabel={answerTestID}
        className={`flex-1 text-[17px] leading-[23px] ${
          answer ? "font-nunito-extrabold" : "font-nunito"
        }`}
        style={{
          color: answer ? answerBoxText : answerPlaceholderText,
        }}
        numberOfLines={1}
      >
        {answer || t("quests.speedCalculusAnswerPlaceholder")}
      </Text>
    </Animated.View>
  );
}
