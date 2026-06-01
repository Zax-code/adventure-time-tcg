import { Animated, Text, View } from "react-native";

import { useTranslation } from "../../../i18n";

type AnswerBoxProps = {
  answer: string;
  shakeAnim: Animated.Value;
  answerBoxBg: string;
  answerBoxBorder: string;
  answerBoxText: string;
};

export function AnswerBox({ answer, shakeAnim, answerBoxBg, answerBoxBorder, answerBoxText }: AnswerBoxProps) {
  const { t } = useTranslation();

  return (
    <Animated.View
      className="mx-4 rounded-2xl border-2 px-5 items-center h-20"
      style={{
        borderColor: answerBoxBorder,
        backgroundColor: answerBoxBg,
        transform: [{ translateX: shakeAnim }],
        shadowColor: answerBoxBorder,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
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
            color: answer ? answerBoxText : "rgba(236,72,153,0.22)",
          }}
        >
          {answer || "\u2014"}
        </Text>
      </View>
    </Animated.View>
  );
}
