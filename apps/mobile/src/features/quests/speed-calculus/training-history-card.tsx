import { Pressable, Text, View } from "react-native";
import type { SpeedRunState } from "@adventure-time/api-client";

import { useTranslation } from "../../../i18n";
import { SparklesIcon } from "../../../components/icons";
import { useThemeStore } from "../../../stores/theme-store";
import { THEME_COLORS } from "../../../theme/themes";
import { withAlpha } from "./palette";

type TrainingHistoryCardProps = {
  lastRun: SpeedRunState["history"][number] | null;
  isOpen: boolean;
  onToggle: () => void;
};

export function TrainingHistoryCard({
  lastRun,
  isOpen,
  onToggle,
}: TrainingHistoryCardProps) {
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
          {t("quests.speedCalculusTrainingLastRun")}
        </Text>
      </View>

      {!lastRun ? (
        <Text className="mt-4 text-sm font-nunito text-primaryDark/70">
          {t("quests.speedCalculusTrainingNoRunsYet")}
        </Text>
      ) : (
        <View
          className="mt-4 rounded-2xl border border-primaryTint p-4"
          style={{ backgroundColor: tc.primaryBg }}
        >
          <Pressable
            onPress={onToggle}
            className="flex-row items-center justify-between gap-3"
          >
            <View className="flex-1">
              <Text className="text-[15px] font-nunito-bold text-primaryDark">
                {t("quests.speedCalculusTrainingSessionLabel")}
              </Text>
              <Text className="mt-2 text-[13px] font-nunito text-primaryDark/80">
                {t("quests.speedCalculusTrainingSummary", {
                  score: lastRun.score,
                  answered: lastRun.totalAnswered,
                })}
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
                style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
              >
                {"\u203A"}
              </Text>
            </View>
          </Pressable>

          {isOpen ? (
            <View
              className="mt-4 gap-2 border-t pt-4"
              style={{ borderTopColor: withAlpha(tc.primaryTint, "B3") }}
            >
              {lastRun.history.map((entry) => (
                <View
                  key={`training-${entry.index}`}
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
                    className={`mt-1 text-[13px] font-nunito ${entry.isCorrect ? "text-successDark" : "text-dangerDark"}`}
                  >
                    {entry.wasAnswered
                      ? t("quests.speedCalculusHistoryUserAnswer", {
                          answer: entry.userAnswer ?? "",
                        })
                      : t("quests.speedCalculusHistoryUnanswered")}
                  </Text>
                  {entry.correctAnswer !== null ? (
                    <Text className="mt-0.5 text-[13px] font-nunito text-dangerDark">
                      {t("quests.speedCalculusHistoryCorrectAnswer", {
                        answer: entry.correctAnswer,
                      })}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
