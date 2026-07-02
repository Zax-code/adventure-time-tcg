import { Text } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

const NARROW_TILE_LETTER_STYLE = {
  minWidth: 12,
  textAlign: "center" as const,
};

export function WordleTile({
  bgBorderCls,
  isActiveLetter,
  isAnimatingRow,
  isRemovingCell,
  letter,
  letterCls,
  popAnim,
  removeOpacity,
  removeScale,
  rowFlipAnim,
}: {
  bgBorderCls: string;
  isActiveLetter: boolean;
  isAnimatingRow: boolean;
  isRemovingCell: boolean;
  letter: string;
  letterCls: string;
  popAnim: SharedValue<number>;
  removeOpacity: SharedValue<number>;
  removeScale: SharedValue<number>;
  rowFlipAnim: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const transform = [];

    if (isRemovingCell) {
      transform.push({ scale: removeScale.value });
    } else if (isActiveLetter) {
      transform.push({ scale: popAnim.value });
    }

    if (isAnimatingRow) {
      transform.push({ scaleX: rowFlipAnim.value });
    }

    return {
      opacity: isRemovingCell ? removeOpacity.value : 1,
      transform,
    };
  });

  return (
    <Animated.View
      className={`rounded-xl border-2 items-center justify-center ${bgBorderCls}`}
      style={[{ width: "100%", height: 48 }, animatedStyle]}
    >
      <Text
        className={`text-xl font-nunito-extrabold ${letterCls}`}
        style={letter === "I" ? NARROW_TILE_LETTER_STYLE : undefined}
      >
        {letter}
      </Text>
    </Animated.View>
  );
}
