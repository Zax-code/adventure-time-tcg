import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDailyNumbersOperation,
  getDailyNumbersOperatorAvailability,
  getDailyNumbersOperatorPressResult,
  getDailyNumbersTileAvailability,
  type DailyNumbersSelectableTile,
} from "../src/features/quests/daily-numbers/board-interaction.ts";

const tile = (id: string, value: number): DailyNumbersSelectableTile => ({
  id,
  value,
});

describe("Daily Numbers board interaction", () => {
  it("allows an operator to be selected before any number", () => {
    assert.deepEqual(
      getDailyNumbersOperatorPressResult({
        interactionLocked: false,
        operator: "+",
        selectedOperator: null,
      }),
      { accepted: true, nextSelectedOperator: "+" },
    );
  });

  it("allows the selected operator to be unselected without a selected number", () => {
    assert.deepEqual(
      getDailyNumbersOperatorPressResult({
        interactionLocked: false,
        operator: "-",
        selectedOperator: "-",
      }),
      { accepted: true, nextSelectedOperator: null },
    );
  });

  it("keeps invalid operators disabled for a selected pair but leaves the selected operator tappable", () => {
    const selectedLeftTile = tile("a", 5);
    const selectedRightTile = tile("b", 8);

    assert.equal(
      getDailyNumbersOperatorAvailability({
        interactionLocked: false,
        operator: "-",
        selectedLeftTile,
        selectedOperator: null,
        selectedRightTile,
      }).disabled,
      true,
    );

    assert.equal(
      getDailyNumbersOperatorAvailability({
        interactionLocked: false,
        operator: "-",
        selectedLeftTile,
        selectedOperator: "-",
        selectedRightTile,
      }).disabled,
      false,
    );
  });

  it("disables number candidates that cannot complete the selected operation", () => {
    const selectedLeftTile = tile("a", 8);

    assert.equal(
      getDailyNumbersTileAvailability({
        interactionLocked: false,
        selectedLeftTile,
        selectedOperator: "/",
        selectedRightTile: null,
        tile: tile("b", 3),
      }).disabled,
      true,
    );

    assert.equal(
      getDailyNumbersTileAvailability({
        interactionLocked: false,
        selectedLeftTile,
        selectedOperator: "/",
        selectedRightTile: null,
        tile: tile("c", 2),
      }).disabled,
      false,
    );
  });

  it("uses the open slot when only the right number remains selected", () => {
    const selectedRightTile = tile("b", 3);

    assert.equal(
      getDailyNumbersTileAvailability({
        interactionLocked: false,
        selectedLeftTile: null,
        selectedOperator: "-",
        selectedRightTile,
        tile: tile("a", 2),
      }).disabled,
      true,
    );

    assert.equal(
      getDailyNumbersTileAvailability({
        interactionLocked: false,
        selectedLeftTile: null,
        selectedOperator: "-",
        selectedRightTile,
        tile: tile("c", 5),
      }).disabled,
      false,
    );
  });

  it("preserves the Daily Numbers operation rules", () => {
    assert.deepEqual(applyDailyNumbersOperation(8, "/", 2), {
      ok: true,
      result: 4,
    });
    assert.deepEqual(applyDailyNumbersOperation(8, "/", 3), {
      ok: false,
      reason: "division",
    });
    assert.deepEqual(applyDailyNumbersOperation(3, "-", 3), {
      ok: false,
      reason: "positive",
    });
  });
});
