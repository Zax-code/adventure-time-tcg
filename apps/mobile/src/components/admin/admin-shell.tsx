import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { CoinIcon, CardsIcon, HomeIcon } from "../icons";
import { useSessionStore } from "../../stores/session-store";
import { AdminBackground } from "./admin-ui";
import { ADMIN_COLORS } from "./admin-theme";

const NAV_ITEMS = [
  { path: "/admin/cards", label: "Cards", icon: "albums" as const, tint: "#DB2777" },
  { path: "/admin/featured", label: "Featured", icon: "star" as const, tint: "#A16207" },
  { path: "/admin/abilities", label: "Abilities", icon: "flash" as const, tint: "#EA580C" },
  { path: "/admin/users", label: "Users", icon: "people" as const, tint: "#7C3AED" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const coins = useSessionStore((state) => state.user?.coins ?? 0);

  return (
    <View style={styles.root}>
      <AdminBackground>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <LinearGradient
            colors={[ADMIN_COLORS.shellYellow, ADMIN_COLORS.shellYellowDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.coinPill}
          >
            <CoinIcon size={20} />
            <Text style={styles.coinText}>{coins.toLocaleString()}</Text>
          </LinearGradient>

          <Pressable onPress={() => router.replace("/(tabs)" as any)} style={styles.gameButton}>
            <HomeIcon size={18} color="#FFFFFF" />
            <Text style={styles.gameButtonText}>Back to game</Text>
          </Pressable>
        </View>

        <View style={styles.content}>{children}</View>

        <View style={[styles.navBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path || pathname === "/admin" && item.path === "/admin/cards";
            return (
              <Pressable
                key={item.path}
                onPress={() => router.replace(item.path as any)}
                style={styles.navItem}
              >
                <View style={[styles.navIconWrap, active ? { backgroundColor: "rgba(255,255,255,0.46)" } : null]}>
                  {item.path === "/admin/cards" ? (
                    <CardsIcon size={20} color={active ? item.tint : "#9CA3AF"} />
                  ) : (
                    <Ionicons name={item.icon} size={20} color={active ? item.tint : "#9CA3AF"} />
                  )}
                </View>
                <Text style={[styles.navLabel, active ? { color: item.tint } : null]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </AdminBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: "rgba(120,53,15,0.25)",
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  coinText: {
    color: "#894B00",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 14,
  },
  gameButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: ADMIN_COLORS.shellPinkDark,
    shadowColor: "rgba(190,24,93,0.25)",
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  gameButtonText: {
    color: "#FFFFFF",
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
  },
  content: { flex: 1 },
  navBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(244,114,182,0.22)",
    backgroundColor: "rgba(252,231,243,0.94)",
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navIconWrap: {
    width: 34,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    color: "#6B7280",
  },
});
