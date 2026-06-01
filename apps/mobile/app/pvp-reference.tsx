import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";
import { useTranslation } from "../src/i18n";
import { localizeRarityName, localizeStatusName, localizeTypeName } from "../src/lib/combat-i18n";
import { ModalSheetRoute } from "../src/components/modal-sheet-route";

const STATUS_ENTRIES = [
  { name: "Burn",              colorClass: "text-dangerDark" },
  { name: "Freeze",            colorClass: "text-accentText" },
  { name: "Shield",            colorClass: "text-successDark" },
  { name: "GuardUp",           colorClass: "text-successDark" },
  { name: "Vulnerable",        colorClass: "text-accentText" },
  { name: "Weakened",          colorClass: "text-accentText" },
  { name: "Haste",             colorClass: "text-successDark" },
  { name: "Taunt",             colorClass: "text-infoDark" },
  { name: "Regeneration",      colorClass: "text-successDark" },
  { name: "Regen",             colorClass: "text-successDark" },
  { name: "Silence",           colorClass: "text-accentText" },
  { name: "Cleanse",           colorClass: "text-infoDark" },
  { name: "SummoningSickness", colorClass: "text-infoDark" },
  { name: "Cover",             colorClass: "text-infoDark" },
  { name: "Stunned",           colorClass: "text-accentText" },
  { name: "Poison",            colorClass: "text-accentText" },
  { name: "Thorns",            colorClass: "text-accentText" },
  { name: "Stealth",           colorClass: "text-infoDark" },
  { name: "Empower",           colorClass: "text-successDark" },
  { name: "Counter",           colorClass: "text-successDark" },
  { name: "Mark",              colorClass: "text-accentText" },
  { name: "Barrier",           colorClass: "text-successDark" },
  { name: "Doom",              colorClass: "text-dangerDark" },
] as const;

const CORE_ITEMS = [
  "speed",
  "cooldown",
  "formation",
  "slotLimits",
  "mitigation",
  "retaliation",
] as const;

const TYPE_ROWS = [
  { type: "Hero", strong: [] as string[], weak: [] as string[], hasSpecial: true },
  { type: "Tech", strong: ["Royalty", "Candy"], weak: ["Magic"], hasSpecial: false },
  { type: "Royalty", strong: ["Undead", "Demon"], weak: ["Tech"], hasSpecial: false },
  { type: "Candy", strong: [] as string[], weak: [] as string[], hasSpecial: true },
  { type: "Undead", strong: ["Candy"], weak: ["Royalty", "Fire"], hasSpecial: false },
  { type: "Ice", strong: ["Magic", "Demon"], weak: ["Undead", "Fire"], hasSpecial: false },
  { type: "Fire", strong: ["Undead", "Ice"], weak: ["Magic"], hasSpecial: false },
  { type: "Magic", strong: ["Tech", "Fire"], weak: ["Ice", "Cosmic"], hasSpecial: false },
  { type: "Demon", strong: ["Cosmic"], weak: ["Royalty", "Ice"], hasSpecial: false },
  { type: "Cosmic", strong: ["Magic"], weak: ["Demon"], hasSpecial: false },
] as const;

