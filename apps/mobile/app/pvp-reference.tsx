import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CheckIcon,
  ClockIcon,
  SwordsIcon,
  TrophyIcon,
  ZapIcon,
} from "../src/components/icons";
import { useTranslation } from "../src/i18n";
import { localizeRarityName, localizeStatusName, localizeTypeName } from "../src/lib/combat-i18n";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";
import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS, type ThemeName } from "../src/theme/themes";

const STATUS_ENTRIES = [
  { name: "Burn", hue: 10 },
  { name: "Freeze", hue: 220 },
  { name: "Shield", hue: 195 },
  { name: "GuardUp", hue: 150 },
  { name: "Vulnerable", hue: 315 },
  { name: "Weakened", hue: 36 },
  { name: "Haste", hue: 48 },
  { name: "Taunt", hue: 345 },
  { name: "Regeneration", hue: 128 },
  { name: "Silence", hue: 260 },
  { name: "SummoningSickness", hue: 24 },
  { name: "Cover", hue: 204 },
  { name: "Stunned", hue: 280 },
  { name: "Poison", hue: 100 },
  { name: "Thorns", hue: 116 },
  { name: "Stealth", hue: 232 },
  { name: "Empower", hue: 30 },
  { name: "Counter", hue: 248 },
  { name: "Mark", hue: 332 },
  { name: "Barrier", hue: 186 },
  { name: "Doom", hue: 350 },
] as const;

const CORE_ITEMS = [
  "speed",
  "cooldown",
  "formation",
  "slotLimits",
  "mitigation",
  "retaliation",
  "cleanse",
] as const;

const TYPE_ROWS = [
  { type: "Hero", strong: ["Undead"], weak: ["Ice"] },
  { type: "Tech", strong: ["Fire"], weak: ["Cosmic"] },
  { type: "Royalty", strong: ["Demon"], weak: ["Magic"] },
  { type: "Candy", strong: ["Hero"], weak: ["Tech"] },
  { type: "Undead", strong: ["Magic"], weak: ["Hero"] },
  { type: "Ice", strong: ["Fire"], weak: ["Undead"] },
  { type: "Fire", strong: ["Ice"], weak: ["Tech"] },
  { type: "Magic", strong: ["Royalty"], weak: ["Undead"] },
  { type: "Demon", strong: ["Hero"], weak: ["Royalty"] },
  { type: "Cosmic", strong: ["Demon"], weak: ["Candy"] },
] as const;

const RARITY_ROWS = [
  { name: "Common", hpBonus: "+0%", atkBonus: "+0%", extraPassive: false },
  { name: "Uncommon", hpBonus: "+2%", atkBonus: "+0%", extraPassive: false },
  { name: "Rare", hpBonus: "+2%", atkBonus: "+1%", extraPassive: false },
  { name: "Epic", hpBonus: "+4%", atkBonus: "+2%", extraPassive: false },
  { name: "Legendary", hpBonus: "+5%", atkBonus: "+3%", extraPassive: true },
] as const;

function getStatusAppearance(
  hue: number,
  themeName: ThemeName,
) {
  const isDark = themeName === "nightosphere";

  return {
    backgroundColor: isDark ? `hsla(${hue}, 62%, 17%, 0.9)` : `hsla(${hue}, 92%, 96%, 1)`,
    borderColor: isDark ? `hsla(${hue}, 68%, 32%, 1)` : `hsla(${hue}, 78%, 82%, 1)`,
    titleColor: isDark ? `hsla(${hue}, 88%, 76%, 1)` : `hsla(${hue}, 72%, 42%, 1)`,
  };
}

function SectionCard({
  title,
  intro,
  icon,
  tone,
  testID,
  children,
}: {
  title: string;
  intro?: string;
  icon: ReactNode;
  tone: "primary" | "accent" | "info" | "success";
  testID?: string;
  children: ReactNode;
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
      <View className="flex-row items-center gap-3" testID={testID}>
        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface">
          {icon}
        </View>
        <Text className={`flex-1 font-nunito-bold text-base ${toneClasses.text}`}>{title}</Text>
      </View>
      {intro ? <Text className="font-nunito text-xs leading-5 text-fgMuted">{intro}</Text> : null}
      {children}
    </View>
  );
}

