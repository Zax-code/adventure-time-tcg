import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getChangedTouchCount,
  pressForChangedTouches,
  releaseChangedTouches,
} from "../src/features/quests/speed-calculus/keypad-touch.ts";

describe("Speed Calculus keypad touch handling", () => {
  it("treats a missing changedTouches list as one touch", () => {
    assert.equal(getChangedTouchCount({ nativeEvent: {} }), 1);
  });

  it("fires one key press per changed touch in a multi-touch start event", () => {
    let pressCount = 0;

    const changedTouchCount = pressForChangedTouches(
      { nativeEvent: { changedTouches: [{}, {}, {}] } },
      () => {
        pressCount += 1;
      },
    );

    assert.equal(changedTouchCount, 3);
    assert.equal(pressCount, 3);
  });

  it("keeps pressed state active until all changed touches are released", () => {
    assert.equal(
      releaseChangedTouches(3, { nativeEvent: { changedTouches: [{}, {}] } }),
      1,
    );
    assert.equal(
      releaseChangedTouches(1, { nativeEvent: { changedTouches: [{}] } }),
      0,
    );
    assert.equal(
      releaseChangedTouches(1, { nativeEvent: { changedTouches: [{}, {}] } }),
      0,
    );
  });
});
