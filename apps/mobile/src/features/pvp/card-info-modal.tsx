import { Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { BattleFullScreenSheet } from "./battle-full-screen-sheet";
import { useTranslation } from "../../i18n";
import {
  localizeAbilityType,
  localizeRarityName,
  localizeStatusName,
  localizeTypeName,
} from "../../lib/combat-i18n";
import { resolveBattleImageUrl } from "./image-url";
import type { PvpUnitState } from "./types";

interface CardInfoModalProps {
  visible: boolean;
  unit: PvpUnitState | null;
  abilityDefinitions?: Record<
    string,
    {
      key: string;
      name: string;
      description: string;
      type: string;
      cost: number;
      cooldown?: number | null;
      oncePerMatch: boolean;
    }
  >;
  onClose: () => void;
}

export function CardInfoModal({
  visible,
  unit,
  abilityDefinitions,
  onClose,
}: CardInfoModalProps) {
  const { t } = useTranslation();
  if (!unit) {
    return null;
  }

  const imageUrl = resolveBattleImageUrl(unit.imageUrl);

  const hpPct = Math.max(0, unit.hp / Math.max(1, unit.maxHp));
  const hpColor =
    hpPct > 0.5 ? "#16A34A" : hpPct > 0.25 ? "#F59E0B" : "#DC2626";
  const skillDef = unit.skill ? abilityDefinitions?.[unit.skill] : undefined;
  const ultimateDef = unit.ultimate
    ? abilityDefinitions?.[unit.ultimate]
    : undefined;
  const passiveDefs = unit.passives.map((key) => ({
    key,
    definition: abilityDefinitions?.[key],
  }));
  const shouldShowNoPassive =
    unit.rarity === "Legendary" && passiveDefs.length === 0;
  const skillLabel = localizeAbilityType("SKILL", t);
  const ultimateLabel = localizeAbilityType("ULTIMATE", t);
  const skillCooldown =
    unit.skill && unit.cooldowns[unit.skill] ? unit.cooldowns[unit.skill] : 0;
  const ultimateCooldown =
    unit.ultimate && unit.cooldowns[unit.ultimate]
      ? unit.cooldowns[unit.ultimate]
      : 0;

  return (
    <BattleFullScreenSheet
      visible={visible}
      title={t("pvp.cardDetailsTitle")}
      onClose={onClose}
      testID="pvp-card-info-modal"
      closeButtonTestID="pvp-card-info-close-button"
    >
      <View className="pb-4">
        <View className="mx-4 overflow-hidden rounded-[28px] bg-white shadow-sm">
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
                    <Text className="font-nunito-extrabold text-7xl text-white">
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
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />

                <View className="absolute left-4 top-4 rounded-xl bg-black/55 px-3 py-1.5">
                  <Text className="font-nunito-bold text-xs text-white">
                    {localizeTypeName(unit.type, t)}
                  </Text>
                </View>
              </View>

              <View className="mt-4 gap-1">
                <Text className="font-nunito text-base italic text-fgMuted">
                  {unit.name}
                </Text>
                <Text className="font-nunito-extrabold text-3xl text-fg">
                  {unit.character || unit.name}
                </Text>
                <Text className="font-nunito-bold text-sm text-fgMuted">
                  {localizeRarityName(unit.rarity, t)}
                </Text>
              </View>

              {unit.statuses.length > 0 ? (
                <View className="mt-5 gap-2">
                  <Text className="font-nunito-bold text-sm text-white/90">
                    {t("pvp.activeEffects")}
                  </Text>
                  {unit.statuses.map((status, index) => {
                    const isDebuff = [
                      "Burn",
                      "Freeze",
                      "Vulnerable",
                      "Weakened",
                      "Silence",
                      "SummoningSickness",
                      "Stunned",
                      "Poison",
                      "Mark",
                      "Doom",
                    ].includes(status.name);

                    return (
                      <View
                        key={`${status.name}-${index}`}
                        className={`rounded-2xl border px-3 py-3 ${isDebuff ? "border-dangerBorder/60 bg-dangerTint" : "border-infoBorder/60 bg-infoTint"}`}
                      >
                        <View className="flex-row items-center justify-between gap-3">
                          <View className="flex-1">
                            <Text
                              className={`font-nunito-bold text-sm ${isDebuff ? "text-dangerDark" : "text-infoDark"}`}
                            >
                              {localizeStatusName(status.name, t)}
                              {status.magnitude != null
                                ? ` (${status.magnitude})`
                                : ""}
                            </Text>
                            <Text className="mt-1 font-nunito text-xs leading-4 text-fgMuted">
                              {t(`combat.statusDescription.${status.name}`)}
                            </Text>
                          </View>
                          <View
                            className={`rounded-full px-2 py-1 ${isDebuff ? "bg-dangerBorder" : "bg-infoBorder"}`}
                          >
                            <Text
                              className={`font-nunito-bold text-[10px] ${isDebuff ? "text-dangerDark" : "text-infoDark"}`}
                            >
                              {status.duration === -1
                                ? t("pvp.untilUsed")
                                : `${status.duration}T`}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <View className="w-1/2 gap-4 px-5 py-5">
              <View className="gap-1">
                <View className="flex-row items-center justify-between">
                  <Text className="font-nunito-semibold text-sm text-primaryDark">
                    {t("pvp.hp")}
                  </Text>
                  <Text className="font-nunito-bold text-sm text-fg">
                    {unit.hp} / {unit.maxHp}
                  </Text>
                </View>
                <View className="h-3 overflow-hidden rounded-full bg-surfaceMuted">
                  <View
                    style={{
                      width: `${hpPct * 100}%`,
                      height: "100%",
                      backgroundColor: hpColor,
                    }}
                  />
                </View>
              </View>

              <View className="flex-row gap-3">
                <StatCard
                  label={t("pvp.atk")}
                  value={unit.attack}
                  base={unit.baseAttack}
                  bgClass="bg-dangerTint"
                  textClass="text-dangerDark"
                />
                <StatCard
                  label={t("pvp.def")}
                  value={unit.defense}
                  base={unit.baseDefense}
                  bgClass="bg-infoTint"
                  textClass="text-infoDark"
                />
                <StatCard
                  label={t("pvp.spd")}
                  value={unit.speed}
                  base={unit.baseSpeed}
                  bgClass="bg-successTint"
                  textClass="text-successDark"
                />
              </View>

              <View className="gap-2">
                <Text className="font-nunito-bold text-sm text-primaryDark">
                  {t("admin.abilities.title")}
                </Text>
                {passiveDefs.map(({ key, definition }) =>
                  definition ? (
                    <AbilityCard
                      key={definition.key}
                      label={localizeAbilityType("PASSIVE", t)}
                      ability={definition}
                      colorClass="border-infoBorder bg-infoTint"
                      badgeClass="bg-infoBorder text-infoDark"
                    />
                  ) : (
                    <MissingAbilityCard
                      key={key}
                      label={localizeAbilityType("PASSIVE", t)}
                      abilityKey={key}
                      colorClass="border-infoBorder bg-infoTint"
                      badgeClass="bg-infoBorder text-infoDark"
                    />
                  ),
                )}
                {shouldShowNoPassive ? <NoPassiveCard /> : null}
                {skillDef ? (
                  <AbilityCard
                    label={skillLabel}
                    ability={skillDef}
                    cooldownRemaining={skillCooldown}
                    colorClass="border-successBorder bg-successTint"
                    badgeClass="bg-successBorder text-successDark"
                  />
                ) : unit.skill ? (
                  <MissingAbilityCard
                    label={skillLabel}
                    abilityKey={unit.skill}
                    colorClass="border-successBorder bg-successTint"
                    badgeClass="bg-successBorder text-successDark"
                  />
                ) : (
                  <NoAbilityCard label={skillLabel} body={t("pvp.noSkill")} />
                )}
                {ultimateDef ? (
                  <AbilityCard
                    label={ultimateLabel}
                    ability={ultimateDef}
                    cooldownRemaining={ultimateCooldown}
                    used={unit.usedUltimate}
                    colorClass="border-dangerBorder bg-dangerTint"
                    badgeClass="bg-dangerBorder text-dangerDark"
                  />
                ) : unit.ultimate ? (
                  <MissingAbilityCard
                    label={ultimateLabel}
                    abilityKey={unit.ultimate}
                    colorClass="border-dangerBorder bg-dangerTint"
                    badgeClass="bg-dangerBorder text-dangerDark"
                  />
                ) : (
                  <NoAbilityCard
                    label={ultimateLabel}
                    body={t("pvp.noUltimate")}
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </BattleFullScreenSheet>
  );
}

function StatCard({
  label,
  value,
  base,
  bgClass,
  textClass,
}: {
  label: string;
  value: number;
  base?: number;
  bgClass: string;
  textClass: string;
}) {
  const delta = base != null ? value - base : 0;

  return (
    <View className={`flex-1 rounded-2xl p-3 ${bgClass}`}>
      <Text className={`font-nunito-extrabold text-base ${textClass}`}>
        {label}
      </Text>
      <Text className={`mt-2 font-nunito-extrabold text-lg ${textClass}`}>
        {value}
      </Text>
      <Text className={`font-nunito text-xs ${textClass}`}>
        {delta !== 0 ? `${delta > 0 ? `+${delta}` : delta} vs base` : "Current"}
      </Text>
    </View>
  );
}

function AbilityCard({
  label,
  ability,
  colorClass,
  badgeClass,
  cooldownRemaining = 0,
  used = false,
}: {
  label: string;
  ability: {
    key: string;
    name: string;
    description: string;
    cost: number;
    cooldown?: number | null;
    oncePerMatch: boolean;
  };
  colorClass: string;
  badgeClass: string;
  cooldownRemaining?: number;
  used?: boolean;
}) {
  const { t } = useTranslation();
  const showAvailability = cooldownRemaining > 0 || used;

  return (
    <View className={`rounded-2xl border p-3 ${colorClass}`}>
      <View className="mb-2 flex-row items-center gap-2">
        <View className={`rounded-full px-2 py-1 ${badgeClass}`}>
          <Text className="font-nunito-bold text-[10px] uppercase">
            {label}
          </Text>
        </View>
        <Text className="flex-1 font-nunito-bold text-sm text-fg">
          {ability.name}
        </Text>
        <Text className="font-nunito-semibold text-xs text-fgMuted">
          {label === localizeAbilityType("PASSIVE", t)
            ? localizeAbilityType("PASSIVE", t)
            : `${ability.cost} EN${ability.cooldown ? ` · CD ${ability.cooldown}` : ""}`}
        </Text>
      </View>
      <Text className="font-nunito text-sm leading-5 text-fgMuted">
        {ability.description}
      </Text>
      {showAvailability ? (
        <View className="mt-2 flex-row flex-wrap gap-2">
          {cooldownRemaining > 0 ? (
            <View className="rounded-full bg-white/55 px-2 py-1">
              <Text className="font-nunito-semibold text-xs text-fgMuted">
                {t("pvp.action.cooldown", { count: cooldownRemaining })}
              </Text>
            </View>
          ) : null}
          {used ? (
            <View className="rounded-full bg-white/55 px-2 py-1">
              <Text className="font-nunito-semibold text-xs text-fgMuted">
                {t("pvp.action.usedAlready")}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {ability.oncePerMatch ? (
        <Text className="mt-2 font-nunito-semibold text-xs text-primaryDark">
          {t("pvp.oncePerMatch")}
        </Text>
      ) : null}
    </View>
  );
}

function MissingAbilityCard({
  label,
  abilityKey,
  colorClass,
  badgeClass,
}: {
  label: string;
  abilityKey: string;
  colorClass: string;
  badgeClass: string;
}) {
  const { t } = useTranslation();

  return (
    <View className={`rounded-2xl border p-3 ${colorClass}`}>
      <View className="mb-2 flex-row items-center gap-2">
        <View className={`rounded-full px-2 py-1 ${badgeClass}`}>
          <Text className="font-nunito-bold text-[10px] uppercase">
            {label}
          </Text>
        </View>
        <Text className="flex-1 font-nunito-bold text-sm text-fg">
          {abilityKey}
        </Text>
      </View>
      <Text className="font-nunito text-sm leading-5 text-fgMuted">
        {t("pvp.missingAbility", { type: label })}
      </Text>
    </View>
  );
}

function NoPassiveCard() {
  const { t } = useTranslation();

  return (
    <View className="rounded-2xl border border-primaryBorder/20 bg-surfaceMuted p-3">
      <View className="mb-2 flex-row items-center gap-2">
        <View className="rounded-full bg-primaryBorder/30 px-2 py-1">
          <Text className="font-nunito-bold text-[10px] uppercase text-fgMuted">
            {localizeAbilityType("PASSIVE", t)}
          </Text>
        </View>
      </View>
      <Text className="font-nunito text-sm leading-5 text-fgMuted">
        {t("pvp.noPassive")}
      </Text>
    </View>
  );
}

function NoAbilityCard({ label, body }: { label: string; body: string }) {
  return (
    <View className="rounded-2xl border border-primaryBorder/20 bg-surfaceMuted p-3">
      <View className="mb-2 flex-row items-center gap-2">
        <View className="rounded-full bg-primaryBorder/30 px-2 py-1">
          <Text className="font-nunito-bold text-[10px] uppercase text-fgMuted">
            {label}
          </Text>
        </View>
      </View>
      <Text className="font-nunito text-sm leading-5 text-fgMuted">{body}</Text>
    </View>
  );
}
