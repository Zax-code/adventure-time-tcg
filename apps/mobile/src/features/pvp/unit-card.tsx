import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { getTypeMultiplier } from "@adventure-time/game-engine";

import { XCircleIcon } from "../../components/icons";
import { API_BASE_URL } from "../../lib/api";
import { FloatingNumber } from "./floating-number";
import { StatusIcon } from "./status-icon";
import type { FloatingEvent, PvpUnitState } from "./types";

interface UnitCardProps {
  unit: PvpUnitState;
  isSelected?: boolean;
  isValidTarget?: boolean;
  attackerType?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  floatingEvents?: FloatingEvent[];
}

export function UnitCard({
  unit,
  isSelected,
  isValidTarget,
  attackerType,
  onPress,
  onLongPress,
  floatingEvents = [],
}: UnitCardProps) {
  const isDead = unit.hp <= 0;
  const hasSummoningSickness = unit.statuses.some((s) => s.name === "SummoningSickness");
  const hpPct = Math.max(0, unit.hp / unit.maxHp);
  const shield = unit.statuses.find((s) => s.name === "Shield");
  const shieldPct = shield?.magnitude ? Math.min(1, shield.magnitude / unit.maxHp) : 0;

  const hpColor = hpPct > 0.5 ? "#10B981" : hpPct > 0.25 ? "#FACC15" : "#EF4444";

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const shownSeqs = useRef<Set<number>>(new Set());
  const [visibleFloats, setVisibleFloats] = useState<FloatingEvent[]>([]);

  // Pulsing border for valid targets
  useEffect(() => {
    if (isValidTarget) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoop.current?.stop();
  }, [isValidTarget]);

  // Spawn new floating numbers
  useEffect(() => {
    const newOnes = floatingEvents.filter((e) => !shownSeqs.current.has(e.seq));
    if (newOnes.length > 0) {
      newOnes.forEach((e) => shownSeqs.current.add(e.seq));
      setVisibleFloats((prev) => [...prev, ...newOnes]);
    }
  }, [floatingEvents]);

  const dismissFloat = (seq: number) => {
    setVisibleFloats((prev) => prev.filter((e) => e.seq !== seq));
  };

  // Type effectiveness
  let typeEffLabel: string | null = null;
  let borderColor = "#22D3EE";
  let typeEffBg = "rgba(0,0,0,0.7)";
  if (isValidTarget && attackerType) {
    const mult = getTypeMultiplier(attackerType as any, unit.type as any);
    if (mult >= 1.5) {
      typeEffLabel = "Strong";
      borderColor = "#10B981";
      typeEffBg = "#10B981";
    } else if (mult < 1.0) {
      typeEffLabel = "Weak";
      borderColor = "#EF4444";
      typeEffBg = "#EF4444";
    } else {
      typeEffLabel = "Neutral";
      borderColor = "#9CA3AF";
      typeEffBg = "#9CA3AF";
    }
  }

  const imageUrl = unit.imageUrl
    ? unit.imageUrl.startsWith("http")
      ? unit.imageUrl
      : `${API_BASE_URL}${unit.imageUrl}`
    : null;

  // Stat deltas
  const atkDelta = unit.baseAttack != null ? unit.attack - unit.baseAttack : 0;
  const defDelta = unit.baseDefense != null ? unit.defense - unit.baseDefense : 0;
  const spdDelta = unit.baseSpeed != null ? unit.speed - unit.baseSpeed : 0;

  const formatDelta = (d: number) =>
    d === 0 ? null : d > 0 ? `+${d}` : `${d}`;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      className="flex-1"
      style={{ aspectRatio: 5 / 3 }}
    >
      {/* Card inner */}
      <View
        className="flex-1 rounded-xl overflow-hidden bg-slate-900 shadow-lg"
        style={isSelected ? { borderWidth: 2, borderColor: "#22D3EE" } : undefined}
      >
        {/* Card art */}
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="absolute inset-0"
            contentFit="cover"
          />
        ) : (
          <View className="absolute inset-0 bg-gray-700 items-center justify-center">
            <Text className="text-gray-400 text-2xl font-nunito-bold">{unit.name.charAt(0)}</Text>
          </View>
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.85)"]}
          className="absolute inset-0"
          start={{ x: 0, y: 0.3 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Dead overlay */}
        {isDead && (
          <View className="absolute inset-0 items-center justify-center bg-black/60">
            <XCircleIcon size={32} color="#fff" />
          </View>
        )}

        {/* Summoning sickness overlay */}
        {hasSummoningSickness && !isDead && (
          <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: "rgba(129,140,248,0.3)" }}>
            <Text className="text-white text-lg font-nunito-bold">Zzz</Text>
          </View>
        )}

        {/* Top-left: names */}
        <View className="absolute top-1 left-1.5" style={{ width: "40%" }}>
          <Text className="text-[10px] italic text-gray-200" numberOfLines={1}>{unit.name}</Text>
          <Text className="text-[11px] font-bold text-white font-nunito-bold" numberOfLines={1}>{unit.character}</Text>
        </View>

        {/* Top-right: stats */}
        <View className="absolute top-1 right-1 gap-0.5" style={{ width: "40%" }}>
          <StatBadge label="ATK" value={unit.attack} delta={formatDelta(atkDelta)} />
          <StatBadge label="DEF" value={unit.defense} delta={formatDelta(defDelta)} />
          <StatBadge label="SPD" value={unit.speed} delta={formatDelta(spdDelta)} />
        </View>

        {/* Bottom-left: type + statuses */}
        <View className="absolute flex-row items-center gap-1" style={{ bottom: 14, left: 6 }}>
          <View style={{ backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, paddingHorizontal: 4, paddingVertical: 1 }}>
            <Text style={{ color: "#fff", fontSize: 7, fontFamily: "Nunito_700Bold" }}>{unit.type.substring(0, 3).toUpperCase()}</Text>
          </View>
          <View className="flex-row">
            {unit.statuses.slice(0, 4).map((s) => (
              <StatusIcon key={`${s.name}-${s.appliedAt}`} name={s.name} duration={s.duration} magnitude={s.magnitude} />
            ))}
          </View>
        </View>

        {/* HP bar */}
        <View className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: 10, backgroundColor: "rgba(17,24,39,0.9)" }}>
          <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${hpPct * 100}%`, backgroundColor: hpColor }} />
          {shieldPct > 0 && (
            <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${shieldPct * 100}%`, backgroundColor: "#22D3EE", opacity: 0.7 }} />
          )}
          {/* HP text overlay */}
          <View className="absolute inset-0 items-center justify-center">
            <Text style={{ fontSize: 7, fontFamily: "Nunito_700Bold", color: "#fff" }}>{unit.hp}/{unit.maxHp}</Text>
          </View>
        </View>

        {/* Valid target border pulse */}
        {isValidTarget && (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
              { opacity: pulseAnim, borderWidth: 2, borderColor, borderRadius: 12 },
            ]}
          />
        )}

        {/* Type effectiveness pill */}
        {typeEffLabel && (
          <View
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              zIndex: 30,
              alignItems: "center",
            }}
          >
            <View style={{ backgroundColor: typeEffBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontFamily: "Nunito_700Bold", color: "#fff" }}>{typeEffLabel}</Text>
            </View>
          </View>
        )}

        {/* Floating numbers */}
        {visibleFloats.map((e) => (
          <FloatingNumber
            key={e.seq}
            amount={e.amount}
            type={e.type}
            onDone={() => dismissFloat(e.seq)}
          />
        ))}
      </View>
    </Pressable>
  );
}

function StatBadge({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: string | null;
}) {
  return (
    <View className="flex-row items-center rounded gap-1" style={{ backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 3, paddingVertical: 1 }}>
      <Text style={{ color: "#9CA3AF", fontSize: 7 }}>{label}</Text>
      <Text style={{ color: "#fff", fontSize: 8, fontFamily: "Nunito_700Bold" }}>{value}</Text>
      {delta && (
        <Text style={{ fontSize: 7, fontFamily: "Nunito_700Bold", color: delta.startsWith("+") ? "#2DD4BF" : "#FB7185" }}>
          {delta}
        </Text>
      )}
    </View>
  );
}
