export type KeypadTouchPoint = {
  identifier?: number | string;
  pageX?: number;
  pageY?: number;
  timestamp?: number;
};

export type KeypadTouchEvent = {
  nativeEvent?: KeypadTouchPoint & {
    changedTouches?: readonly KeypadTouchPoint[] | null;
  };
};

export type KeyBounds<KeyId extends string = string> = {
  keyId: KeyId;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type KeyPress<KeyId extends string = string> = {
  identifier: number | string;
  keyId: KeyId;
};

function changedTouchPoints(event: KeypadTouchEvent): KeypadTouchPoint[] {
  const changedTouches = event.nativeEvent?.changedTouches;
  if (changedTouches && changedTouches.length > 0) {
    return [...changedTouches].sort(
      (left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0),
    );
  }

  return event.nativeEvent ? [event.nativeEvent] : [];
}

function distanceFromBounds(
  point: KeypadTouchPoint,
  bounds: KeyBounds,
): number {
  if (point.pageX === undefined || point.pageY === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  const dx = Math.max(bounds.left - point.pageX, 0, point.pageX - bounds.right);
  const dy = Math.max(bounds.top - point.pageY, 0, point.pageY - bounds.bottom);
  return Math.hypot(dx, dy);
}

export function getChangedTouchIdentifiers(
  event: KeypadTouchEvent,
): Array<number | string> {
  return changedTouchPoints(event).map(
    (touch, index) => touch.identifier ?? `anonymous-${index}`,
  );
}

export function getKeyPressesForChangedTouches<KeyId extends string>(
  event: KeypadTouchEvent,
  keyBounds: readonly KeyBounds<KeyId>[],
  hitSlop = 0,
): KeyPress<KeyId>[] {
  const presses: KeyPress<KeyId>[] = [];
  const touches = changedTouchPoints(event);

  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches[index];
    if (touch.pageX === undefined || touch.pageY === undefined) continue;

    let match: KeyBounds<KeyId> | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const bounds of keyBounds) {
      const distance = distanceFromBounds(touch, bounds);
      if (distance === 0) {
        match = bounds;
        break;
      }
      if (distance <= hitSlop && distance < nearestDistance) {
        match = bounds;
        nearestDistance = distance;
      }
    }

    if (match) {
      presses.push({
        identifier: touch.identifier ?? `anonymous-${index}`,
        keyId: match.keyId,
      });
    }
  }

  return presses;
}
