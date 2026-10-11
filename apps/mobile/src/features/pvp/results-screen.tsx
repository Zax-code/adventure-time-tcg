import { Text, View } from "react-native";
import Swords from "lucide-react-native/icons/swords";

import { Button } from "../../components/ui/button";
import { IconTile } from "../../components/ui/icon-tile";
import {
  getBackdropColor,
  getElevation,
  useThemeName,
} from "../../components/ui/tokens";
import { useTranslation } from "../../i18n";

interface ResultsScreenProps {
  phase: "active" | "ended";
  winnerId?: string | null;
  myUserId: string;
  opponentName: string;
  onBack: () => void;
}

// End-of-match overlay with the Dialog anatomy: backdrop, surface panel,
// toned icon tile, 20/800 title, body and one Primary action.
export function ResultsScreen({ phase, winnerId, myUserId, opponentName, onBack }: ResultsScreenProps) {
  const { t } = useTranslation();
  const themeName = useThemeName();
  if (phase !== "ended") return null;

  const isDraw = winnerId == null;
  const isWinner = winnerId === myUserId;
  const titleKey = isDraw
    ? "pvp.results.draw"
    : isWinner
      ? "pvp.results.victory"
      : "pvp.results.defeat";
  const subtitle = isDraw
    ? t("pvp.results.drawSubtitle", { opponent: opponentName })
    : isWinner
      ? t("pvp.results.youDefeated", { opponent: opponentName })
      : t("pvp.results.opponentWon", { opponent: opponentName });

  return (
    <View
      className="absolute inset-0 z-[300] items-center justify-center p-ds-6"
      style={{ backgroundColor: getBackdropColor(themeName) }}
    >
      <View
        accessibilityViewIsModal
        className="w-full max-w-[342px] items-center gap-ds-4 rounded-ds-xl bg-surface p-ds-5"
        style={{ boxShadow: getElevation(themeName, "overlay") }}
      >
        <IconTile
          icon={Swords}
          size={48}
          tone={isDraw ? "info" : isWinner ? "secondary" : "danger"}
        />
        <View className="items-center gap-[6px]">
          <Text
            accessibilityRole="header"
            className="text-center font-nunito-extrabold text-[20px] leading-[24px] text-fg"
          >
            {t(titleKey)}
          </Text>
          <Text className="text-center font-nunito text-ds-body text-fgMuted">
            {subtitle}
          </Text>
        </View>
        <Button onPress={onBack} style={{ alignSelf: "stretch" }}>
          {t("pvp.results.back")}
        </Button>
      </View>
    </View>
  );
}
