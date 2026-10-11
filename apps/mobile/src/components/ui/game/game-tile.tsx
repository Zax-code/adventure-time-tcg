import { Text, View } from "react-native";

import { GAME_CELL_CLASS, type GameCellState, glyphCenterStyle } from "./game-state";

export interface GameTileProps {
  letter?: string;
  state?: GameCellState;
  testID?: string;
}

// 56 square, radius 16, 24/800 letter.
export function GameTile({ letter, state, testID }: GameTileProps) {
  const resolved = state ?? (letter ? "filled" : "empty");
  const classes = GAME_CELL_CLASS[resolved];

  return (
    <View
      testID={testID}
      className={`h-[56px] w-[56px] items-center justify-center rounded-ds-md border ${classes.container}`}
    >
      <Text
        className={`font-nunito-extrabold text-[24px] leading-[29px] ${classes.text}`}
        style={glyphCenterStyle(24)}
      >
        {letter ?? ""}
      </Text>
    </View>
  );
}
