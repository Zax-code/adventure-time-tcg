import { useMemo } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { getStrongAgainst, getWeakAgainst } from "@adventure-time/game-engine";
import type { PvpAction } from "@adventure-time/api-client";
import type { ComponentType } from "react";

import { ThemedExpoButton } from "../../components/expo-ui/themed-button";
import { ZapIcon, SwordsIcon, SparklesIcon } from "../../components/icons";
import { useTranslation } from "../../i18n";
import { localizeRarityName, localizeTypeName } from "../../lib/combat-i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
import { BattleFullScreenSheet } from "./battle-full-screen-sheet";
import { resolveBattleImageUrl } from "./image-url";
import {
  prepareBattleAction,
  type MyMatchView,
  type PvpUnitState,
  type TargetingMode,
} from "./types";

interface ActionModalProps {
  visible: boolean;
  unit: PvpUnitState | null;
  matchView: MyMatchView;
  onClose: () => void;
  onSelectAction: (
    mode: Omit<TargetingMode, "validTargetIds"> & { validTargetIds?: string[] },
  ) => void;
  onSubmitAction: (action: PvpAction) => void;
}

export function ActionModal({
  visible,
  unit,
  matchView,
  onClose,
  onSelectAction,
  onSubmitAction,
}: ActionModalProps) {
  const { t } = useTranslation();
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const { myPlayer, opponentPlayer, abilityDefinitions, battleState } =
    matchView;
  const skillKey = unit?.skill ?? undefined;
  const ultimateKey = unit?.ultimate ?? undefined;
  const energy = myPlayer.energy;
  const skillDef = skillKey ? abilityDefinitions?.[skillKey] : undefined;
  const ultimateDef = ultimateKey
    ? abilityDefinitions?.[ultimateKey]
    : undefined;
  const isSilenced =
    unit?.statuses.some((status) => status.name === "Silence") ?? false;
  const skillCd = skillKey && unit ? (unit.cooldowns[skillKey] ?? 0) : 0;
  const ultimateCd =
    ultimateKey && unit ? (unit.cooldowns[ultimateKey] ?? 0) : 0;
  const strongTypes = unit ? getStrongAgainst(unit.type as never) : [];
  const weakTypes = unit ? getWeakAgainst(unit.type as never) : [];

  const imageUrl = resolveBattleImageUrl(unit?.imageUrl);

  const actionCards = useMemo(() => {
    if (!unit) {
      return [];
    }

    return [
      {
        key: "basic" as const,
        label: t("pvp.action.basic"),
        subtitle: t("pvp.action.basicSubtitle"),
        Icon: SwordsIcon as ComponentType<{ size?: number; color?: string }>,
        iconColor: "#4B5563",
        tint: "bg-slate-100",
        border: "border-slate-200",
        text: "text-slate-700",
        cost: 1,
        disabled: energy < 1,
        note: energy < 1 ? t("pvp.action.notEnoughEnergy") : null,
      },
      {
        key: "skill" as const,
        label: skillDef?.name ?? t("pvp.action.skillFallback"),
        subtitle: skillDef?.description ?? "",
        Icon: ZapIcon as ComponentType<{ size?: number; color?: string }>,
        iconColor: "#1D4ED8",
        tint: "bg-infoTint",
        border: "border-infoBorder",
        text: "text-infoDark",
        cost: skillDef?.cost ?? 0,
        disabled:
          !skillDef ||
          energy < (skillDef?.cost ?? 0) ||
          skillCd > 0 ||
          isSilenced,
        note:
          skillCd > 0
            ? t("pvp.action.cooldown", { count: skillCd })
            : isSilenced
              ? t("pvp.action.silenced")
              : energy < (skillDef?.cost ?? 0)
                ? t("pvp.action.notEnoughEnergy")
                : null,
      },
      {
        key: "ultimate" as const,
        label: ultimateDef?.name ?? t("pvp.action.ultimateFallback"),
        subtitle: ultimateDef?.description ?? "",
        Icon: SparklesIcon as ComponentType<{ size?: number; color?: string }>,
        iconColor: "#BE185D",
        tint: "bg-accentTint",
        border: "border-accent",
        text: "text-accentText",
        cost: ultimateDef?.cost ?? 0,
        disabled:
          !ultimateDef ||
          energy < (ultimateDef?.cost ?? 0) ||
          ultimateCd > 0 ||
          isSilenced ||
          unit.usedUltimate,
        note: unit.usedUltimate
          ? t("pvp.action.usedAlready")
          : ultimateCd > 0
            ? t("pvp.action.cooldown", { count: ultimateCd })
            : isSilenced
              ? t("pvp.action.silenced")
              : energy < (ultimateDef?.cost ?? 0)
                ? t("pvp.action.notEnoughEnergy")
                : null,
      },
    ];
  }, [energy, isSilenced, skillCd, skillDef, t, ultimateCd, ultimateDef, unit]);

  const handleAction = (actionKey: "basic" | "skill" | "ultimate") => {
    if (!unit) {
      return;
    }

    const abilityKey =
      actionKey === "skill"
        ? skillKey
        : actionKey === "ultimate"
          ? ultimateKey
          : undefined;
    const prepared = prepareBattleAction(
      battleState,
      unit.instanceId,
      actionKey,
      abilityKey,
    );
    if (!prepared) {
      return;
    }

    if (!prepared.requiresTargetSelection && prepared.actionKind !== "copy") {
      onSubmitAction(
        prepared.actionKind === "basic"
          ? {
              kind: "basic",
              actorInstanceId: prepared.actorInstanceId,
              targetInstanceId: prepared.validTargetIds[0] ?? "",
            }
          : {
              kind: prepared.actionKind,
              actorInstanceId: prepared.actorInstanceId,
              abilityKey: prepared.abilityKey!,
            },
      );
      onClose();
      return;
    }

    onSelectAction({
      actorInstanceId: prepared.actorInstanceId,
      actionKind: prepared.actionKind,
      abilityKey: prepared.abilityKey,
      sourceInstanceId: prepared.sourceInstanceId,
      copiedAbilityKey: prepared.copiedAbilityKey,
      stage: prepared.stage,
      targetLabel: prepared.targetLabel,
      validTargetIds: prepared.validTargetIds,
    });
    onClose();
  };

  if (!unit) {
    return null;
  }

  return (
    <BattleFullScreenSheet
      visible={visible}
      title={t("pvp.action.title")}
      onClose={onClose}
      testID="pvp-action-modal"
    >
      <View className="px-4 pb-4 pt-4">
        <View className="overflow-hidden rounded-[28px] border border-primaryTint bg-white shadow-sm">
          <View className="flex-row">
            <View className="w-1/2 bg-slate-900 px-5 py-5">
              <View
                className="overflow-hidden rounded-[24px] bg-slate-800"
                style={{ width: "100%", aspectRatio: 320 / 192 }}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-slate-700">
                    <Text className="font-nunito-extrabold text-6xl text-white">
                      {unit.name.charAt(0)}
                    </Text>
                  </View>
                )}
                <LinearGradient
                  colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.85)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                  }}
                />
                <View className="absolute left-4 top-4 rounded-xl bg-black/55 px-3 py-1.5">
                  <Text className="font-nunito-bold text-xs text-white">
                    {localizeTypeName(unit.type, t)}
                  </Text>
                </View>
              </View>

              <View className="mt-4 gap-1">
                <Text
                  className="font-nunito text-base italic text-fgMuted"
                  numberOfLines={1}
                >
                  {unit.name}
                </Text>
                <Text
                  className="font-nunito-extrabold text-3xl text-fg"
                  numberOfLines={2}
                >
                  {unit.character || unit.name}
                </Text>
                <Text className="font-nunito-bold text-sm text-fgMuted">
                  {localizeRarityName(unit.rarity, t)}
                </Text>
              </View>

              <View className="mt-4 flex-row flex-wrap gap-2">
                <StatChip
                  label="ATK"
                  value={unit.attack}
                  base={unit.baseAttack}
                />
                <StatChip
                  label="DEF"
                  value={unit.defense}
                  base={unit.baseDefense}
                />
                <StatChip
                  label="SPD"
                  value={unit.speed}
                  base={unit.baseSpeed}
                />
              </View>

              <View className="mt-5 rounded-2xl bg-primaryBg px-4 py-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2 rounded-full bg-secondaryTint px-3 py-1.5">
                    <ZapIcon size={14} color="#854D0E" />
                    <Text className="font-nunito-bold text-secondaryText">
                      {t("pvp.action.energy", { count: energy })}
                    </Text>
                  </View>
                  <Text className="font-nunito-semibold text-xs text-fgMuted">
                    {t("pvp.action.activeEnemies", {
                      count: opponentPlayer.units.filter(
                        (enemy) => enemy.hp > 0,
                      ).length,
                    })}
                  </Text>
                </View>
                {strongTypes.length > 0 || weakTypes.length > 0 ? (
                  <View className="mt-3 gap-1">
                    {strongTypes.length > 0 ? (
                      <Text className="font-nunito text-xs text-successDark">
                        {t("pvp.action.strongAgainst", {
                          value: strongTypes
                            .map((type) => localizeTypeName(type, t))
                            .join(", "),
                        })}
                      </Text>
                    ) : null}
                    {weakTypes.length > 0 ? (
                      <Text className="font-nunito text-xs text-dangerDark">
                        {t("pvp.action.weakAgainst", {
                          value: weakTypes
                            .map((type) => localizeTypeName(type, t))
                            .join(", "),
                        })}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            <View className="w-1/2 gap-3 px-4 py-4">
              {actionCards.map((card) => (
                <ThemedExpoButton
                  key={card.key}
                  disabled={card.disabled}
                  onPress={() => handleAction(card.key)}
                  testID={`pvp-action-${card.key}-button`}
                  variant={
                    card.key === "ultimate"
                      ? "warning"
                      : card.key === "skill"
                        ? "secondary"
                        : "ghost"
                  }
                  fallbackLayout="stretch"
                  fallbackAppearance={{
                    backgroundColor:
                      card.key === "ultimate"
                        ? "#FDF2F8"
                        : card.key === "skill"
                          ? tc.infoTint
                          : "#F1F5F9",
                    borderColor:
                      card.key === "ultimate"
                        ? tc.accent
                        : card.key === "skill"
                          ? tc.infoBorder
                          : "#CBD5E1",
                    borderRadius: 16,
                    foregroundColor:
                      card.key === "ultimate"
                        ? tc.accentText
                        : card.key === "skill"
                          ? tc.infoDark
                          : "#334155",
                    gradientColors: null,
                    minHeight: 0,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                  }}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 flex-row gap-3">
                      <View className={`rounded-xl p-2 ${card.tint}`}>
                        <card.Icon size={18} color={card.iconColor} />
                      </View>
                      <View className="flex-1">
                        <Text
                          className={`font-nunito-bold text-base ${card.text}`}
                        >
                          {card.label}
                        </Text>
                        <Text className="mt-1 font-nunito text-xs leading-4 text-fgMuted">
                          {card.subtitle}
                        </Text>
                        {card.note ? (
                          <Text className="mt-2 font-nunito-semibold text-xs text-dangerDark">
                            {card.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View className="rounded-full bg-secondaryTint px-2.5 py-1">
                      <Text className="font-nunito-bold text-secondaryText">
                        {card.cost} EN
                      </Text>
                    </View>
                  </View>
                </ThemedExpoButton>
              ))}

              <ThemedExpoButton
                onPress={() => {
                  onSubmitAction({ kind: "pass" });
                  onClose();
                }}
                testID="pvp-action-pass-button"
                variant="secondary"
                fallbackAppearance={{
                  backgroundColor: "#475569",
                  borderColor: "#475569",
                  borderRadius: 16,
                  foregroundColor: "#FFFFFF",
                  gradientColors: null,
                  minHeight: 0,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  textStyle: {
                    fontFamily: "Nunito_700Bold",
                    fontSize: 14,
                  },
                }}
              >
                {t("pvp.action.pass")}
              </ThemedExpoButton>
            </View>
          </View>
        </View>
      </View>
    </BattleFullScreenSheet>
  );
}

function StatChip({
  label,
  value,
  base,
}: {
  label: string;
  value: number;
  base?: number;
}) {
  const delta = base != null ? value - base : 0;

  return (
    <View className="rounded-full bg-black/25 px-2.5 py-1">
      <Text className="font-nunito-bold text-xs text-white">
        {label} {value}
        {delta !== 0 ? ` ${delta > 0 ? `+${delta}` : delta}` : ""}
      </Text>
    </View>
  );
}
