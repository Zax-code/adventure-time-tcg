export type TopRank = 1 | 2 | 3;

export type TopRankGroup<Row extends { rank: number }> = {
  rank: TopRank;
  rows: Row[];
};

export type PresentedRow<Row extends { rank: number }> = {
  row: Row;
  // 0 for the first player holding a rank, 1 for the second tied player...
  tieIndex: number;
  // Another player shares this backend rank.
  tied: boolean;
};

export type PodiumPlace<Row extends { rank: number }> = PresentedRow<Row> & {
  rank: TopRank;
};

// The podium card fits five 56-wide columns on a 390-wide phone; any further
// tied top-three players continue in the standings list.
export const PODIUM_MAX_PLACES = 5;

const isTopRank = (rank: number): rank is TopRank => rank >= 1 && rank <= 3;

// Rows arrive in backend order with competition ranking (1, 2, 2, 4), so tied
// players are contiguous and share the rank the backend gave them.
export function buildRankingsPresentation<Row extends { rank: number }>(
  rows: readonly Row[],
) {
  const rankCounts = new Map<number, number>();
  for (const row of rows) {
    rankCounts.set(row.rank, (rankCounts.get(row.rank) ?? 0) + 1);
  }

  const seenByRank = new Map<number, number>();
  const presented: PresentedRow<Row>[] = rows.map((row) => {
    const tieIndex = seenByRank.get(row.rank) ?? 0;
    seenByRank.set(row.rank, tieIndex + 1);
    return { row, tieIndex, tied: (rankCounts.get(row.rank) ?? 0) > 1 };
  });

  const topRankGroups: TopRankGroup<Row>[] = ([1, 2, 3] as const).flatMap(
    (rank) => {
      const rankedRows = rows.filter((row) => row.rank === rank);
      return rankedRows.length > 0 ? [{ rank, rows: rankedRows }] : [];
    },
  );

  const topPlaces = presented.filter((item) => isTopRank(item.row.rank));
  const podiumPlaces = topPlaces
    .slice(0, PODIUM_MAX_PLACES)
    .map((item) => ({ ...item, rank: item.row.rank as TopRank }));

  return {
    topRankGroups,
    hasTopRankTie: topRankGroups.some((group) => group.rows.length > 1),
    podiumSlots: arrangePodium(podiumPlaces),
    remainingRows: [
      ...topPlaces.slice(PODIUM_MAX_PLACES),
      ...presented.filter((item) => !isTopRank(item.row.rank)),
    ],
  };
}

// Classic podium order grown from the center: best in the middle, then
// alternating left and right (2 - 1 - 3, then 4 - 2 - 1 - 3 - 5). Fewer than
// three places keep empty side slots so the winner stays centered.
export function arrangePodium<Place>(places: readonly Place[]) {
  const slots: Array<Place | null> = [];
  places.forEach((place, index) => {
    if (index === 0) slots.push(place);
    else if (index % 2 === 1) slots.unshift(place);
    else slots.push(place);
  });

  if (places.length === 1) return [null, ...slots, null];
  if (places.length === 2) return [...slots, null];
  return slots;
}
