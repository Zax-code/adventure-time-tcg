import { useCallback, useState } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { UnitAnimationEventType } from "./types";

interface UnitReactionAnimationOptions {
  compact?: boolean;
  swapOffset?: number;
}

const REACTION_FLASH_COLORS: Record<UnitAnimationEventType, string> = {
  attack: "rgba(251,146,60,0.5)",
  "buff-cast": "rgba(250,204,21,0.54)",
  damage: "rgba(248,113,113,0.62)",
  heal: "rgba(52,211,153,0.48)",
  death: "rgba(15,23,42,0.72)",
  buff: "rgba(250,204,21,0.5)",
  debuff: "rgba(168,85,247,0.5)",
  "swap-in": "rgba(59,130,246,0.44)",
  "swap-out": "rgba(14,165,233,0.38)",
};

export function useUnitReactionAnimation({
  compact = false,
  swapOffset = 0,
}: UnitReactionAnimationOptions = {}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotateZ = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const [overlayColor, setOverlayColor] = useState(
    REACTION_FLASH_COLORS.damage,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotateZ: `${rotateZ.value}deg` },
    ],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const reset = useCallback(() => {
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    cancelAnimation(scale);
    cancelAnimation(rotateZ);
    cancelAnimation(overlayOpacity);

    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    rotateZ.value = 0;
    overlayOpacity.value = 0;
  }, [overlayOpacity, rotateZ, scale, translateX, translateY]);

  const flash = useCallback(
    (type: UnitAnimationEventType, peak = 0.7, fadeDuration = 260) => {
      setOverlayColor(REACTION_FLASH_COLORS[type]);
      overlayOpacity.value = withSequence(
        withTiming(peak, { duration: 70, easing: Easing.out(Easing.quad) }),
        withTiming(0, {
          duration: fadeDuration,
          easing: Easing.out(Easing.quad),
        }),
      );
    },
    [overlayOpacity],
  );

  const triggerReaction = useCallback(
    (type: UnitAnimationEventType) => {
      reset();

      if (type === "attack") {
        flash(type, 0.5, 300);
        const lift = compact ? -3 : -6;
        const lean = compact ? -1.4 : -2.5;
        translateY.value = withSequence(
          withTiming(lift, { duration: 84, easing: Easing.out(Easing.quad) }),
          withTiming(compact ? 1 : 2, {
            duration: 92,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) }),
        );
        rotateZ.value = withSequence(
          withTiming(lean, { duration: 84, easing: Easing.out(Easing.quad) }),
          withTiming(-lean * 0.45, { duration: 92 }),
          withTiming(0, { duration: 120 }),
        );
        scale.value = withSequence(
          withTiming(1.075, { duration: 84, easing: Easing.out(Easing.quad) }),
          withTiming(0.985, { duration: 92, easing: Easing.inOut(Easing.quad) }),
          withSpring(1, { damping: 12, stiffness: 190 }),
        );
        return;
      }

      if (type === "buff-cast") {
        flash(type, 0.6, 460);
        translateY.value = withSequence(
          withTiming(compact ? -4 : -8, {
            duration: 160,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(0, { duration: 250, easing: Easing.out(Easing.quad) }),
        );
        scale.value = withSequence(
          withTiming(1.09, { duration: 150, easing: Easing.out(Easing.quad) }),
          withTiming(1.02, { duration: 120 }),
          withSpring(1, { damping: 10, stiffness: 130 }),
        );
        return;
      }

      if (type === "damage") {
        flash(type, 0.7, 420);
        const shake = compact ? 4 : 7;
        translateX.value = withSequence(
          withTiming(-shake, { duration: 72 }),
          withTiming(shake, { duration: 86 }),
          withTiming(-shake * 0.7, { duration: 80 }),
          withTiming(shake * 0.55, { duration: 74 }),
          withTiming(0, { duration: 92 }),
        );
        scale.value = withSequence(
          withTiming(1.025, { duration: 120 }),
          withTiming(1, { duration: 260 }),
        );
        return;
      }

      if (type === "heal") {
        flash(type, 0.58);
        translateY.value = withSequence(
          withTiming(compact ? -3 : -5, {
            duration: 120,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, { duration: 170, easing: Easing.out(Easing.quad) }),
        );
        scale.value = withSequence(
          withTiming(1.055, { duration: 120 }),
          withSpring(1, { damping: 10, stiffness: 180 }),
        );
        return;
      }

      if (type === "buff") {
        flash(type, 0.56, 430);
        translateY.value = withSequence(
          withTiming(compact ? -2 : -4, { duration: 170 }),
          withTiming(0, { duration: 260 }),
        );
        scale.value = withSequence(
          withTiming(1.045, { duration: 170 }),
          withTiming(0.995, { duration: 130 }),
          withSpring(1, { damping: 11, stiffness: 120 }),
        );
        return;
      }

      if (type === "debuff") {
        flash(type, 0.62);
        const shake = compact ? 3 : 5;
        translateX.value = withSequence(
          withTiming(shake, { duration: 50 }),
          withTiming(-shake, { duration: 58 }),
          withTiming(shake * 0.55, { duration: 50 }),
          withTiming(0, { duration: 60 }),
        );
        translateY.value = withSequence(
          withTiming(compact ? 2 : 4, { duration: 100 }),
          withTiming(0, { duration: 150 }),
        );
        scale.value = withSequence(
          withTiming(0.985, { duration: 90 }),
          withSpring(1, { damping: 11, stiffness: 190 }),
        );
        return;
      }

      if (type === "death") {
        flash(type, 0.76, 440);
        const wiltRotation = compact ? -4.5 : -6;
        const wiltDrop = compact ? 5 : 10;
        rotateZ.value = withSequence(
          withTiming(2.5, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(wiltRotation, {
            duration: 320,
            easing: Easing.out(Easing.cubic),
          }),
        );
        translateY.value = withSequence(
          withTiming(-2, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(wiltDrop, {
            duration: 320,
            easing: Easing.out(Easing.cubic),
          }),
        );
        scale.value = withSequence(
          withTiming(1.02, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(0.94, {
            duration: 320,
            easing: Easing.out(Easing.cubic),
          }),
        );
        return;
      }

      flash(type, 0.48);
      translateX.value = swapOffset;
      translateY.value = type === "swap-in" ? (compact ? -2 : -4) : 0;
      scale.value = type === "swap-in" ? 0.9 : 0.96;
      translateX.value = withSpring(0, { damping: 12, stiffness: 170 });
      translateY.value = withSpring(0, { damping: 13, stiffness: 160 });
      scale.value = withSpring(1, { damping: 11, stiffness: 180 });
    },
    [compact, flash, reset, rotateZ, scale, swapOffset, translateX, translateY],
  );

  return {
    animatedStyle,
    overlayAnimatedStyle,
    overlayColor,
    triggerReaction,
  };
}
