import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { getTypeMultiplier } from "@adventure-time/game-engine";

import { XCircleIcon } from "../../components/icons";
import { useTranslation } from "../../i18n";
import { FloatingNumber } from "./floating-number";
import { resolveBattleImageUrl } from "./image-url";
import { StatusIcon } from "./status-icon";
import type { FloatingEvent, PvpUnitState } from "./types";

interface UnitCardProps {
  unit: PvpUnitState;
  testID?: string;
  isSelected?: boolean;
  isValidTarget?: boolean;
  attackerType?: string;
  canSelectAsActor?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  floatingEvents?: FloatingEvent[];
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  Hero: "#2563EB",
  Tech: "#0F766E",
  Royalty: "#7C3AED",
  Candy: "#DB2777",
  Undead: "#475569",
  Ice: "#0EA5E9",
  Fire: "#DC2626",
  Magic: "#8B5CF6",
  Demon: "#7F1D1D",
  Cosmic: "#4338CA",
};

export function UnitCard({
  unit,
  testID,
  isSelected,
  isValidTarget,
  attackerType,
  canSelectAsActor,
  onPress,
  onLongPress,
  floatingEvents = [],
}: UnitCardProps) {
  const { t } = useTranslation();
  const isDead = unit.hp <= 0;
  const hasSummoningSickness = unit.statuses.some((status) => status.name === "SummoningSickness");
  const shieldAmount = unit.statuses
    .filter((status) => status.name === "Shield")
    .reduce((sum, status) => sum + Math.max(0, status.magnitude ?? 0), 0);
  const hpPct = Math.max(0, (unit.hp / Math.max(1, unit.maxHp)) * 100);
  const shieldPctRaw = Math.max(0, (shieldAmount / Math.max(1, unit.maxHp)) * 100);
  const shieldBarPct = hpPct >= 100 ? Math.min(shieldPctRaw, 100) : Math.min(shieldPctRaw, Math.max(0, 100 - hpPct));
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const shownSeqs = useRef<Set<number>>(new Set());
  const [visibleFloats, setVisibleFloats] = useState<FloatingEvent[]>([]);

  useEffect(() => {
    if (isValidTarget) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.35, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }

    return () => pulseLoop.current?.stop();
  }, [isValidTarget, pulseAnim]);

  useEffect(() => {
    const newOnes = floatingEvents.filter((event) => !shownSeqs.current.has(event.seq));
    if (newOnes.length > 0) {
      newOnes.forEach((event) => shownSeqs.current.add(event.seq));
      setVisibleFloats((current) => [...current, ...newOnes]);
    }
  }, [floatingEvents]);

  const dismissFloat = (seq: number) => {
    setVisibleFloats((current) => current.filter((event) => event.seq !== seq));
  };

  const typeEffectiveness = useMemo(() => {
    if (!isValidTarget || !attackerType) {
      return null;
    }

    const mult = getTypeMultiplier(attackerType as never, unit.type as never);
    if (mult > 1) {
      return { label: t("pvp.effectiveness.super"), bg: "#16A34A", border: "#22C55E" };
    }
    if (mult < 1) {
      return { label: t("pvp.effectiveness.weak"), bg: "#DC2626", border: "#FB7185" };
    }
    return { label: t("pvp.effectiveness.neutral"), bg: "#64748B", border: "#94A3B8" };
  }, [attackerType, isValidTarget, t, unit.type]);

  const imageUrl = resolveBattleImageUrl(unit.imageUrl);

  const atkDelta = unit.baseAttack != null ? unit.attack - unit.baseAttack : 0;
  const defDelta = unit.baseDefense != null ? unit.defense - unit.baseDefense : 0;
  const spdDelta = unit.baseSpeed != null ? unit.speed - unit.baseSpeed : 0;
  const typeBadgeColor = TYPE_BADGE_COLORS[unit.type] ?? "#475569";

  return (
    <View className="min-w-0">
      {typeEffectiveness ? (
        <View className="absolute left-0 right-0 z-30 items-center" style={{ top: -18 }}>
          <View style={{ backgroundColor: typeEffectiveness.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: "#fff", fontSize: 10, fontFamily: "Nunito_700Bold" }}>{typeEffectiveness.label}</Text>
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessible
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        testID={testID}
        style={({ pressed }) => ({
          aspectRatio: 1.82,
          borderRadius: 12,
          opacity: pressed ? 0.96 : 1,
        })}
      >
        <View className="h-full w-full overflow-hidden rounded-xl bg-slate-900 shadow-lg">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
              contentFit="cover"
            />
          ) : (
            <View className="absolute inset-0 items-center justify-center bg-slate-700">
              <Text className="font-nunito-extrabold text-4xl text-white">{unit.name.charAt(0)}</Text>
            </View>
          )}

          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.22)", "rgba(0,0,0,0.86)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />

          {visibleFloats.map((event) => (
            <FloatingNumber key={event.seq} amount={event.amount} type={event.type} onDone={() => dismissFloat(event.seq)} />
          ))}

          <View className="absolute left-1 top-1" style={{ width: "40%" }}>
            <Text className="font-nunito text-[9px] italic text-gray-200" numberOfLines={1}>
              {unit.name}
            </Text>
              <Text className="font-nunito-bold text-[10px] text-white" numberOfLines={1}>
               {unit.character || t("pvp.unknown")}
              </Text>
          </View>

          <View className="absolute right-1 top-1 gap-0.5" style={{ width: "42%" }}>
            <StatBadge label="ATK" value={unit.attack} delta={atkDelta} />
            <StatBadge label="DEF" value={unit.defense} delta={defDelta} />
            <StatBadge label="SPD" value={unit.speed} delta={spdDelta} />
          </View>

          <View className="absolute flex-row items-center" style={{ left: 4, bottom: 18, gap: 3 }}>
            <View style={{ backgroundColor: typeBadgeColor, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: "#fff", fontSize: 7, fontFamily: "Nunito_700Bold" }}>{unit.type.slice(0, 3).toUpperCase()}</Text>
            </View>
            <View className="flex-row">
              {unit.statuses.slice(0, 4).map((status) => (
                <StatusIcon key={`${status.name}-${status.appliedAt}`} name={status.name} duration={status.duration} magnitude={status.magnitude} />
              ))}
            </View>
          </View>

          {hasSummoningSickness && !isDead ? (
            <View className="absolute inset-0 items-center justify-center bg-sky-500/25">
              <View className="rounded-lg bg-sky-700 px-2 py-1">
                <Text className="font-nunito-bold text-xs text-white">Zzz</Text>
              </View>
            </View>
          ) : null}

          {isDead ? (
            <View className="absolute inset-0 items-center justify-center bg-black/60">
              <View className="rounded-full bg-rose-600 p-1.5">
                <XCircleIcon size={18} color="#fff" />
              </View>
            </View>
          ) : null}

          <View className="absolute bottom-1 left-1 right-1 h-2 overflow-hidden rounded bg-slate-900/90">
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${hpPct}%`,
                backgroundColor: hpPct > 50 ? "#22C55E" : hpPct > 25 ? "#F59E0B" : "#EF4444",
              }}
            />
            {shieldBarPct > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  width: `${shieldBarPct}%`,
                  backgroundColor: "#38BDF8",
                  ...(hpPct >= 100 ? { right: 0 } : { left: `${hpPct}%` }),
                }}
              />
            ) : null}
            <View className="absolute inset-0 items-center justify-center">
              <Text style={{ color: "#fff", fontSize: 7, fontFamily: "Nunito_700Bold" }}>
                {shieldAmount > 0 ? `${unit.hp} + ${shieldAmount} / ${unit.maxHp}` : `${unit.hp}/${unit.maxHp}`}
              </Text>
            </View>
          </View>

          {(isSelected || isValidTarget || canSelectAsActor) ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isSelected ? "#67E8F9" : isValidTarget ? (typeEffectiveness?.border ?? "#67E8F9") : "rgba(103,232,249,0.85)",
                opacity: isSelected ? 1 : isValidTarget ? pulseAnim : 0.75,
              }}
            />
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function StatBadge({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: number;
}) {
  return (
    <View style={{ backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 }}>
      <Text style={{ color: "#fff", fontSize: 7, fontFamily: "Nunito_700Bold" }}>
        {label} {value}
        {delta !== 0 ? ` ${delta > 0 ? `+${delta}` : delta}` : ""}
      </Text>
    </View>
  );
}