const RARITY_ROWS = [
  { name: "Common",    hpBonus: "+0%", atkBonus: "+0%", extraPassive: false },
  { name: "Uncommon",  hpBonus: "+2%", atkBonus: "+0%", extraPassive: false },
  { name: "Rare",      hpBonus: "+2%", atkBonus: "+1%", extraPassive: false },
  { name: "Epic",      hpBonus: "+4%", atkBonus: "+2%", extraPassive: false },
  { name: "Legendary", hpBonus: "+5%", atkBonus: "+3%", extraPassive: true  },
] as const;

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
      <View className="flex-1 bg-bg">
        <LinearGradient
          colors={[tc.infoDark, tc.info]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <Text
            style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 20, color: "#fff" }}
          >
            {t("pvp.reference.title")}
          </Text>
          <Pressable onPress={() => router.back()} className="px-3 py-1 rounded-full bg-white/20">
            <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 14, color: "#fff" }}>✕</Text>
          </Pressable>
        </LinearGradient>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ gap: 16, padding: 20, paddingBottom: insets.bottom + 24 }}
        >
          {/* Intro */}
          <Text className="font-nunito text-sm text-fgMuted">
            {t("pvp.reference.intro")}
          </Text>

          {/* Status Effects */}
          <View className="gap-3 rounded-2xl border border-infoBorder bg-infoTint p-4">
            <Text className="font-nunito-bold text-base text-infoDark">
              {t("pvp.reference.statusTitle")}
            </Text>
            <Text className="font-nunito text-xs text-fgMuted">
              {t("pvp.reference.statusIntro")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {STATUS_ENTRIES.map((entry) => (
                <View
                  key={entry.name}
                  className="rounded-xl border border-infoBorder bg-surface p-3"
                  style={{ width: "47%" }}
                >
                  <Text className={`font-nunito-bold text-sm ${entry.colorClass}`}>
                    {localizeStatusName(entry.name, t)}
                  </Text>
                  <Text className="font-nunito text-xs text-fgMuted mt-1">
                    {t(`pvp.reference.statusDesc.${entry.name}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Core Combat Effects */}
          <View className="gap-3 rounded-2xl border border-successBorder bg-successTint p-4">
            <Text className="font-nunito-bold text-base text-successDark">
              {t("pvp.reference.coreTitle")}
            </Text>
            <Text className="font-nunito text-xs text-fgMuted">
              {t("pvp.reference.coreIntro")}
            </Text>
            {CORE_ITEMS.map((key) => (
              <View key={key} className="flex-row gap-2">
                <Text className="font-nunito text-sm text-successDark">•</Text>
                <Text className="font-nunito flex-1 text-sm text-fg">
                  {t(`pvp.reference.coreItems.${key}`)}
                </Text>
              </View>
            ))}
          </View>

          {/* Type Chart */}
          <View className="gap-3 rounded-2xl border border-accentBorder bg-accentTint p-4">
            <Text className="font-nunito-bold text-base text-accentText">
              {t("pvp.reference.typeTitle")}
            </Text>
            <Text className="font-nunito text-xs text-fgMuted">
              {t("pvp.reference.typeIntro")}
            </Text>
            {TYPE_ROWS.map((row) => (
              <View key={row.type} className="gap-1 rounded-xl border border-accentBorder bg-surface p-3">
                <Text className="font-nunito-bold text-sm text-fg">{localizeTypeName(row.type, t)}</Text>
                <Text className="font-nunito text-xs text-successDark">
                  {t("pvp.reference.strongAgainst")}: {row.strong.length > 0 ? row.strong.map((type) => localizeTypeName(type, t)).join(", ") : t("pvp.reference.typeSpecialNone")}
                </Text>
                <Text className="font-nunito text-xs text-dangerDark">
                  {t("pvp.reference.weakAgainst")}: {row.weak.length > 0 ? row.weak.map((type) => localizeTypeName(type, t)).join(", ") : t("pvp.reference.typeSpecialNone")}
                </Text>
                {row.hasSpecial && (
                  <Text className="font-nunito text-xs text-fgMuted mt-0.5">{t(`pvp.reference.typeSpecial.${row.type}`)}</Text>
                )}
              </View>
            ))}
          </View>

          {/* Rarity Differences */}
          <View className="gap-3 rounded-2xl border border-secondaryBorder bg-secondaryTint p-4">
            <Text className="font-nunito-bold text-base text-secondaryText">
              {t("pvp.reference.rarityTitle")}
            </Text>
            <Text className="font-nunito text-xs text-fgMuted">
              {t("pvp.reference.rarityIntro")}
            </Text>
            {/* Header row */}
            <View className="flex-row gap-1 border-b border-secondaryBorder pb-2">
              <Text className="font-nunito-bold flex-1 text-xs text-secondaryText">
                {t("pvp.reference.rarityColRarity")}
              </Text>
              <Text className="font-nunito-bold w-16 text-center text-xs text-secondaryText">
                {t("pvp.reference.rarityColHp")}
              </Text>
              <Text className="font-nunito-bold w-16 text-center text-xs text-secondaryText">
                {t("pvp.reference.rarityColAtk")}
              </Text>
              <Text className="font-nunito-bold w-20 text-center text-xs text-secondaryText">
                {t("pvp.reference.rarityColPassive")}
              </Text>
            </View>
            {RARITY_ROWS.map((row) => (
              <View key={row.name} className="flex-row gap-1 items-center border-b border-secondaryBorder py-1.5">
                 <Text className="font-nunito-semibold flex-1 text-sm text-fg">{localizeRarityName(row.name, t)}</Text>
                <Text className="font-nunito w-16 text-center text-sm text-fgMuted">{row.hpBonus}</Text>
                <Text className="font-nunito w-16 text-center text-sm text-fgMuted">{row.atkBonus}</Text>
                <Text className={`font-nunito-semibold w-20 text-center text-xs ${row.extraPassive ? "text-successDark" : "text-fgMuted"}`}>
                  {row.extraPassive ? t("pvp.reference.rarityYes") : t("pvp.reference.rarityNo")}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </ModalSheetRoute>
  );
}
