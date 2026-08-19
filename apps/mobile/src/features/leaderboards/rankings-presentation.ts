export type TopRank = 1 | 2 | 3;

export type TopRankGroup<Row extends { rank: number }> = {
  rank: TopRank;
  rows: Row[];
};

export function buildRankingsPresentation<Row extends { rank: number }>(
  rows: readonly Row[],
) {
  const topRankGroups = ([1, 2, 3] as const).flatMap((rank) => {
    const rankedRows = rows.filter((row) => row.rank === rank);

    return rankedRows.length > 0 ? [{ rank, rows: rankedRows }] : [];
  });

  return {
    topRankGroups,
    hasTopRankTie: topRankGroups.some((group) => group.rows.length > 1),
    remainingRows: rows.filter((row) => row.rank > 3),
  };
}
