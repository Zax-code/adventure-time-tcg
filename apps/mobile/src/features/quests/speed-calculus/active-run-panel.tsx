import { Animated, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";
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
  sessionLabel: string;
  roundOverBackLabel: string;
  pausedBackLabel: string;
  runDurationSeconds: number;
  remainingSeconds: number;
  pauseRemainingSeconds: number;
  displayedCorrectAnswers: number;
  isManuallyPaused: boolean;
  feedback: FeedbackType;
  feedbackSlide: Animated.Value;
  feedbackOpacity: Animated.Value;
  answer: string;
  shakeAnim: Animated.Value;
  answerBoxBg: string;
  answerBoxBorder: string;
  answerBoxText: string;
  answerPlaceholderText: string;
  submitting: boolean;
  keypadLocked: boolean;
  submitDisabled: boolean;
  currentQuestion: Question | null;
  onPause: () => void;
  onResume: () => void;
  onLeavePaused: () => void;
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
  sessionLabel,
  roundOverBackLabel,
  pausedBackLabel,
  runDurationSeconds,
  remainingSeconds,
  pauseRemainingSeconds,
  displayedCorrectAnswers,
  isManuallyPaused,
  feedback,
  feedbackSlide,
  feedbackOpacity,
  answer,
  shakeAnim,
  answerBoxBg,
  answerBoxBorder,
  answerBoxText,
  answerPlaceholderText,
  submitting,
  keypadLocked,
  submitDisabled,
  currentQuestion,
  onPause,
  onResume,
  onLeavePaused,
  onDigit,
  onDelete,
  onClear,
  onToggleSign,
  onSubmit,
  onDismiss,
}: ActiveRunPanelProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={
        isManuallyPaused
          ? onLeavePaused
          : () => {
              /* no-op during active run */
            }
      }
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          className="flex-1 bg-primaryBg"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <HudCard
            activeRun={activeRun}
            runDurationSeconds={runDurationSeconds}
            sessionLabel={sessionLabel}
            remainingSeconds={remainingSeconds}
            pauseRemainingSeconds={pauseRemainingSeconds}
            displayedCorrectAnswers={displayedCorrectAnswers}
            isManuallyPaused={isManuallyPaused}
            onPause={onPause}
            pauseDisabled={
              !activeRun ||
              pauseRemainingSeconds > 0 ||
              isManuallyPaused ||
              submitting
            }
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
            answerPlaceholderText={answerPlaceholderText}
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
              sessionLabel={sessionLabel}
              backLabel={roundOverBackLabel}
              onDismiss={onDismiss}
            />
          )}

          {isManuallyPaused ? (
            <View className="absolute inset-0 items-center justify-center bg-primaryBg/95 px-6">
              <View className="w-full max-w-[320px] rounded-[28px] border border-primaryBorder bg-surface px-6 py-7 items-center">
                <Text className="text-[11px] font-nunito-bold uppercase tracking-[3px] text-primary/60">
                  {t("quests.speedCalculusPausedTitle")}
                </Text>
                <Text className="mt-3 text-center font-nunito-extrabold text-3xl text-primaryDark">
                  {t("quests.speedCalculusPausedHeading")}
                </Text>
                <Text className="mt-3 text-center font-nunito text-sm text-primaryDark/70">
                  {t("quests.speedCalculusPausedBody")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onResume}
                  className="mt-6 w-full rounded-2xl bg-primary px-5 py-3 items-center"
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Text className="font-nunito-extrabold text-base text-primaryBg">
                    {t("quests.speedCalculusResume")}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onLeavePaused}
                  className="mt-3"
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
                  <Text className="font-nunito-semibold text-sm text-primaryDark/70">
                    {pausedBackLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