export default function PvpReferenceScreen() {
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
    >
      <View className="flex-1 bg-bg" testID="pvp-reference-screen">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ gap: 16, padding: 20, paddingBottom: insets.bottom + 24 }}
        >
          <View>
            <Text
              className="font-nunito-extrabold text-[28px] leading-[34px] text-fg"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {t("pvp.reference.title")}
            </Text>
          </View>

          <View
            className="gap-4 rounded-[28px] border border-infoBorder bg-surface p-4"
            testID="pvp-reference-overview-card"
          >
            <Text className="font-nunito text-sm leading-5 text-fgMuted">
              {t("pvp.reference.intro")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <View className="rounded-full bg-infoTint px-3 py-1.5">
                <Text className="font-nunito-bold text-xs text-infoDark">
                  {t("pvp.reference.statusTitle")}
                </Text>
              </View>
              <View className="rounded-full bg-accentTint px-3 py-1.5">
                <Text className="font-nunito-bold text-xs text-accentText">
                  {t("pvp.reference.typeTitle")}
                </Text>
              </View>
              <View className="rounded-full bg-secondaryTint px-3 py-1.5">
                <Text className="font-nunito-bold text-xs text-secondaryText">
                  {t("pvp.reference.rarityTitle")}
                </Text>
              </View>
            </View>
          </View>

          <SectionCard
            title={t("pvp.reference.statusTitle")}
            intro={t("pvp.reference.statusIntro")}
            icon={<ZapIcon size={20} color={tc.infoDark} />}
            tone="info"
            testID="pvp-reference-status-heading"
          >
            <View className="gap-3" testID="pvp-reference-status-grid">
              {STATUS_ENTRIES.map((entry) => {
                const appearance = getStatusAppearance(entry.hue, themeName);

                return (
                  <View
                    key={entry.name}
                    className="rounded-[20px] border p-3"
                    style={{
                      backgroundColor: appearance.backgroundColor,
                      borderColor: appearance.borderColor,
                    }}
                  >
                    <Text
                      className="font-nunito-bold text-sm"
                      style={{ color: appearance.titleColor }}
                    >
                      {localizeStatusName(entry.name, t)}
                    </Text>
                    <Text
                      className="mt-1 font-nunito text-xs leading-5"
                      style={{ color: themeName === "nightosphere" ? tc.fg : tc.fgMuted }}
                    >
                      {t(`pvp.reference.statusDesc.${entry.name}`)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </SectionCard>

          <SectionCard
            title={t("pvp.reference.coreTitle")}
            intro={t("pvp.reference.coreIntro")}
            icon={<ClockIcon size={20} color={tc.successDark} />}
            tone="success"
            testID="pvp-reference-core-heading"
          >
            <View className="gap-3">
              {CORE_ITEMS.map((key) => (
                <View key={key} className="flex-row gap-3 rounded-[20px] border border-successBorder bg-surface px-3 py-3">
                  <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-successTint">
                    <CheckIcon size={12} color={tc.successDark} />
                  </View>
                  <Text className="flex-1 font-nunito text-sm leading-5 text-fg">
                    {t(`pvp.reference.coreItems.${key}`)}
                  </Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard
            title={t("pvp.reference.typeTitle")}
            intro={t("pvp.reference.typeIntro")}
            icon={<SwordsIcon size={20} color={tc.accentText} />}
            tone="accent"
            testID="pvp-reference-type-heading"
          >
            <View className="gap-3">
              {TYPE_ROWS.map((row) => (
                <View key={row.type} className="gap-2 rounded-[20px] border border-accentBorder bg-surface p-3">
                  <Text className="font-nunito-bold text-sm text-fg">
                    {localizeTypeName(row.type, t)}
                  </Text>
                  <View className="rounded-2xl bg-successTint px-3 py-2">
                    <Text className="font-nunito-bold text-xs text-successDark">
                      {t("pvp.reference.strongAgainst")}
                    </Text>
                    <Text className="mt-1 font-nunito text-xs leading-5 text-fg">
                      {row.strong.length > 0
                        ? row.strong.map((type) => localizeTypeName(type, t)).join(", ")
                        : t("pvp.reference.typeSpecialNone")}
                    </Text>
                  </View>
                  <View className="rounded-2xl bg-dangerTint px-3 py-2">
                    <Text className="font-nunito-bold text-xs text-dangerDark">
                      {t("pvp.reference.weakAgainst")}
                    </Text>
                    <Text className="mt-1 font-nunito text-xs leading-5 text-fg">
                      {row.weak.length > 0
                        ? row.weak.map((type) => localizeTypeName(type, t)).join(", ")
                        : t("pvp.reference.typeSpecialNone")}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard
            title={t("pvp.reference.rarityTitle")}
            intro={t("pvp.reference.rarityIntro")}
            icon={<TrophyIcon size={20} color={tc.secondaryText} />}
            tone="primary"
            testID="pvp-reference-rarity-heading"
          >
            <View className="gap-3">
              {RARITY_ROWS.map((row) => (
                <View key={row.name} className="gap-3 rounded-[20px] border border-secondaryBorder bg-surface p-3">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 font-nunito-bold text-sm text-fg">
                      {localizeRarityName(row.name, t)}
                    </Text>
                    <View
                      className={`rounded-full px-3 py-1 ${
                        row.extraPassive ? "bg-successTint" : "bg-surfaceMuted"
                      }`}
                    >
                      <Text
                        className={`font-nunito-bold text-xs ${
                          row.extraPassive ? "text-successDark" : "text-fgMuted"
                        }`}
                      >
                        {row.extraPassive ? t("pvp.reference.rarityYes") : t("pvp.reference.rarityNo")}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1 rounded-2xl bg-primaryTint px-3 py-2">
                      <Text className="font-nunito-bold text-[11px] text-primaryDark">
                        {t("pvp.reference.rarityColHp")}
                      </Text>
                      <Text className="mt-1 font-nunito text-sm text-fg">{row.hpBonus}</Text>
                    </View>
                    <View className="flex-1 rounded-2xl bg-dangerTint px-3 py-2">
                      <Text className="font-nunito-bold text-[11px] text-dangerDark">
                        {t("pvp.reference.rarityColAtk")}
                      </Text>
                      <Text className="mt-1 font-nunito text-sm text-fg">{row.atkBonus}</Text>
                    </View>
                    <View className="flex-1 rounded-2xl bg-secondaryTint px-3 py-2">
                      <Text className="font-nunito-bold text-[11px] text-secondaryText">
                        {t("pvp.reference.rarityColPassive")}
                      </Text>
                      <Text className="mt-1 font-nunito text-sm text-fg">
                        {row.extraPassive ? t("pvp.reference.rarityYes") : t("pvp.reference.rarityNo")}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </SectionCard>
        </ScrollView>
      </View>
    </ModalSheetRoute>
  );
}
