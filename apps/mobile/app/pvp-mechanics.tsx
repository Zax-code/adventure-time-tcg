import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeStore } from "../src/stores/theme-store";
import { THEME_COLORS, THEME_VARS } from "../src/theme/themes";
import { useTranslation } from "../src/i18n";

export default function PvpMechanicsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeName = useThemeStore((s) => s.themeName);
  const tc = THEME_COLORS[themeName];
  const { t } = useTranslation();

  return (
    <View style={[{ flex: 1 }, THEME_VARS[themeName]]}>
      <View className="flex-1 bg-bg">
        {/* Drag handle */}
        <View className="w-9 h-1 rounded-full bg-muted self-center mt-2 mb-1" />

        {/* Header */}
        <LinearGradient
          colors={[tc.primaryDark, tc.primary]}
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
            {t("pvp.mechanics.title")}
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
          <Text className="font-nunito text-sm text-primaryStrong">
            {t("pvp.mechanics.intro")}
          </Text>

          {/* Objective */}
          <View className="gap-2 rounded-2xl border border-dangerBorder bg-dangerTint p-4">
            <Text className="font-nunito-bold text-base text-dangerText">
              {t("pvp.mechanics.objectiveTitle")}
            </Text>
            <Text className="font-nunito text-sm text-fg">
              {t("pvp.mechanics.objectiveBody")}
            </Text>
          </View>

          {/* Team Setup */}
          <View className="gap-2 rounded-2xl border border-accentBorder bg-accentTint p-4">
            <Text className="font-nunito-bold text-base text-accentText">
              {t("pvp.mechanics.teamTitle")}
            </Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.teamItem1")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.teamItem2")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.teamItem3")}</Text>
          </View>

          {/* Turn Flow */}
          <View className="gap-2 rounded-2xl border border-dangerBorder bg-dangerTint p-4">
            <Text className="font-nunito-bold text-base text-dangerText">
              {t("pvp.mechanics.turnTitle")}
            </Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.turnItem1")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.turnItem2")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.turnItem3")}</Text>
          </View>

          {/* Actions & Costs */}
          <View className="gap-2 rounded-2xl border border-accentBorder bg-accentTint p-4">
            <Text className="font-nunito-bold text-base text-accentText">
              {t("pvp.mechanics.actionsTitle")}
            </Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.actionsItem1")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.actionsItem2")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.actionsItem3")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.actionsItem4")}</Text>
          </View>

          {/* Bench Swap */}
          <View className="gap-2 rounded-2xl border border-dangerBorder bg-dangerTint p-4">
            <Text className="font-nunito-bold text-base text-dangerText">
              {t("pvp.mechanics.swapTitle")}
            </Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.swapItem1")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.swapItem2")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.swapItem3")}</Text>
          </View>

          {/* Targeting & Damage */}
          <View className="gap-2 rounded-2xl border border-accentBorder bg-accentTint p-4">
            <Text className="font-nunito-bold text-base text-accentText">
              {t("pvp.mechanics.targetingTitle")}
            </Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.targetingItem1")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.targetingItem2")}</Text>
            <Text className="font-nunito text-sm text-fg">• {t("pvp.mechanics.targetingItem3")}</Text>
          </View>

          {/* Statuses & Cooldowns */}
          <View className="gap-2 rounded-2xl border border-dangerBorder bg-dangerTint p-4">
            <Text className="font-nunito-bold text-base text-dangerText">
              {t("pvp.mechanics.statusTitle")}
            </Text>
            <Text className="font-nunito text-sm text-fg">
              {t("pvp.mechanics.statusBody")}
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
