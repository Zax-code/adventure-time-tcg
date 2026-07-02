import { apiClient, getStoredUser } from "./api";
import { syncStepQuestWidgetSnapshot } from "./step-quest-widget";
import { getStoredLocale } from "../stores/locale-store";
import { getStoredThemeName } from "../stores/theme-store";

export async function refreshWidgetSnapshotFromServer() {
  const user = await getStoredUser();
  if (!user || user.preferredStepSource !== "fitbit") {
    return false;
  }

  const [quests, locale, themeName] = await Promise.all([
    apiClient.quests(),
    getStoredLocale(),
    getStoredThemeName(),
  ]);
  await syncStepQuestWidgetSnapshot(quests, locale, themeName);
  return true;
}
