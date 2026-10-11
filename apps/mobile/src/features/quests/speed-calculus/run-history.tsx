import { Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import Timer from "lucide-react-native/icons/timer";
import type { SpeedRunState } from "@adventure-time/api-client";

import { ListRow } from "../../../components/ui/list-row";
import { SectionHeader } from "../../../components/ui/section-header";
import { StatePanel } from "../../../components/ui/state-panel";
import { useTranslation } from "../../../i18n";

type RunHistoryCardProps = {
  state: SpeedRunState | null;
  openRuns: Record<number, boolean>;
  onToggle: (runNumber: number) => void;
};

// Board 04: a "Run history" SectionHeader in the page, then one Card per
// run (expandable answer details) or the empty StatePanel.
export function RunHistoryCard({
  state,
  openRuns,
  onToggle,
}: RunHistoryCardProps) {
  const { t } = useTranslation();
  const history = state?.history ?? [];

  return (
    <View className="gap-ds-3">
      <SectionHeader title={t("quests.speedCalculusRunHistory")} />

      {history.length === 0 ? (
        <StatePanel
          icon={Timer}
          title={t("quests.speedCalculusNoRunsYet")}
          body={t("quests.speedCalculusNoRunsYetBody")}
          testID="speed-calculus-run-history-empty"
        />
      ) : (
        history.map((run) => {
          const isOpen = openRuns[run.runNumber] ?? false;
          return (
            <Animated.View
              key={run.runNumber}
              className="overflow-hidden rounded-ds-lg border border-primaryBorder bg-surface"
              layout={LinearTransition.duration(300)}
            >
              <ListRow
                title={t("quests.speedCalculusRunLabel", {
                  run: run.runNumber,
                  total: state?.maxRuns ?? 3,
                })}
                meta={
                  run.status === "abandoned"
                    ? t("quests.speedCalculusRunExpired")
                    : t("quests.speedCalculusRunSummary", {
                        score: run.score,
                        answered: run.totalAnswered,
                      })
                }
                trailingChip={{
                  label: t("quests.speedCalculusRunReward", {
                    reward: run.reward,
                  }),
                  tone: "secondary",
                }}
                chevron
                divider={isOpen}
                onPress={() => onToggle(run.runNumber)}
                accessibilityLabel={t("quests.speedCalculusRunLabel", {
                  run: run.runNumber,
                  total: state?.maxRuns ?? 3,
                })}
                testID={`speed-calculus-run-${run.runNumber}`}
              />

              {isOpen ? (
                <Animated.View
                  className="gap-ds-2 p-ds-4"
                  entering={FadeIn.duration(180)}
                  exiting={FadeOut.duration(140)}
                >
                  {run.history.map((entry) => (
                    <View
                      key={`${run.runNumber}-${entry.index}`}
                      className={`rounded-ds-md border px-ds-3 py-ds-2 ${entry.isCorrect ? "border-successBorder bg-successTint" : "border-dangerBorder bg-dangerTint"}`}
                    >
                      <View className="flex-row items-center justify-between gap-ds-3">
                        <Text
                          className={`font-nunito-bold text-ds-sm ${entry.isCorrect ? "text-successText" : "text-dangerText"}`}
                        >
                          {t("quests.speedCalculusHistoryQuestion", {
                            current: entry.index + 1,
                          })}
                        </Text>
                        <Text
                          className={`font-nunito-bold text-ds-sm ${entry.isCorrect ? "text-successText" : "text-dangerText"}`}
                        >
                          {entry.left} {entry.operator} {entry.right}
                        </Text>
                      </View>
                      <Text
                        className={`mt-ds-1 font-nunito text-ds-sm ${entry.isCorrect ? "text-successText" : "text-dangerText"}`}
                      >
                        {entry.wasAnswered
                          ? t("quests.speedCalculusHistoryUserAnswer", {
                              answer: entry.userAnswer ?? "",
                            })
                          : t("quests.speedCalculusHistoryUnanswered")}
                      </Text>
                      {entry.correctAnswer !== null ? (
                        <Text className="font-nunito text-ds-sm text-dangerText">
                          {t("quests.speedCalculusHistoryCorrectAnswer", {
                            answer: entry.correctAnswer,
                          })}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </Animated.View>
              ) : null}
            </Animated.View>
          );
        })
      )}
    </View>
  );
}
