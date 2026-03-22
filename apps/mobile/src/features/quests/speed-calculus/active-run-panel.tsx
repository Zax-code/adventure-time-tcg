import { Animated, Modal, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { SpeedRunState } from "@adventure-time/shared";

import { type FeedbackType } from "./constants";
import { HudCard } from "./hud-card";
import { FeedbackBanner } from "./feedback-banner";
import { QuestionZone } from "./question-zone";
import { AnswerBox } from "./answer-box";
import { Keypad } from "./keypad";
import { RoundOverOverlay } from "./round-over-overlay";

type Question = NonNullable<SpeedRunState["activeRun"]>["questions"][number];

type ActiveRunPanelProps = {
  visible: boolean;
  showRoundOver: boolean;
  activeRun: NonNullable<SpeedRunState["activeRun"]> | null;
  roundOverScore: number;
  roundOverRunNumber: number;
  state: SpeedRunState;
  remainingSeconds: number;
  pauseRemainingSeconds: number;
  feedback: FeedbackType;
  feedbackSlide: Animated.Value;
  feedbackOpacity: Animated.Value;
  answer: string;
  shakeAnim: Animated.Value;
  answerBoxBg: string;
  answerBoxBorder: string;
  answerBoxText: string;
  submitting: boolean;
  keypadLocked: boolean;
  submitDisabled: boolean;
  currentQuestion: Question | null;
  onDigit: (key: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onToggleSign: () => void;
  onSubmit: () => void;
  onDismiss: () => void;
};

export function ActiveRunPanel({
  visible,
  showRoundOver,
  activeRun,
  roundOverScore,
  roundOverRunNumber,
  state,
  remainingSeconds,
  pauseRemainingSeconds,
  feedback,
  feedbackSlide,
  feedbackOpacity,
  answer,
  shakeAnim,
  answerBoxBg,
  answerBoxBorder,
  answerBoxText,
  submitting,
  keypadLocked,
  submitDisabled,
  currentQuestion,
  onDigit,
  onDelete,
  onClear,
  onToggleSign,
  onSubmit,
  onDismiss,
}: ActiveRunPanelProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={() => {/* no-op during active run */}}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          className="flex-1 bg-primaryBg"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <HudCard
            activeRun={activeRun}
            state={state}
            remainingSeconds={remainingSeconds}
            pauseRemainingSeconds={pauseRemainingSeconds}
          />

          <FeedbackBanner
            feedback={feedback}
            feedbackSlide={feedbackSlide}
            feedbackOpacity={feedbackOpacity}
            pauseRemainingSeconds={pauseRemainingSeconds}
            currentQuestion={currentQuestion}
          />

          <QuestionZone
            pauseRemainingSeconds={pauseRemainingSeconds}
            currentQuestion={currentQuestion}
            activeRun={activeRun}
          />

          <AnswerBox
            answer={answer}
            shakeAnim={shakeAnim}
            answerBoxBg={answerBoxBg}
            answerBoxBorder={answerBoxBorder}
            answerBoxText={answerBoxText}
          />

          <Keypad
            answer={answer}
            keypadLocked={keypadLocked}
            submitDisabled={submitDisabled}
            submitting={submitting}
            onDigit={onDigit}
            onDelete={onDelete}
            onClear={onClear}
            onToggleSign={onToggleSign}
            onSubmit={onSubmit}
          />

          {showRoundOver && (
            <RoundOverOverlay
              showRoundOver={showRoundOver}
              roundOverScore={roundOverScore}
              roundOverRunNumber={roundOverRunNumber}
              state={state}
              onDismiss={onDismiss}
            />
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
