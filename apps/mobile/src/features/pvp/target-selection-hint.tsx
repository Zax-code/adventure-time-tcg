import { Text, View } from "react-native";

import { useTranslation } from "../../i18n";
import type { TargetingMode } from "./types";

interface TargetSelectionHintProps {
  targeting: TargetingMode | null;
}

export function TargetSelectionHint({ targeting }: TargetSelectionHintProps) {
  const { t } = useTranslation();
  if (!targeting) return null;

  const label =
    targeting.stage === "copy-source"
      ? t("pvp.targetHint.sourceUnit")
      : targeting.targetLabel === "ally"
        ? t("pvp.targetHint.ally")
        : targeting.targetLabel === "any"
          ? t("pvp.targetHint.any")
          : t("pvp.targetHint.target");

  return (
    <View
      style={{
        position: "absolute",
        top: 8,
        alignSelf: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        zIndex: 50,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 14,
          fontFamily: "Nunito_700Bold",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
