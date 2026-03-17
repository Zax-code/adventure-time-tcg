import { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { ADMIN_COLORS, ADMIN_TYPE_COLORS } from "./admin-theme";

export function AdminBackground({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={[ADMIN_COLORS.pageTop, ADMIN_COLORS.pageBottom]} style={StyleSheet.absoluteFill}>
      <View style={styles.sparkleA} />
      <View style={styles.sparkleB} />
      <View style={styles.sparkleC} />
      {children}
    </LinearGradient>
  );
}

export function AdminPanel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function AdminSectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function AdminPageScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function AdminSearchInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name="search" size={16} color="#9CA3AF" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.searchInput}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")}> 
          <Ionicons name="close" size={18} color="#9CA3AF" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function AdminButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "warning";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}) {
  const palette = buttonPalette[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, opacity: disabled ? 0.55 : pressed ? 0.88 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={palette.text} /> : null}
      <Text style={[styles.buttonText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

export function AdminChip({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "info" | "accent" | "danger" | "warning" }) {
  const palette = chipPalette[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.chipText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

export function AbilityTypeChip({ type }: { type: "PASSIVE" | "SKILL" | "ULTIMATE" }) {
  const palette = ADMIN_TYPE_COLORS[type];
  return (
    <View style={[styles.chip, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.chipText, { color: palette.text }]}>{type}</Text>
    </View>
  );
}

export function AdminField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.fieldInput, multiline ? styles.fieldInputMultiline : null]}
      />
    </View>
  );
}

export function AdminModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <LinearGradient colors={[ADMIN_COLORS.shellPink, ADMIN_COLORS.shellPinkDark]} style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </LinearGradient>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function AdminEmptyState({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={28} color={ADMIN_COLORS.shellPinkDark} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const buttonPalette = {
  primary: { bg: ADMIN_COLORS.shellPinkDark, text: "#FFFFFF" },
  secondary: { bg: ADMIN_COLORS.warning, text: ADMIN_COLORS.warningDark },
  danger: { bg: ADMIN_COLORS.dangerDark, text: "#FFFFFF" },
  ghost: { bg: "rgba(255,255,255,0.82)", text: ADMIN_COLORS.shellPinkDeep },
  warning: { bg: ADMIN_COLORS.shellYellowDark, text: ADMIN_COLORS.warningDark },
};

const chipPalette = {
  default: { bg: "rgba(255,255,255,0.8)", border: ADMIN_COLORS.panelBorder, text: ADMIN_COLORS.shellText },
  success: { bg: ADMIN_COLORS.mint, border: "#99F6E4", text: ADMIN_COLORS.mintDark },
  info: { bg: ADMIN_COLORS.info, border: "#C7D2FE", text: ADMIN_COLORS.infoDark },
  accent: { bg: ADMIN_COLORS.accent, border: "#E9D5FF", text: ADMIN_COLORS.accentDark },
  danger: { bg: ADMIN_COLORS.danger, border: "#FECDD3", text: ADMIN_COLORS.dangerDark },
  warning: { bg: ADMIN_COLORS.warning, border: "#FDE68A", text: ADMIN_COLORS.warningDark },
};

const styles = StyleSheet.create({
  sparkleA: {
    position: "absolute",
    top: 80,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  sparkleB: {
    position: "absolute",
    top: 180,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(253,224,71,0.18)",
  },
  sparkleC: {
    position: "absolute",
    bottom: 140,
    left: 60,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(244,114,182,0.12)",
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 128,
    gap: 16,
  },
  panel: {
    backgroundColor: ADMIN_COLORS.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.panelBorder,
    padding: 16,
    shadowColor: ADMIN_COLORS.panelShadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 22,
    color: ADMIN_COLORS.shellPinkDeep,
  },
  sectionSubtitle: {
    marginTop: 3,
    fontFamily: "Nunito_600SemiBold",
    fontSize: 12,
    color: ADMIN_COLORS.muted,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.panelBorder,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito_600SemiBold",
    color: ADMIN_COLORS.text,
    fontSize: 14,
  },
  button: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 13,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 11,
  },
  fieldLabel: {
    fontFamily: "Nunito_700Bold",
    fontSize: 12,
    color: ADMIN_COLORS.shellText,
  },
  fieldInput: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FBCFE8",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    color: ADMIN_COLORS.text,
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
  },
  fieldInputMultiline: {
    minHeight: 100,
    paddingTop: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.overlay,
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    maxHeight: "90%",
    backgroundColor: ADMIN_COLORS.panelStrong,
    borderRadius: 28,
    overflow: "hidden",
  },
  modalHeader: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 18,
  },
  modalClose: {
    position: "absolute",
    right: 14,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  modalContent: {
    padding: 16,
    gap: 14,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  emptyTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 16,
    color: ADMIN_COLORS.shellPinkDeep,
  },
  emptyBody: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    color: ADMIN_COLORS.muted,
    textAlign: "center",
  },
});
