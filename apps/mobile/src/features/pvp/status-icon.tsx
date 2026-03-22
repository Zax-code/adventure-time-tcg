import { Text, View } from "react-native";

interface StatusIconProps {
  name: string;
  duration: number;
  magnitude?: number | null;
}

const DEBUFFS = new Set([
  "Burn", "Freeze", "Vulnerable", "Weakened", "Silence", "Stunned", "Poison", "Mark", "Doom",
]);

const STATUS_LABELS: Record<string, string> = {
  Burn: "🔥",
  Freeze: "❄",
  Shield: "🛡",
  GuardUp: "↑",
  Vulnerable: "↓",
  Weakened: "W",
  Haste: "⚡",
  Taunt: "T",
  Regeneration: "♻",
  Regen: "♻",
  Silence: "🔇",
  SummoningSickness: "Z",
  Cover: "C",
  Stunned: "S",
  Poison: "☠",
  Thorns: "🌵",
  Stealth: "👁",
  Empower: "⬆",
  Counter: "⟲",
  Mark: "M",
  Barrier: "B",
  Doom: "💀",
};

export function StatusIcon({ name, duration }: StatusIconProps) {
  const isDebuff = DEBUFFS.has(name);
  const label = STATUS_LABELS[name] ?? name.charAt(0);

  return (
    <View
      className={[
        "rounded-full items-center justify-center mr-0.5",
        isDebuff ? "bg-dangerTint" : "bg-infoTint",
      ].join(" ")}
      style={{ width: 14, height: 14 }}
    >
      <Text
        style={{ fontSize: 7, lineHeight: 10 }}
        className={isDebuff ? "text-dangerDark" : "text-infoDark"}
      >
        {label}
      </Text>
      {duration > 0 && duration !== -1 && (
        <View
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface items-center justify-center"
          style={{ width: 7, height: 7 }}
        >
          <Text style={{ fontSize: 5, lineHeight: 7 }} className="text-fg">
            {duration}
          </Text>
        </View>
      )}
    </View>
  );
}
