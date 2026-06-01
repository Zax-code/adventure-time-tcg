import { apiClient, getStoredUser } from "./api";
import { syncStepQuestWidgetSnapshot } from "./step-quest-widget";
import { getStoredThemeName } from "../stores/theme-store";

export async function refreshWidgetSnapshotFromServer() {
  const user = await getStoredUser();
  if (!user || user.preferredStepSource !== "fitbit") {
    return false;
  }

  const quests = await apiClient.quests();
  const themeName = await getStoredThemeName();
  await syncStepQuestWidgetSnapshot(quests, user.preferredLanguage, themeName);
  return true;
}
