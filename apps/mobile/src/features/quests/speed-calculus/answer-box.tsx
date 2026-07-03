import { Text, View } from "react-native";
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

  return (
    <Animated.View
      testID={answerTestID}
      accessibilityLabel={answerTestID}
      accessible
      className="mx-4 rounded-2xl border-2 px-5 items-center h-20"
      style={[
        {
          borderColor: answerBoxBorder,
          backgroundColor: answerBoxBg,
          boxShadow: `0px 4px 12px ${answerBoxBorder}`,
        },
        animatedStyle,
      ]}
    >
      <View className="flex-1 items-center justify-center pt-2">
        <Text
          className="text-[10px] font-nunito-bold uppercase tracking-[4px] mb-1 opacity-[0.55]"
          style={{ color: answerBoxText }}
        >
          {t("quests.speedCalculusAnswerPlaceholder")}
        </Text>
        <Text
          testID={answerTestID}
          accessibilityLabel={answerTestID}
          className="font-nunito-extrabold text-center text-[40px] leading-[46px]"
          style={{
            color: answer ? answerBoxText : answerPlaceholderText,
          }}
        >
          {answer || "\u2014"}
        </Text>
      </View>
    </Animated.View>
  );
}
