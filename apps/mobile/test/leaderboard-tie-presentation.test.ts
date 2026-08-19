import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRankingsPresentation } from "../src/features/leaderboards/rankings-presentation.ts";

function rows(...ranks: number[]) {
  return ranks.map((rank, index) => ({ id: index + 1, rank }));
}

describe("leaderboard tie presentation", () => {
  it("keeps unique top-three ranks eligible for the classic podium", () => {
    const presentation = buildRankingsPresentation(rows(1, 2, 3, 4));

    assert.equal(presentation.hasTopRankTie, false);
    assert.deepEqual(
      presentation.topRankGroups.map((group) => [
        group.rank,
        group.rows.map((row) => row.id),
      ]),
      [
        [1, [1]],
        [2, [2]],
        [3, [3]],
      ],
    );
    assert.deepEqual(
      presentation.remainingRows.map((row) => row.id),
      [4],
    );
  });

  it("keeps every player in a three-way third-place tie together", () => {
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
    assert.deepEqual(
      presentation.remainingRows.map((row) => row.id),
      [6],
    );
  });

  it("supports a tied second rank followed by a dense third rank", () => {
    const presentation = buildRankingsPresentation(rows(1, 2, 2, 2, 3, 4));

    assert.equal(presentation.hasTopRankTie, true);
    assert.deepEqual(
      presentation.topRankGroups.map((group) => [
        group.rank,
        group.rows.map((row) => row.id),
      ]),
      [
        [1, [1]],
        [2, [2, 3, 4]],
        [3, [5]],
      ],
    );
    assert.deepEqual(
      presentation.remainingRows.map((row) => row.id),
      [6],
    );
  });

  it("preserves competition ranking when a second-place tie skips to fifth", () => {
    const presentation = buildRankingsPresentation(rows(1, 2, 2, 2, 5));

    assert.equal(presentation.hasTopRankTie, true);
    assert.deepEqual(
      presentation.topRankGroups.map((group) => group.rank),
      [1, 2],
    );
    assert.deepEqual(
      presentation.remainingRows.map((row) => row.id),
      [5],
    );
  });
});
