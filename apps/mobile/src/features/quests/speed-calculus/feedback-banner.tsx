import { Text } from "react-native";
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

  if (!feedback || pauseRemainingSeconds !== 0 || !currentQuestion) {
    return null;
  }

  // Floats over the bottom of the question Card so answering never shifts
  // the keypad under the player's fingers.
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      className={`absolute bottom-ds-2 left-ds-2 right-ds-2 items-center rounded-ds-md border px-ds-3 py-ds-2 ${
        feedback.kind === "incorrect"
          ? "border-dangerBorder bg-dangerTint"
          : "border-successBorder bg-successTint"
      }`}
      style={animatedStyle}
    >
      <Text
        className={`text-center font-nunito-bold text-ds-sm ${
          feedback.kind === "incorrect" ? "text-dangerText" : "text-successText"
        }`}
      >
        {feedback.message}
      </Text>
      {feedback.kind === "incorrect" && feedback.questionLabel ? (
        <Text className="font-nunito-bold text-ds-overline uppercase tracking-[1px] text-dangerText">
          {feedback.questionLabel} = {feedback.correctAnswer}
        </Text>
      ) : null}
    </Animated.View>
  );
}
