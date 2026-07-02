import { Animated, Text, View } from "react-native";

import { useTranslation } from "../../../i18n";

type AnswerBoxProps = {
  answer: string;
  shakeAnim: Animated.Value;
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

  return (
    <Animated.View
      className="mx-4 rounded-2xl border-2 px-5 items-center h-20"
      style={{
        borderColor: answerBoxBorder,
        backgroundColor: answerBoxBg,
        transform: [{ translateX: shakeAnim }],
        boxShadow: `0px 4px 12px ${answerBoxBorder}`,
      }}
    >
      <View className="flex-1 items-center justify-center pt-2">
        <Text
          className="text-[10px] font-nunito-bold uppercase tracking-[4px] mb-1 opacity-[0.55]"
          style={{ color: answerBoxText }}
        >
          {t("quests.speedCalculusAnswerPlaceholder")}
        </Text>
        <Text
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
