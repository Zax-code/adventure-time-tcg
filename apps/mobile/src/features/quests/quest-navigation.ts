import type { useRouter } from "expo-router";

export function navigateBackFromQuest(
  router: Pick<ReturnType<typeof useRouter>, "dismissTo">,
  fallbackHref = "/(tabs)/quests",
) {
  router.dismissTo(fallbackHref as never);
}
