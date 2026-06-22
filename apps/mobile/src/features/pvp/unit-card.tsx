import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { getTypeMultiplier, type TypeName } from "@adventure-time/game-engine";

import { SparklesIcon, XCircleIcon } from "../../components/icons";
import { useTranslation } from "../../i18n";
import { useThemeStore } from "../../stores/theme-store";
import { THEME_COLORS } from "../../theme/themes";
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

const TARGET_EFFECTIVENESS_COLORS = {
  super: {
    bg: "#16A34A",
    border: "#22C55E",
  },
  weak: {
    bg: "#DC2626",
    border: "#FB7185",
  },
  neutral: {
    bg: "#2563EB",
    border: "#60A5FA",
  },
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
  const themeName = useThemeStore((state) => state.themeName);
  const tc = THEME_COLORS[themeName];
  const isDead = unit.hp <= 0;
  const hasSummoningSickness = unit.statuses.some(
    (status) => status.name === "SummoningSickness",
  );
  const shieldAmount = unit.statuses
    .filter((status) => status.name === "Shield")
    .reduce((sum, status) => sum + Math.max(0, status.magnitude ?? 0), 0);
  const hpPct = Math.max(0, (unit.hp / Math.max(1, unit.maxHp)) * 100);
  const shieldPctRaw = Math.max(
    0,
    (shieldAmount / Math.max(1, unit.maxHp)) * 100,
  );
  const shieldBarPct =
    hpPct >= 100
      ? Math.min(shieldPctRaw, 100)
      : Math.min(shieldPctRaw, Math.max(0, 100 - hpPct));
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const shownSeqs = useRef<Set<number>>(new Set());
  const [visibleFloats, setVisibleFloats] = useState<FloatingEvent[]>([]);

  useEffect(() => {
    if (isValidTarget) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
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
    const newOnes = floatingEvents.filter(
      (event) => !shownSeqs.current.has(event.seq),
    );
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

    const mult = getTypeMultiplier(
      attackerType as TypeName,
      unit.type as TypeName,
    );
    if (mult > 1) {
      return {
        label: t("pvp.effectiveness.super"),
        ...TARGET_EFFECTIVENESS_COLORS.super,
      };
    }
    if (mult < 1) {
      return {
        label: t("pvp.effectiveness.weak"),
        ...TARGET_EFFECTIVENESS_COLORS.weak,
      };
    }
    return {
      label: t("pvp.effectiveness.neutral"),
      ...TARGET_EFFECTIVENESS_COLORS.neutral,
    };
  }, [attackerType, isValidTarget, t, unit.type]);

  const imageUrl = resolveBattleImageUrl(unit.imageUrl);
  const hasPublicPassive = unit.passives.length > 0;

  const atkDelta = unit.baseAttack != null ? unit.attack - unit.baseAttack : 0;
  const defDelta =
    unit.baseDefense != null ? unit.defense - unit.baseDefense : 0;
  const typeBadgeColor = TYPE_BADGE_COLORS[unit.type] ?? "#475569";
  const hpColor = hpPct > 50 ? "#22C55E" : hpPct > 25 ? "#F59E0B" : "#EF4444";
  const haloColor = isSelected
    ? tc.successDark
    : isValidTarget
      ? (typeEffectiveness?.border ?? tc.accentDark)
      : tc.primary;
  const showStateOutline = Boolean(isSelected || isValidTarget);
  const actionGlowColor =
    canSelectAsActor || isSelected ? tc.successDark : haloColor;

  return (
    <View className="h-full w-full min-w-0">
      {typeEffectiveness ? (
        <View
          className="absolute left-0 right-0 z-30 items-center"
          style={{ top: -18 }}
        >
          <View
            style={{
              backgroundColor: typeEffectiveness.bg,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 10,
                fontFamily: "Nunito_700Bold",
              }}
            >
              {typeEffectiveness.label}
            </Text>
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
          width: "100%",
          height: "100%",
          borderRadius: 18,
          opacity: isDead ? 0.72 : pressed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        <View className="h-full w-full">
          <View
            className="min-h-0 flex-1 overflow-hidden rounded-[18px] bg-slate-950"
            style={{
              boxShadow:
                isSelected || isValidTarget
                  ? `0 12px 22px ${actionGlowColor}3f`
                  : canSelectAsActor
                    ? `0 10px 18px ${actionGlowColor}22`
                    : "0 6px 12px rgba(15,23,42,0.16)",
            }}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                }}
                contentFit="cover"
              />
            ) : (
              <View className="absolute inset-0 items-center justify-center bg-primaryTint">
                <Text className="font-nunito-extrabold text-4xl text-primaryText">
                  {unit.name.charAt(0)}
                </Text>
              </View>
            )}

            <LinearGradient
              colors={[
                "rgba(0,0,0,0.05)",
                "rgba(0,0,0,0.18)",
                "rgba(0,0,0,0.9)",
              ]}
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
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0.26)", "rgba(255,255,255,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.78, y: 0.52 }}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                left: 0,
                height: "48%",
              }}
            />

            {visibleFloats.map((event) => (
              <FloatingNumber
                key={event.seq}
                amount={event.amount}
                type={event.type}
                onDone={() => dismissFloat(event.seq)}
              />
            ))}

            <View className="absolute left-2 right-2 top-1.5 flex-row items-start justify-between gap-1">
              <View className="min-w-0 flex-1">
                <View
                  className="self-start rounded-full px-1.5"
                  style={{ backgroundColor: typeBadgeColor }}
                >
                  <Text
                    className="font-nunito-extrabold text-white"
                    numberOfLines={1}
                    style={{ fontSize: 12, lineHeight: 14 }}
                  >
                    {unit.type.toUpperCase()}
                  </Text>
                </View>
                <Text
                  className="font-nunito-extrabold text-white"
                  numberOfLines={1}
                  style={{ fontSize: 12, lineHeight: 14 }}
                >
                  {unit.character || t("pvp.unknown")}
                </Text>
              </View>

              {hasPublicPassive ? (
                <View
                  accessibilityLabel={t("pvp.publicPassive")}
                  className="h-5 w-5 items-center justify-center rounded-full bg-amber-300"
                >
                  <SparklesIcon size={10} color="#78350F" />
                </View>
              ) : null}
            </View>

            <View className="absolute bottom-1.5 left-2 right-2 flex-row items-end justify-between gap-1">
              <View className="flex-row gap-0.5">
                {unit.statuses.slice(0, 2).map((status) => (
                  <StatusIcon
                    key={`${status.name}-${status.appliedAt}`}
                    name={status.name}
                    duration={status.duration}
                    magnitude={status.magnitude}
                  />
                ))}
              </View>
              <View className="flex-row gap-1">
                <StatBadge label="ATK" value={unit.attack} delta={atkDelta} />
                <StatBadge label="DEF" value={unit.defense} delta={defDelta} />
              </View>
            </View>

            {hasSummoningSickness && !isDead ? (
              <View className="absolute inset-0 items-center justify-center bg-sky-500/30">
                <View className="rounded-full bg-sky-700/90 px-3 py-1">
                  <Text className="font-nunito-extrabold text-xs text-white">
                    Zzz
                  </Text>
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

            {isSelected ? (
              <View
                pointerEvents="none"
                className="absolute right-2 top-2 h-3 w-3 rounded-full bg-amber-300"
                style={{ boxShadow: "0 0 12px rgba(250,204,21,0.84)" }}
              />
            ) : null}

            {showStateOutline ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 2,
                  left: 2,
                  right: 2,
                  bottom: 2,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: haloColor,
                  opacity: isSelected ? 0.9 : pulseAnim,
                }}
              />
            ) : null}
          </View>

          <View className="mt-1 h-[14px] items-center justify-center px-3">
            <View className="h-[10px] w-full overflow-hidden rounded-full bg-slate-950/70">
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${hpPct}%`,
                  backgroundColor: hpColor,
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
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 12,
                    lineHeight: 12,
                    fontFamily: "Nunito_700Bold",
                  }}
                >
                  {shieldAmount > 0
                    ? `${unit.hp} + ${shieldAmount} / ${unit.maxHp}`
                    : `${unit.hp}/${unit.maxHp}`}
                </Text>
              </View>
            </View>
          </View>
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
  const boosted = delta > 0;
  const reduced = delta < 0;
  return (
    <View
      className="min-w-[38px] items-center rounded-full px-1"
      style={{
        backgroundColor: boosted
          ? "rgba(34,197,94,0.9)"
          : reduced
            ? "rgba(239,68,68,0.9)"
            : "rgba(15,23,42,0.72)",
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 12,
          lineHeight: 14,
          fontFamily: "Nunito_800ExtraBold",
        }}
      >
        {label} {value}
        {delta !== 0 ? ` ${delta > 0 ? `+${delta}` : delta}` : ""}
      </Text>
    </View>
  );
}
