import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { API_BASE_URL } from "../../lib/api";
import { CARD_TYPE_COLORS } from "../../components/theme";
import { RARITY_COLORS } from "../../components/theme";
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
  abilityDefinitions?: Record<string, { key: string; name: string; description: string; type: string; cost: number; cooldown?: number; oncePerMatch: boolean }>;
  onClose: () => void;
}

export function CardInfoModal({ visible, unit, abilityDefinitions, onClose }: CardInfoModalProps) {
  if (!unit) return null;

  const typeColors = CARD_TYPE_COLORS[unit.type] ?? CARD_TYPE_COLORS["Hero"];
  const rarityColors = RARITY_COLORS[unit.rarity] ?? RARITY_COLORS["Common"];

  const imageUrl = unit.imageUrl
    ? unit.imageUrl.startsWith("http")
      ? unit.imageUrl
      : `${API_BASE_URL}${unit.imageUrl}`
    : null;

  const skillDef = abilityDefinitions?.[unit.skill];
  const ultimateDef = abilityDefinitions?.[unit.ultimate];
  const passiveDefs = unit.passives.map((k) => abilityDefinitions?.[k]).filter(Boolean);

  const hpPct = Math.max(0, unit.hp / unit.maxHp);
  const hpColor = hpPct > 0.5 ? "#10B981" : hpPct > 0.25 ? "#FACC15" : "#EF4444";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Card image */}
          <View style={styles.imageWrapper}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
            ) : (
              <View style={[styles.image, { backgroundColor: "#374151", alignItems: "center", justifyContent: "center" }]}>
                <Text style={{ color: "#9CA3AF", fontSize: 40 }}>{unit.name.charAt(0)}</Text>
              </View>
            )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.8)"]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0.4 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.imageOverlay}>
              <Text style={styles.cardName}>{unit.name}</Text>
              <Text style={styles.charName}>{unit.character}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.typeBadge, { backgroundColor: typeColors.frame }]}>
                  <Text style={styles.badgeText}>{unit.type}</Text>
                </View>
                <View style={[styles.rarityBadge, { backgroundColor: rarityColors.from }]}>
                  <Text style={styles.badgeText}>{unit.rarity}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* HP bar */}
          <View style={styles.hpSection}>
            <Text style={styles.hpLabel}>HP: {unit.hp} / {unit.maxHp}</Text>
            <View style={styles.hpBar}>
              <View style={[styles.hpFill, { width: `${hpPct * 100}%`, backgroundColor: hpColor }]} />
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsGrid}>
            <StatCard label="ATK" value={unit.attack} base={unit.baseAttack} color="#EF4444" />
            <StatCard label="DEF" value={unit.defense} base={unit.baseDefense} color="#3B82F6" />
            <StatCard label="SPD" value={unit.speed} base={unit.baseSpeed} color="#10B981" />
          </View>

          {/* Active statuses */}
          {unit.statuses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Effects</Text>
              {unit.statuses.map((s, i) => (
                <View key={i} style={styles.statusRow}>
                  <Text style={styles.statusName}>{s.name}</Text>
                  <Text style={styles.statusDesc}>{STATUS_DESCRIPTIONS[s.name] ?? ""}</Text>
                  <Text style={styles.statusDuration}>
                    {s.duration === -1 ? "∞" : `${s.duration}T`}
                    {s.magnitude != null ? ` (${s.magnitude})` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Abilities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Abilities</Text>
            {passiveDefs.map((def) => def && (
              <AbilityCard key={def.key} def={def} color="#3B82F6" typeLabel="PASSIVE" />
            ))}
            {skillDef && <AbilityCard def={skillDef} color="#10B981" typeLabel="SKILL" />}
            {ultimateDef && <AbilityCard def={ultimateDef} color="#EF4444" typeLabel="ULTIMATE" />}
            {!skillDef && !ultimateDef && passiveDefs.length === 0 && (
              <Text style={styles.noAbilities}>No abilities found</Text>
            )}
          </View>
        </ScrollView>

        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function StatCard({ label, value, base, color }: { label: string; value: number; base?: number; color: string }) {
  const delta = base != null ? value - base : 0;
  return (
    <View style={[styles.statCard, { borderColor: color }]}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {delta !== 0 && (
        <Text style={[styles.statDelta, { color: delta > 0 ? "#10B981" : "#EF4444" }]}>
          {delta > 0 ? `+${delta}` : delta}
        </Text>
      )}
    </View>
  );
}

function AbilityCard({ def, color, typeLabel }: { def: { name: string; description: string; cost: number; cooldown?: number; oncePerMatch: boolean }; color: string; typeLabel: string }) {
  return (
    <View style={[styles.abilityCard, { borderColor: color }]}>
      <View style={styles.abilityHeader}>
        <View style={[styles.abilityTypeBadge, { backgroundColor: color }]}>
          <Text style={styles.abilityTypeText}>{typeLabel}</Text>
        </View>
        <Text style={styles.abilityName}>{def.name}</Text>
        <Text style={styles.abilityCost}>⚡{def.cost}</Text>
      </View>
      <Text style={styles.abilityDesc}>{def.description}</Text>
      {def.cooldown != null && def.cooldown > 0 && (
        <Text style={styles.abilityCooldown}>Cooldown: {def.cooldown}</Text>
      )}
      {def.oncePerMatch && (
        <Text style={styles.abilityOnce}>Once per match</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  container: {
    position: "absolute",
    top: 40,
    left: 16,
    right: 16,
    bottom: 40,
    backgroundColor: "#111827",
    borderRadius: 16,
    overflow: "hidden",
  },
  imageWrapper: {
    height: 200,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
  },
  cardName: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
  },
  charName: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
  },
  typeBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rarityBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
  },
  hpSection: {
    padding: 12,
  },
  hpLabel: {
    color: "#D1D5DB",
    fontSize: 13,
    marginBottom: 4,
    fontFamily: "Nunito_700Bold",
  },
  hpBar: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    overflow: "hidden",
  },
  hpFill: {
    height: "100%",
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
  },
  statValue: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
  },
  statDelta: {
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
  },
  section: {
    padding: 12,
  },
  sectionTitle: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusRow: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusName: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
    minWidth: 70,
  },
  statusDesc: {
    color: "#9CA3AF",
    fontSize: 11,
    flex: 1,
  },
  statusDuration: {
    color: "#FACC15",
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
  },
  noAbilities: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 8,
  },
  abilityCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#1F2937",
  },
  abilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  abilityTypeBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  abilityTypeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Nunito_700Bold",
  },
  abilityName: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    flex: 1,
  },
  abilityCost: {
    color: "#FACC15",
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
  },
  abilityDesc: {
    color: "#D1D5DB",
    fontSize: 12,
    lineHeight: 18,
  },
  abilityCooldown: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 4,
  },
  abilityOnce: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: "#374151",
    margin: 12,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
  },
});
