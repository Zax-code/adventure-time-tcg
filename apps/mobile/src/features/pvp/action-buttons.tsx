import { View } from "react-native";

import ArrowLeftRight from "lucide-react-native/icons/arrow-left-right";
import Check from "lucide-react-native/icons/check";
import X from "lucide-react-native/icons/x";
import Zap from "lucide-react-native/icons/zap";

import { Chip } from "../../components/ui/chip";
import { IconButton } from "../../components/ui/icon-button";
import { useTranslation } from "../../i18n";

interface ActionButtonsProps {
  energy: number;
  maxEnergy: number;
  state: {
    isSwapMode: boolean;
    isTargeting: boolean;
    hasBench: boolean;
    isMyTurn: boolean;
    isActing: boolean;
  };
  onSwapToggle: () => void;
  onCancel: () => void;
  onEndTurn: () => void;
}

export function ActionButtons({
  energy,
  maxEnergy,
  state,
  onSwapToggle,
  onCancel,
  onEndTurn,
}: ActionButtonsProps) {
  const { t } = useTranslation();
  const { isSwapMode, isTargeting, hasBench, isMyTurn, isActing } = state;
  const showCancel = isTargeting || isSwapMode;
  const swapDisabled = !hasBench || !isMyTurn;
  const endDisabled = !isMyTurn || isActing;

  return (
    <View className="absolute bottom-2 right-0 z-50 items-end gap-2">
      <ActionEnergyPill energy={energy} maxEnergy={maxEnergy} />
      <View
        className="flex-row gap-2"
        style={{ transform: [{ translateX: 13 }] }}
      >
        <IconButton
          icon={ArrowLeftRight}
          tone={isSwapMode ? "secondary" : "primary"}
          tinted={isSwapMode}
          onPress={onSwapToggle}
          disabled={swapDisabled}
          hitSlop={4}
          accessibilityLabel={t("pvp.mechanics.swapTitle")}
          testID="pvp-action-swap-button"
        />

        {showCancel && (
          <IconButton
            icon={X}
            tone="danger"
            tinted
            onPress={onCancel}
            hitSlop={4}
            accessibilityLabel={t("common.cancel")}
            testID="pvp-action-cancel-button"
          />
        )}

        <IconButton
          icon={Check}
          tone="success"
          tinted={!endDisabled}
          onPress={onEndTurn}
          disabled={endDisabled}
          hitSlop={4}
          accessibilityLabel={t("pvp.match.endTurnConfirm")}
          testID="pvp-action-end-turn-button"
        />
      </View>
    </View>
  );
}

export function ActionEnergyPill({
  energy,
  maxEnergy,
}: {
  energy: number;
  maxEnergy: number;
}) {
  return <Chip tone="secondary" icon={Zap} label={`${energy}/${maxEnergy}`} />;
}
