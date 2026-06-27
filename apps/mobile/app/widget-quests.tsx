import { useEffect, useRef } from "react";
import { Redirect, useRouter } from "expo-router";

import { useSessionStore } from "../src/stores/session-store";
import {
  getLastContentPathname,
  isQuestTabPathname,
} from "../src/lib/widget-route-history";

export default function WidgetQuestsScreen() {
  const router = useRouter();
  const handledStaleQuestLink = useRef(false);
  const hydrated = useSessionStore((state) => state.hydrated);
  const user = useSessionStore((state) => state.user);
  const lastContentPathname = getLastContentPathname();
  const alreadyOnQuestTab = isQuestTabPathname(lastContentPathname);

  useEffect(() => {
    if (
      !hydrated ||
      !user ||
      !alreadyOnQuestTab ||
      handledStaleQuestLink.current
    ) {
      return;
    }

    handledStaleQuestLink.current = true;

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/quests");
  }, [alreadyOnQuestTab, hydrated, router, user]);

  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (alreadyOnQuestTab) {
    return null;
  }

  return <Redirect href="/(tabs)/quests" />;
}
