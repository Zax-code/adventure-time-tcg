import { apiClient, getStoredUser } from "./api";
import { syncStepQuestWidgetSnapshot } from "./step-quest-widget";
import { getStoredLocale } from "../stores/locale-store";
import { getStoredThemeName } from "../stores/theme-store";

export async function refreshWidgetSnapshotFromServer() {
  const user = await getStoredUser();
  if (!user || user.preferredStepSource !== "fitbit") {
    return false;
  }

  const quests = await apiClient.quests();
  const locale = await getStoredLocale();
  const themeName = await getStoredThemeName();
  await syncStepQuestWidgetSnapshot(quests, locale, themeName);
  return true;
}
