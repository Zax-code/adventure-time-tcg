import { Pressable, Text, View } from "react-native";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";
import { CoinIcon, SparklesIcon } from "../../../components/icons";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { withAlpha } from "./palette";

type RunHistoryCardProps = {
  state: SpeedRunState | null;
  openRuns: Record<number, boolean>;
  onToggle: (runNumber: number) => void;
};

export function RunHistoryCard({
  state,
  openRuns,
  onToggle,
}: RunHistoryCardProps) {
  const { t } = useTranslation();
  const tc = THEME_COLORS[useThemeStore((s) => s.themeName)];
  return (
    <View
      className="rounded-3xl border-2 border-primaryTint p-5"
      style={{
        backgroundColor: tc.surfaceMuted,
        shadowColor: withAlpha(tc.primaryDark, "24"),
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <View className="flex-row items-center gap-2">
        <SparklesIcon size={20} color={tc.primaryDark} />
        <Text className="text-lg font-nunito-bold text-primaryDark">
          {t("quests.speedCalculusRunHistory")}
        </Text>
      </View>

      {(state?.history ?? []).length === 0 ? (
        <Text className="text-sm font-nunito mt-4 text-primaryDark/70">
          {t("quests.speedCalculusNoRunsYet")}
        </Text>
      ) : (
        <View className="gap-3 mt-4">
          {(state?.history ?? []).map((run) => {
            const isOpen = openRuns[run.runNumber] ?? false;
            return (
              <View
                key={run.runNumber}
                className="rounded-2xl border border-primaryTint p-4"
                style={{ backgroundColor: tc.primaryBg }}
              >
                <Pressable
                  onPress={() => onToggle(run.runNumber)}
                  className="flex-row items-center justify-between gap-3"
                >
                  <View className="flex-1">
                    <Text className="text-[15px] font-nunito-bold text-primaryDark">
                      {t("quests.speedCalculusRunLabel", {
                        run: run.runNumber,
                        total: state?.maxRuns ?? 3,
                      })}
                    </Text>
                    <Text className="text-[13px] font-nunito mt-2 text-primaryDark/80">
                      {run.status === "abandoned"
                        ? t("quests.speedCalculusRunExpired")
                        : t("quests.speedCalculusRunSummary", {
                            score: run.score,
                            answered: run.totalAnswered,
                          })}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="flex-row items-center gap-1">
                      <CoinIcon size={16} />
                      <Text className="text-sm font-nunito-bold text-secondaryText">
                        {run.reward}
                      </Text>
                    </View>
                    <View
                      className="flex-row items-center gap-1 rounded-[20px] border border-primaryTint px-3 py-1"
                      style={{
                        backgroundColor: tc.surface,
                        shadowColor: withAlpha(tc.primaryDark, "18"),
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 2,
                        elevation: 1,
                      }}
                    >
                      <Text className="text-xs font-nunito-semibold text-primaryDark">
                        {t("quests.speedCalculusRunDetailsToggle")}
                      </Text>
                      <Text
                        className="text-sm font-nunito-semibold text-primaryDark"
                        style={{
                          transform: [{ rotate: isOpen ? "90deg" : "0deg" }],
                        }}
                      >
                        {"\u203A"}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {isOpen && (
                  <View
                    className="pt-4 mt-4 gap-2 border-t"
                    style={{ borderTopColor: withAlpha(tc.primaryTint, "B3") }}
                  >
                    {run.history.map((entry) => (
                      <View
                        key={`${run.runNumber}-${entry.index}`}
                        className={`rounded-2xl border px-3 py-2 ${entry.isCorrect ? "border-successBorder bg-successTint" : "border-dangerBorder bg-dangerTint"}`}
                        style={{
                          shadowColor: withAlpha(
                            entry.isCorrect ? tc.successDark : tc.dangerDark,
                            "18",
                          ),
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.04,
                          shadowRadius: 2,
                          elevation: 1,
                        }}
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <Text
                            className={`text-[13px] font-nunito-semibold ${entry.isCorrect ? "text-successText" : "text-dangerText"}`}
                          >
                            {t("quests.speedCalculusHistoryQuestion", {
                              current: entry.index + 1,
                            })}
                          </Text>
                          <Text
                            className={`text-[13px] font-nunito-semibold ${entry.isCorrect ? "text-successDark" : "text-dangerDark"}`}
                          >
                            {entry.left} {entry.operator} {entry.right}
                          </Text>
                        </View>
                        <Text
                          className={`text-[13px] font-nunito mt-1 ${entry.isCorrect ? "text-successDark" : "text-dangerDark"}`}
                        >
                          {entry.wasAnswered
                            ? t("quests.speedCalculusHistoryUserAnswer", {
                                answer: entry.userAnswer ?? "",
                              })
                            : t("quests.speedCalculusHistoryUnanswered")}
                        </Text>
                        {entry.correctAnswer !== null && (
                          <Text className="text-[13px] font-nunito text-dangerDark mt-0.5">
                            {t("quests.speedCalculusHistoryCorrectAnswer", {
                              answer: entry.correctAnswer,
                            })}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
