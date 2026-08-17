import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ClockIcon,
  DailyNumbersQuestIcon,
  SpeedCalculusQuestIcon,
  StepQuestIcon,
  TrophyIcon,
  WordleQuestIcon,
} from "../src/components/icons";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";
import { useTranslation } from "../src/i18n";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";

function HelpCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-[24px] border border-primaryBorder bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primaryTint">
          {icon}
        </View>
        <Text className="flex-1 font-nunito-extrabold text-base text-fg">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-2xl bg-primaryTint px-4 py-3">
      <Text
        selectable
        className="font-nunito-bold text-sm leading-5 text-primaryDark"
      >
        {children}
      </Text>
    </View>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <Text className="font-nunito text-sm leading-5 text-fg">{children}</Text>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row gap-2.5">
      <View className="mt-2 h-1.5 w-1.5 rounded-full bg-primaryText" />
      <Text className="flex-1 font-nunito text-sm leading-5 text-fg">
        {children}
      </Text>
    </View>
  );
}

export default function LeaderboardHelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];

  return (
    <ModalSheetRoute
      onClose={() => router.back()}
      sheetBackgroundColor={tc.bg}
      handleColor={tc.muted}
      sheetStyle={THEME_VARS[themeName]}
      title={t("rankings.help.title")}
    >
      <View className="flex-1 bg-bg" testID="leaderboard-help-screen">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ gap: 16, padding: 20, paddingBottom: 24 }}
          contentInset={{ bottom: insets.bottom }}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
        >
          <View className="rounded-[24px] bg-primaryTint p-4">
            <Text className="font-nunito-semibold text-sm leading-5 text-primaryStrong">
              {t("rankings.help.intro")}
            </Text>
          </View>

          <HelpCard
            title={t("rankings.help.participationTitle")}
            icon={<TrophyIcon size={22} color={tc.primaryText} />}
          >
            <Body>{t("rankings.help.participationBody")}</Body>
            <Body>{t("rankings.help.participationLive")}</Body>
          </HelpCard>

          <HelpCard
            title={t("rankings.help.allQuestsTitle")}
            icon={<TrophyIcon size={22} color={tc.primaryText} />}
          >
            <Formula>{t("rankings.help.allQuestsFormula")}</Formula>
            <Body>{t("rankings.help.allQuestsBody")}</Body>
          </HelpCard>

          <HelpCard
            title={t("rankings.help.stepsTitle")}
            icon={<StepQuestIcon size={22} color={tc.primaryText} />}
          >
            <Formula>{t("rankings.help.stepsFormula")}</Formula>
            <Body>{t("rankings.help.stepsBody")}</Body>
          </HelpCard>

          <HelpCard
            title={t("rankings.help.dailyNumbersTitle")}
            icon={<DailyNumbersQuestIcon size={22} color={tc.primaryText} />}
          >
            <Formula>
              {t("rankings.help.dailyNumbersFormulaFast")}
              {"\n"}
              {t("rankings.help.dailyNumbersFormulaSlow")}
            </Formula>
            <Body>{t("rankings.help.dailyNumbersBody")}</Body>
          </HelpCard>

          <HelpCard
            title={t("rankings.help.wordleTitle")}
            icon={<WordleQuestIcon size={22} color={tc.primaryText} />}
          >
            <Formula>{t("rankings.help.wordleFormula")}</Formula>
            <Body>{t("rankings.help.wordleBody")}</Body>
          </HelpCard>

          <HelpCard
            title={t("rankings.help.speedCalculusTitle")}
            icon={<SpeedCalculusQuestIcon size={22} color={tc.primaryText} />}
          >
            <Formula>{t("rankings.help.speedCalculusFormula")}</Formula>
            <Body>{t("rankings.help.speedCalculusBody")}</Body>
          </HelpCard>

          <HelpCard
            title={t("rankings.help.perfectTimingTitle")}
            icon={<ClockIcon size={22} color={tc.primaryText} />}
          >
            <Formula>{t("rankings.help.perfectTimingFormula")}</Formula>
            <Body>{t("rankings.help.perfectTimingBody")}</Body>
          </HelpCard>

          <HelpCard
            title={t("rankings.help.periodsTitle")}
            icon={<ClockIcon size={22} color={tc.primaryText} />}
          >
            <Bullet>{t("rankings.help.periodsDaily")}</Bullet>
            <Bullet>{t("rankings.help.periodsWeekly")}</Bullet>
            <Bullet>{t("rankings.help.periodsCutoff")}</Bullet>
            <Bullet>{t("rankings.help.periodsHistory")}</Bullet>
          </HelpCard>
        </ScrollView>
      </View>
    </ModalSheetRoute>
  );
}
