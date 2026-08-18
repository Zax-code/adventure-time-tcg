import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getChangedTouchIdentifiers,
  getKeyPressesForChangedTouches,
} from "../src/features/quests/speed-calculus/keypad-touch.ts";

describe("Speed Calculus keypad touch handling", () => {
  it("routes near-simultaneous Android pointer-down events to their actual keys", () => {
    const keyBounds = [
      { keyId: "1", left: 0, top: 0, right: 58, bottom: 58 },
      { keyId: "2", left: 66, top: 0, right: 124, bottom: 58 },
    ];

    const firstPresses = getKeyPressesForChangedTouches(
      {
        nativeEvent: {
          changedTouches: [{ identifier: 0, pageX: 29, pageY: 29 }],
        },
      },
      keyBounds,
    );
    const secondPresses = getKeyPressesForChangedTouches(
      {
        nativeEvent: {
          changedTouches: [{ identifier: 1, pageX: 95, pageY: 29 }],
        },
      },
      keyBounds,
    );

    assert.deepEqual(firstPresses, [{ identifier: 0, keyId: "1" }]);
    assert.deepEqual(secondPresses, [{ identifier: 1, keyId: "2" }]);
  });

  it("routes an iOS batch of changed touches exactly once per touched key", () => {
    const presses = getKeyPressesForChangedTouches(
      {
        nativeEvent: {
          changedTouches: [
            { identifier: 8, pageX: 29, pageY: 29 },
            { identifier: 9, pageX: 95, pageY: 29 },
          ],
        },
      },
      [
        { keyId: "1", left: 0, top: 0, right: 58, bottom: 58 },
        { keyId: "2", left: 66, top: 0, right: 124, bottom: 58 },
      ],
    );

    assert.deepEqual(presses, [
      { identifier: 8, keyId: "1" },
      { identifier: 9, keyId: "2" },
    ]);
  });

  it("uses touch timestamps to preserve digit order within a native batch", () => {
    const presses = getKeyPressesForChangedTouches(
      {
        nativeEvent: {
          changedTouches: [
            { identifier: 4, pageX: 95, pageY: 29, timestamp: 20 },
            { identifier: 3, pageX: 29, pageY: 29, timestamp: 10 },
          ],
        },
      },
      [
        { keyId: "1", left: 0, top: 0, right: 58, bottom: 58 },
        { keyId: "2", left: 66, top: 0, right: 124, bottom: 58 },
      ],
    );

    assert.deepEqual(
      presses.map(({ keyId }) => keyId),
      ["1", "2"],
    );
  });

  it("accepts a touch in the narrow visual gap without overlapping keys", () => {
    const presses = getKeyPressesForChangedTouches(
      {
        nativeEvent: {
          changedTouches: [{ identifier: 2, pageX: 62, pageY: 29 }],
        },
      },
      [
        { keyId: "1", left: 0, top: 0, right: 58, bottom: 58 },
        { keyId: "2", left: 66, top: 0, right: 124, bottom: 58 },
      ],
      4,
    );

    assert.deepEqual(presses, [{ identifier: 2, keyId: "1" }]);
  });

  it("releases every changed touch identifier in a batched end event", () => {
    assert.deepEqual(
      getChangedTouchIdentifiers({
        nativeEvent: {
          changedTouches: [{ identifier: 8 }, { identifier: 9 }],
        },
      }),
      [8, 9],
    );
  });

  it("routes 10,000 deterministic two-finger batches without dropping a key", () => {
    const keyBounds = Array.from({ length: 12 }, (_, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const left = column * 66;
      const top = row * 66;

      return {
        keyId: String(index),
        left,
        top,
        right: left + 58,
        bottom: top + 58,
      };
    });

    for (let iteration = 0; iteration < 10_000; iteration += 1) {
      const firstIndex = iteration % keyBounds.length;
      const secondIndex = (iteration * 7 + 3) % keyBounds.length;
      const first = keyBounds[firstIndex];
      const second = keyBounds[secondIndex];
      const presses = getKeyPressesForChangedTouches(
        {
          nativeEvent: {
            changedTouches: [
              {
                identifier: iteration * 2 + 1,
                pageX: second.left + 29,
                pageY: second.top + 29,
                timestamp: 2,
              },
              {
                identifier: iteration * 2,
                pageX: first.left + 29,
                pageY: first.top + 29,
                timestamp: 1,
              },
            ],
          },
        },
        keyBounds,
        4,
      );

      assert.deepEqual(
        presses.map(({ keyId }) => keyId),
        [first.keyId, second.keyId],
      );
    }
  });
});
