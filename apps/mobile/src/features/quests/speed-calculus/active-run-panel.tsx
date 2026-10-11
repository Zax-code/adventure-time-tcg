import { Modal, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { SpeedRunState } from "@adventure-time/api-client";

import Pause from "lucide-react-native/icons/pause";

import { Button } from "../../../components/ui/button";
import { IconTile } from "../../../components/ui/icon-tile";
import {
  getBackdropColor,
  getElevation,
  useThemeName,
} from "../../../components/ui/tokens";
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
  feedbackSlide: SharedValue<number>;
  feedbackOpacity: SharedValue<number>;
  answer: string;
  shakeAnim: SharedValue<number>;
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
  const themeName = useThemeName();
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
            <View
              className="absolute inset-0 items-center justify-center p-ds-6"
              style={{ backgroundColor: getBackdropColor(themeName) }}
            >
              <View
                className="w-full max-w-[342px] items-center gap-ds-4 rounded-ds-xl bg-surface p-ds-5"
                style={{ boxShadow: getElevation(themeName, "overlay") }}
              >
                <IconTile icon={Pause} size={48} />
                <View className="items-center gap-[6px]">
                  <Text className="font-nunito-bold text-ds-overline uppercase tracking-[1px] text-fgMuted">
                    {t("quests.speedCalculusPausedTitle")}
                  </Text>
                  <Text
                    accessibilityRole="header"
                    className="text-center font-nunito-extrabold text-[20px] leading-[24px] text-fg"
                  >
                    {t("quests.speedCalculusPausedHeading")}
                  </Text>
                  <Text className="text-center font-nunito text-ds-body text-fgMuted">
                    {t("quests.speedCalculusPausedBody")}
                  </Text>
                </View>
                <View className="w-full flex-row gap-ds-3">
                  <Button tone="ghost" onPress={onLeavePaused} className="flex-1">
                    {pausedBackLabel}
                  </Button>
                  <Button onPress={onResume} className="flex-1">
                    {t("quests.speedCalculusResume")}
                  </Button>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
