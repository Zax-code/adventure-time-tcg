export type KeypadTouchEvent = {
  nativeEvent?: {
    changedTouches?: readonly unknown[] | null;
  };
};

export function getChangedTouchCount(event: KeypadTouchEvent): number {
  return Math.max(1, event.nativeEvent?.changedTouches?.length ?? 1);
}

export function releaseChangedTouches(
  activeTouchCount: number,
  event: KeypadTouchEvent,
): number {
  return Math.max(0, activeTouchCount - getChangedTouchCount(event));
}

export function pressForChangedTouches(
  event: KeypadTouchEvent,
  onPress: () => void,
): number {
  const changedTouchCount = getChangedTouchCount(event);

  for (let index = 0; index < changedTouchCount; index += 1) {
    onPress();
  }

  return changedTouchCount;
}
