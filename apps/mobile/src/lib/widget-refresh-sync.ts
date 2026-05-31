import { apiClient, getStoredUser } from "./api";
import { syncStepQuestWidgetSnapshot } from "./step-quest-widget";

export async function refreshWidgetSnapshotFromServer() {
  const user = await getStoredUser();
  if (!user || user.preferredStepSource !== "fitbit") {
    return false;
  }

  const quests = await apiClient.quests();
  await syncStepQuestWidgetSnapshot(quests, user.preferredLanguage);
  return true;
}
