import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CardsIcon,
  CheckIcon,
  ClockIcon,
  SwapIcon,
  TrophyIcon,
  ZapIcon,
} from "../src/components/icons";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";
import { useTranslation } from "../src/i18n";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";

function RuleCard({
  title,
  children,
  icon,
  tone,
}: {
  title: string;
  children: ReactNode;
  icon: ReactNode;
  tone: "primary" | "accent" | "info" | "success";
}) {
  const toneClasses =
    tone === "accent"
      ? {
          border: "border-accentBorder",
          bg: "bg-accentTint/80",
          text: "text-accentText",
        }
      : tone === "info"
        ? {
            border: "border-infoBorder",
            bg: "bg-infoTint/80",
            text: "text-infoDark",
          }
        : tone === "success"
          ? {
              border: "border-successBorder",
              bg: "bg-successTint/80",
              text: "text-successDark",
            }
          : {
              border: "border-primaryBorder",
              bg: "bg-primaryTint/80",
              text: "text-primaryDark",
            };

  return (
    <View className={`gap-3 rounded-[24px] border p-4 ${toneClasses.border} ${toneClasses.bg}`}>
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface">
          {icon}
        </View>
        <Text className={`flex-1 font-nunito-bold text-base ${toneClasses.text}`}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function BulletRow({
  children,
  index,
}: {
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-surface">
        {typeof index === "number" ? (
          <Text className="font-nunito-bold text-[11px] text-primaryDark">{index + 1}</Text>
        ) : (
          <CheckIcon size={12} color="#4F46E5" />
        )}
      </View>
      <Text className="flex-1 font-nunito text-sm leading-5 text-fg">{children}</Text>
    </View>
  );
}

export default function PvpMechanicsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeName = useThemeStore((s) => s.themeName);
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();

  return (
    <ModalSheetRoute
      onClose={() => router.back()}
      sheetBackgroundColor={tc.bg}
      handleColor={tc.muted}
      sheetStyle={THEME_VARS[themeName]}
      title={t("pvp.mechanics.title")}
    >
      <View className="flex-1 bg-bg" testID="pvp-mechanics-screen">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ gap: 16, padding: 20, paddingBottom: insets.bottom + 24 }}
        >
          <View
            className="gap-4 rounded-[28px] bg-surface p-4"
            testID="pvp-mechanics-overview-card"
          >
            <Text className="font-nunito text-sm leading-5 text-primaryStrong">
              {t("pvp.mechanics.intro")}
            </Text>

            <View className="rounded-[24px] bg-primaryTint/70 p-4">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface">
                  <TrophyIcon size={20} color={tc.primaryDark} />
                </View>
                <Text className="flex-1 font-nunito-bold text-base text-primaryDark">
                  {t("pvp.mechanics.objectiveTitle")}
                </Text>
              </View>
              <Text className="mt-3 font-nunito text-sm leading-5 text-fg">
                {t("pvp.mechanics.objectiveBody")}
              </Text>
            </View>
          </View>

          <RuleCard
            title={t("pvp.mechanics.teamTitle")}
            icon={<CardsIcon size={20} color={tc.accentText} />}
            tone="accent"
          >
            <BulletRow>{t("pvp.mechanics.teamItem1")}</BulletRow>
            <BulletRow>{t("pvp.mechanics.teamItem2")}</BulletRow>
            <BulletRow>{t("pvp.mechanics.teamItem3")}</BulletRow>
          </RuleCard>

          <RuleCard
            title={t("pvp.mechanics.turnTitle")}
            icon={<ClockIcon size={20} color={tc.infoDark} />}
            tone="info"
          >
            <BulletRow>{t("pvp.mechanics.turnItem1")}</BulletRow>
            <BulletRow>{t("pvp.mechanics.turnItem2")}</BulletRow>
            <BulletRow>{t("pvp.mechanics.turnItem3")}</BulletRow>
          </RuleCard>

          <RuleCard
            title={t("pvp.mechanics.actionsTitle")}
            icon={<ZapIcon size={20} color={tc.successDark} />}
            tone="success"
          >
            <View testID="pvp-mechanics-actions-card">
              <View className="gap-3">
                <BulletRow index={0}>{t("pvp.mechanics.actionsItem1")}</BulletRow>
                <BulletRow index={1}>{t("pvp.mechanics.actionsItem2")}</BulletRow>
                <BulletRow index={2}>{t("pvp.mechanics.actionsItem3")}</BulletRow>
                <BulletRow index={3}>{t("pvp.mechanics.actionsItem4")}</BulletRow>
              </View>
            </View>
          </RuleCard>

          <RuleCard
            title={t("pvp.mechanics.swapTitle")}
            icon={<SwapIcon size={20} color={tc.primaryDark} />}
            tone="primary"
          >
            <BulletRow>{t("pvp.mechanics.swapItem1")}</BulletRow>
            <BulletRow>{t("pvp.mechanics.swapItem2")}</BulletRow>
            <BulletRow>{t("pvp.mechanics.swapItem3")}</BulletRow>
          </RuleCard>

          <RuleCard
            title={t("pvp.mechanics.targetingTitle")}
            icon={<ZapIcon size={20} color={tc.accentText} />}
            tone="accent"
          >
            <BulletRow>{t("pvp.mechanics.targetingItem1")}</BulletRow>
            <BulletRow>{t("pvp.mechanics.targetingItem2")}</BulletRow>
            <BulletRow>{t("pvp.mechanics.targetingItem3")}</BulletRow>
          </RuleCard>

          <RuleCard
            title={t("pvp.mechanics.statusTitle")}
            icon={<ClockIcon size={20} color={tc.infoDark} />}
            tone="info"
          >
            <View testID="pvp-mechanics-status-card">
              <Text className="font-nunito text-sm leading-5 text-fg">
                {t("pvp.mechanics.statusBody")}
              </Text>
            </View>
          </RuleCard>
        </ScrollView>
      </View>
    </ModalSheetRoute>
  );
}
