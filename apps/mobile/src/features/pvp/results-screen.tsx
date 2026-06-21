import { Pressable, StyleSheet, Text, View } from "react-native";

import { SwordsIcon } from "../../components/icons";
import { useTranslation } from "../../i18n";

interface ResultsScreenProps {
  phase: "active" | "ended";
  winnerId?: string | null;
  myUserId: string;
  opponentName: string;
  onBack: () => void;
}

export function ResultsScreen({ phase, winnerId, myUserId, opponentName, onBack }: ResultsScreenProps) {
  const { t } = useTranslation();
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
  const titleStyle = isDraw
    ? styles.titleDraw
    : isWinner
      ? styles.titleWin
      : styles.titleLose;

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <SwordsIcon
          size={64}
          color={isDraw ? "#93C5FD" : isWinner ? "#FACC15" : "#9CA3AF"}
        />
        <Text style={[styles.title, titleStyle]}>
          {t(titleKey)}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>{t("pvp.results.back")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 300,
  },
  content: {
    alignItems: "center",
    padding: 32,
  },
  title: {
    fontSize: 40,
    fontFamily: "Nunito_800ExtraBold",
    marginTop: 16,
    letterSpacing: 2,
  },
  titleWin: {
    color: "#FACC15",
  },
  titleLose: {
    color: "#9CA3AF",
  },
  titleDraw: {
    color: "#93C5FD",
  },
  subtitle: {
    color: "#D1D5DB",
    fontSize: 16,
    marginTop: 8,
    marginBottom: 32,
    textAlign: "center",
  },
  backBtn: {
    backgroundColor: "#3B82F6",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  backBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Nunito_700Bold",
  },
});
