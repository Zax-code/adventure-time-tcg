import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { glyphCenterStyle } from "../../../components/ui/game/game-state";

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
  rowFlipAnim,
}: {
  bgBorderCls: string;
  isActiveLetter: boolean;
  isAnimatingRow: boolean;
  isRemovingCell: boolean;
  letter: string;
  letterCls: string;
  rowFlipAnim: SharedValue<number>;
}) {
  const entryScale = useSharedValue(1);
  const entryOpacity = useSharedValue(1);
  const removeShake = useSharedValue(0);
  const removeLetterOpacity = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(entryScale);
    cancelAnimation(entryOpacity);

    if (!letter || isRemovingCell) {
      entryScale.value = 1;
      entryOpacity.value = 1;
      return;
    }

    entryScale.value = 0.88;
    entryOpacity.value = 0.4;
    entryScale.value = withTiming(1, { duration: 110 });
    entryOpacity.value = withTiming(1, { duration: 110 });
  }, [entryOpacity, entryScale, isRemovingCell, letter]);

  useEffect(() => {
    cancelAnimation(removeShake);
    cancelAnimation(removeLetterOpacity);

    if (!isRemovingCell) {
      removeShake.value = 0;
      removeLetterOpacity.value = 1;
      return;
    }

    removeShake.value = 0;
    removeLetterOpacity.value = 1;
    removeShake.value = withSequence(
      withTiming(-3, { duration: 32 }),
      withTiming(3, { duration: 32 }),
      withTiming(-2, { duration: 32 }),
      withTiming(2, { duration: 32 }),
      withTiming(0, { duration: 32 }),
    );
    removeLetterOpacity.value = withTiming(0, { duration: 150 });
  }, [isRemovingCell, removeLetterOpacity, removeShake]);

  const animatedStyle = useAnimatedStyle(() => {
    const transform = [];

    if (isRemovingCell) {
      transform.push({ translateX: removeShake.value });
    }

    if (!isRemovingCell && isActiveLetter) {
      transform.push({ scale: entryScale.value });
    }

    if (isAnimatingRow) {
      transform.push({ scaleX: rowFlipAnim.value });
    }

    return {
      transform,
    };
  });
  const letterAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isRemovingCell ? removeLetterOpacity.value : entryOpacity.value,
  }));

  return (
    <Animated.View
      className={`rounded-ds-md border items-center justify-center ${bgBorderCls}`}
      style={[{ width: "100%", height: "100%" }, animatedStyle]}
    >
      <Animated.Text
        className={`text-[24px] leading-[29px] font-nunito-extrabold ${letterCls}`}
        style={[
          letter === "I" ? NARROW_TILE_LETTER_STYLE : undefined,
          glyphCenterStyle(24),
          letterAnimatedStyle,
        ]}
      >
        {letter}
      </Animated.Text>
    </Animated.View>
  );
}
