import { useRouter } from "expo-router";
import { Text } from "react-native";

import { StackHeader } from "../../components/ui/stack-header";
import { navigateBackFromQuest } from "./quest-navigation";

type QuestScreenHeaderProps = {
  title: string;
  backLabel: string;
  backTestID?: string;
  fallbackHref?: string;
};

// Quest screens' StackHeader. Render it directly under the safe area with no
// horizontal padding around it so every pushed screen's header sits at the
// same position.
export function QuestScreenHeader({
  title,
  backLabel,
  backTestID = "quest-screen-back",
  fallbackHref = "/(tabs)/quests",
}: QuestScreenHeaderProps) {
  const router = useRouter();

  return (
    <StackHeader
      title={title}
      backLabel={backLabel}
      backTestID={backTestID}
      onBack={() => navigateBackFromQuest(router, fallbackHref)}
    />
  );
}

export function QuestScreenDescription({ children }: { children: string }) {
  return (
    <Text className="text-center font-nunito text-sm leading-5 text-fgMuted">
      {children}
    </Text>
  );
}
