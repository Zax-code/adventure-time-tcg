import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";

type QuestScreenHeaderProps = {
  title: string;
  backLabel: string;
  backTestID?: string;
  fallbackHref?: string;
};

export function navigateBackFromQuest(
  router: Pick<ReturnType<typeof useRouter>, "dismissTo">,
  fallbackHref = "/(tabs)/quests",
) {
  router.dismissTo(fallbackHref as never);
}

export function QuestScreenHeader({
  title,
  backLabel,
  backTestID = "quest-screen-back",
  fallbackHref = "/(tabs)/quests",
}: QuestScreenHeaderProps) {
  const router = useRouter();
  const tc = THEME_COLORS[useThemeStore((state) => state.themeName)];

  const handleBack = () => {
    navigateBackFromQuest(router, fallbackHref);
  };

  return (
    <View className="gap-2">
      <View className="min-h-11 flex-row items-center">
        <Pressable
          onPress={handleBack}
          hitSlop={4}
          className="h-11 w-11 items-center justify-center rounded-2xl border border-primaryBorder bg-surface"
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          testID={backTestID}
        >
          <Ionicons name="chevron-back" size={22} color={tc.primaryDark} />
        </Pressable>

        <View className="flex-1 px-3">
          <Text
            className="text-center font-nunito-extrabold text-[22px] leading-7 text-fg"
            accessibilityRole="header"
            accessibilityLabel={title}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.6}
            minimumFontScale={0.72}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>

        <View
          className="h-11 w-11"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    </View>
  );
}

export function QuestScreenDescription({ children }: { children: string }) {
  return (
    <Text className="text-center font-nunito text-sm leading-5 text-fgMuted">
      {children}
    </Text>
  );
}
