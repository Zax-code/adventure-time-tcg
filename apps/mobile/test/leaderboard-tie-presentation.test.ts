import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  arrangePodium,
  buildRankingsPresentation,
} from "../src/features/leaderboards/rankings-presentation.ts";

function rows(...ranks: number[]) {
  return ranks.map((rank, index) => ({ id: index + 1, rank }));
}

function slotIds(presentation: ReturnType<typeof buildRankingsPresentation>) {
  return presentation.podiumSlots.map((slot) =>
    slot ? [(slot.row as { id: number }).id, slot.rank, slot.tieIndex] : null,
  );
}

describe("leaderboard tie presentation", () => {
  it("puts unique top-three ranks on the classic 2-1-3 podium", () => {
    const presentation = buildRankingsPresentation(rows(1, 2, 3, 4));

    assert.equal(presentation.hasTopRankTie, false);
    assert.deepEqual(slotIds(presentation), [
      [2, 2, 0],
      [1, 1, 0],
      [3, 3, 0],
    ]);
    assert.deepEqual(
      presentation.remainingRows.map((item) => [
        (item.row as { id: number }).id,
        item.tied,
      ]),
      [[4, false]],
    );
  });

  it("keeps every player in a three-way third-place tie on the podium", () => {
    const presentation = buildRankingsPresentation(rows(1, 2, 3, 3, 3, 6));

    assert.equal(presentation.hasTopRankTie, true);
    assert.deepEqual(
      presentation.topRankGroups.map((group) => [
        group.rank,
        group.rows.map((row) => row.id),
      ]),
      [
        [1, [1]],
        [2, [2]],
        [3, [3, 4, 5]],
      ],
    );
    assert.deepEqual(slotIds(presentation), [
      [4, 3, 1],
      [2, 2, 0],
      [1, 1, 0],
      [3, 3, 0],
      [5, 3, 2],
    ]);
    assert.deepEqual(
      presentation.remainingRows.map((item) => (item.row as { id: number }).id),
      [6],
    );
  });

  it("gives tied first places the same rank so they share a pedestal height", () => {
    const presentation = buildRankingsPresentation(rows(1, 1, 3, 4));

    assert.deepEqual(slotIds(presentation), [
      [2, 1, 1],
      [1, 1, 0],
      [3, 3, 0],
    ]);
  });

  it("preserves competition ranking when a second-place tie skips to fifth", () => {
    const presentation = buildRankingsPresentation(rows(1, 2, 2, 2, 5));

    assert.equal(presentation.hasTopRankTie, true);
    assert.deepEqual(
      presentation.topRankGroups.map((group) => group.rank),
      [1, 2],
    );
    assert.deepEqual(
      presentation.remainingRows.map((item) => (item.row as { id: number }).id),
      [5],
    );
  });

  it("continues tied top-three players past five podium places in the standings", () => {
    const presentation = buildRankingsPresentation(rows(1, 2, 3, 3, 3, 3, 7));

    assert.equal(presentation.podiumSlots.length, 5);
    assert.deepEqual(
      presentation.remainingRows.map((item) => [
        (item.row as { id: number }).id,
        item.tieIndex,
        item.tied,
      ]),
      [
        [6, 3, true],
        [7, 0, false],
      ],
    );
  });

  it("marks tied standings rows and numbers their tie order", () => {
    const presentation = buildRankingsPresentation(rows(1, 2, 3, 4, 5, 5, 7));

    assert.deepEqual(
      presentation.remainingRows.map((item) => [item.tieIndex, item.tied]),
      [
        [0, false],
        [0, true],
        [1, true],
        [0, false],
      ],
    );
  });

  it("keeps the winner centered when fewer than three players are ranked", () => {
    assert.deepEqual(arrangePodium(["a"]), [null, "a", null]);
    assert.deepEqual(arrangePodium(["a", "b"]), ["b", "a", null]);
    assert.deepEqual(arrangePodium([]), []);
  });
});
