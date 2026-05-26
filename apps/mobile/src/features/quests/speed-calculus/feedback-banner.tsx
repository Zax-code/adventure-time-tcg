import { Animated, Text, View } from "react-native";
import type { SpeedRunState } from "@adventure-time/api-client";

import { type FeedbackType } from "./constants";

type Question = NonNullable<SpeedRunState["activeRun"]>["questions"][number];

type FeedbackBannerProps = {
  feedback: FeedbackType;
  feedbackSlide: Animated.Value;
  feedbackOpacity: Animated.Value;
  pauseRemainingSeconds: number;
  currentQuestion: Question | null;
};

export function FeedbackBanner({
  feedback,
  feedbackSlide,
  feedbackOpacity,
  pauseRemainingSeconds,
  currentQuestion,
}: FeedbackBannerProps) {
  return (
    <View className="h-[58px] mt-2.5 mx-4 justify-center">
      {feedback && pauseRemainingSeconds === 0 && currentQuestion && (
        <Animated.View
          className={`rounded-2xl border py-2.5 px-4 items-center ${
            feedback.kind === "incorrect"
              ? "border-dangerBorder bg-dangerTint"
              : "border-successDark/30 bg-successTint"
          }`}
          style={{ transform: [{ translateY: feedbackSlide }], opacity: feedbackOpacity }}
        >
          <Text
            className={`font-nunito-bold text-sm text-center ${
              feedback.kind === "incorrect" ? "text-dangerDark" : "text-successDark"
            }`}
          >
            {feedback.message}
          </Text>
          {feedback.kind === "incorrect" && feedback.questionLabel && (
            <Text className="font-nunito-semibold text-dangerDark text-[11px] mt-0.5 uppercase tracking-[3px]">
              {feedback.questionLabel} = {feedback.correctAnswer}
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}
