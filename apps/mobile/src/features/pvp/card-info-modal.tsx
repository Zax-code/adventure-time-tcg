import { Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { BattleFullScreenSheet } from "./battle-full-screen-sheet";
import { resolveBattleImageUrl } from "./image-url";
import type { PvpUnitState } from "./types";

const STATUS_DESCRIPTIONS: Record<string, string> = {
  Burn: "Taking fire damage each turn",
  Freeze: "Skipping next action",
  Shield: "Absorbing incoming damage",
  GuardUp: "Defense increased",
  Vulnerable: "Taking increased damage",
  Weakened: "Dealing reduced damage",
  Haste: "Acting earlier in turn order",
  Taunt: "Forcing enemies to target this unit",
  Regeneration: "Healing each turn",
  Regen: "Healing each turn",
  Silence: "Cannot use abilities",
  SummoningSickness: "Cannot act this turn",
  Cover: "Redirecting damage from an ally",
  Stunned: "Next action costs extra energy",
  Poison: "Taking poison damage each turn",
  Thorns: "Reflecting melee damage",
  Stealth: "Cannot be targeted",
  Empower: "Next attack deals bonus damage",
  Counter: "Next attack will be countered",
  Mark: "Taking increased damage from all sources",
  Barrier: "Blocking next debuff",
  Doom: "Will be eliminated after countdown",
};

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
      cooldown?: number;
      oncePerMatch: boolean;
    }
  >;
  onClose: () => void;
}

export function CardInfoModal({ visible, unit, abilityDefinitions, onClose }: CardInfoModalProps) {
  if (!unit) {
    return null;
  }

  const imageUrl = resolveBattleImageUrl(unit.imageUrl);

  const hpPct = Math.max(0, unit.hp / Math.max(1, unit.maxHp));
  const hpColor = hpPct > 0.5 ? "#16A34A" : hpPct > 0.25 ? "#F59E0B" : "#DC2626";
  const skillDef = abilityDefinitions?.[unit.skill];
  const ultimateDef = abilityDefinitions?.[unit.ultimate];
  const passiveDefs = unit.passives.map((key) => abilityDefinitions?.[key]).filter(Boolean);

  return (
    <BattleFullScreenSheet visible={visible} title="Card Details" onClose={onClose}>
      <View className="pb-4">
        <View className="mx-4 overflow-hidden rounded-[28px] bg-white shadow-sm">
          <View className="flex-row">
            <View className="w-1/2 bg-slate-900 px-5 py-5">
              <View className="overflow-hidden rounded-[24px] bg-slate-800" style={{ width: "100%", aspectRatio: 320 / 192 }}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-slate-700">
                    <Text className="font-nunito-extrabold text-7xl text-white">{unit.name.charAt(0)}</Text>
                  </View>
                )}

                <LinearGradient
                  colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.85)"]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />

                <View className="absolute left-4 top-4 rounded-xl bg-black/55 px-3 py-1.5">
                  <Text className="font-nunito-bold text-xs text-white">{unit.type}</Text>
                </View>
              </View>

              <View className="mt-4 gap-1">
                <Text className="font-nunito text-base italic text-fgMuted">{unit.name}</Text>
                <Text className="font-nunito-extrabold text-3xl text-fg">{unit.character || unit.name}</Text>
                <Text className="font-nunito-bold text-sm text-fgMuted">{unit.rarity}</Text>
              </View>

              {unit.statuses.length > 0 ? (
                <View className="mt-5 gap-2">
                  <Text className="font-nunito-bold text-sm text-white/90">Active Effects</Text>
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
                            <Text className={`font-nunito-bold text-sm ${isDebuff ? "text-dangerDark" : "text-infoDark"}`}>
                              {status.name}
                              {status.magnitude != null ? ` (${status.magnitude})` : ""}
                            </Text>
                            <Text className="mt-1 font-nunito text-xs leading-4 text-fgMuted">
                              {STATUS_DESCRIPTIONS[status.name] ?? ""}
                            </Text>
                          </View>
                          <View className={`rounded-full px-2 py-1 ${isDebuff ? "bg-dangerBorder" : "bg-infoBorder"}`}>
                            <Text className={`font-nunito-bold text-[10px] ${isDebuff ? "text-dangerDark" : "text-infoDark"}`}>
                              {status.duration === -1 ? "UNTIL USED" : `${status.duration}T`}
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
                  <Text className="font-nunito-semibold text-sm text-primaryDark">HP</Text>
                  <Text className="font-nunito-bold text-sm text-fg">
                    {unit.hp} / {unit.maxHp}
                  </Text>
                </View>
                <View className="h-3 overflow-hidden rounded-full bg-surfaceMuted">
                  <View style={{ width: `${hpPct * 100}%`, height: "100%", backgroundColor: hpColor }} />
                </View>
              </View>

              <View className="flex-row gap-3">
                <StatCard label="ATK" value={unit.attack} base={unit.baseAttack} bgClass="bg-dangerTint" textClass="text-dangerDark" />
                <StatCard label="DEF" value={unit.defense} base={unit.baseDefense} bgClass="bg-infoTint" textClass="text-infoDark" />
                <StatCard label="SPD" value={unit.speed} base={unit.baseSpeed} bgClass="bg-successTint" textClass="text-successDark" />
              </View>

              <View className="gap-2">
                <Text className="font-nunito-bold text-sm text-primaryDark">Abilities</Text>
                {passiveDefs.map((ability) =>
                  ability ? <AbilityCard key={ability.key} label="PASSIVE" ability={ability} colorClass="border-infoBorder bg-infoTint" badgeClass="bg-infoBorder text-infoDark" /> : null,
                )}
                {skillDef ? (
                  <AbilityCard
                    label="SKILL"
                    ability={skillDef}
                    colorClass="border-successBorder bg-successTint"
                    badgeClass="bg-successBorder text-successDark"
                  />
                ) : null}
                {ultimateDef ? (
                  <AbilityCard
                    label="ULTIMATE"
                    ability={ultimateDef}
                    colorClass="border-dangerBorder bg-dangerTint"
                    badgeClass="bg-dangerBorder text-dangerDark"
                  />
                ) : null}
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
      <Text className={`font-nunito-extrabold text-base ${textClass}`}>{label}</Text>
      <Text className={`mt-2 font-nunito-extrabold text-lg ${textClass}`}>{value}</Text>
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
}: {
  label: string;
  ability: {
    key: string;
    name: string;
    description: string;
    cost: number;
    cooldown?: number;
    oncePerMatch: boolean;
  };
  colorClass: string;
  badgeClass: string;
}) {
  return (
    <View className={`rounded-2xl border p-3 ${colorClass}`}>
      <View className="mb-2 flex-row items-center gap-2">
        <View className={`rounded-full px-2 py-1 ${badgeClass}`}>
          <Text className="font-nunito-bold text-[10px] uppercase">{label}</Text>
        </View>
        <Text className="flex-1 font-nunito-bold text-sm text-fg">{ability.name}</Text>
        <Text className="font-nunito-semibold text-xs text-fgMuted">
          {label === "PASSIVE" ? "Passive" : `${ability.cost} EN${ability.cooldown ? ` · CD ${ability.cooldown}` : ""}`}
        </Text>
      </View>
      <Text className="font-nunito text-sm leading-5 text-fgMuted">{ability.description}</Text>
      {ability.oncePerMatch ? (
        <Text className="mt-2 font-nunito-semibold text-xs text-primaryDark">Once per match</Text>
      ) : null}
    </View>
  );
}
