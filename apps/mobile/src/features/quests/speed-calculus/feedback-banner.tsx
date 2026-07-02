import { Text, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { SpeedRunState } from "@adventure-time/api-client";

import { type FeedbackType } from "./constants";

type Question = NonNullable<SpeedRunState["activeRun"]>["questions"][number];

type FeedbackBannerProps = {
  feedback: FeedbackType;
  feedbackSlide: SharedValue<number>;
  feedbackOpacity: SharedValue<number>;
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
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
    transform: [{ translateY: feedbackSlide.value }],
  }));

  return (
    <View className="h-[58px] mt-2.5 mx-4 justify-center">
      {feedback && pauseRemainingSeconds === 0 && currentQuestion && (
        <Animated.View
          className={`rounded-2xl border py-2.5 px-4 items-center ${
            feedback.kind === "incorrect"
              ? "border-dangerBorder bg-dangerTint"
              : "border-successBorder bg-successTint"
          }`}
          style={animatedStyle}
        >
          <Text
            className={`font-nunito-bold text-sm text-center ${
              feedback.kind === "incorrect"
                ? "text-dangerDark"
                : "text-successDark"
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
