import { Text, View } from "react-native";
import Pause from "lucide-react-native/icons/pause";

import { Button } from "../button";
import { ProgressBar } from "../progress-bar";

export interface GameHudStat {
  value: string | number;
  label: string;
  testID?: string;
}

export interface GameHudProps {
  left: GameHudStat;
  right?: GameHudStat;
  pause?: { label: string; onPress: () => void; testID?: string };
  // 0 to 1; omit to hide the bar.
  progress?: number;
  className?: string;
  testID?: string;
}

// Card with a primary stat on the left, a neutral stat on the right, an
// optional ghost-sm Pause and a ProgressBar.
export function GameHud({ left, right, pause, progress, className, testID }: GameHudProps) {
  return (
    <View
      testID={testID}
      className={`gap-[10px] rounded-ds-lg border border-primaryBorder bg-surface px-ds-4 py-ds-3 ${
        className ?? ""
      }`}
    >
      <View className="flex-row items-center gap-ds-3">
        <View className="flex-1">
          <Text
            testID={left.testID}
            className="font-nunito-extrabold text-[24px] leading-[29px] text-primaryText"
          >
            {left.value}
          </Text>
          <Text className="font-nunito-bold text-ds-caption text-fgMuted">{left.label}</Text>
        </View>
        {right ? (
          <View className="flex-1 items-end">
            <Text
              testID={right.testID}
              className="font-nunito-extrabold text-[24px] leading-[29px] text-fg"
            >
              {right.value}
            </Text>
            <Text className="font-nunito-bold text-ds-caption text-fgMuted">{right.label}</Text>
          </View>
        ) : null}
        {pause ? (
          <Button tone="ghost" size="sm" icon={Pause} onPress={pause.onPress} testID={pause.testID}>
            {pause.label}
          </Button>
        ) : null}
      </View>
      {progress != null ? <ProgressBar value={progress} complete={false} /> : null}
    </View>
  );
}
