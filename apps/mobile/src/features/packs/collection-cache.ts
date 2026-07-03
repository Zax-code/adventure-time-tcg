import type {
  CollectionResponse,
  HomeResponse,
  OpenPackResponse,
} from "@adventure-time/api-client";

function completionPercentage(uniqueOwned: number, totalCatalogCards: number) {
  if (totalCatalogCards <= 0) {
    return 0;
  }

  return Math.round((uniqueOwned / totalCatalogCards) * 100);
}

export function patchCollectionAfterPackOpen(
  current: CollectionResponse | undefined,
  result: OpenPackResponse,
): CollectionResponse | undefined {
  if (!current) {
    return current;
  }

  const openedCountsByCardId = new Map<string, number>();

  for (const card of result.cards) {
    openedCountsByCardId.set(
      card.id,
      (openedCountsByCardId.get(card.id) ?? 0) + 1,
    );
  }

  if (openedCountsByCardId.size === 0) {
    return current;
  }

  const obtainedAt = new Date().toISOString();
  const cards = current.cards.map((entry) => {
    const openedCount = openedCountsByCardId.get(entry.cardId) ?? 0;

    if (openedCount === 0) {
      return entry;
    }

    const quantity = entry.quantity + openedCount;

    return {
      ...entry,
      quantity,
      obtainedAt: entry.obtainedAt ?? obtainedAt,
    };
  });
  const totalCards = cards.reduce((sum, entry) => sum + entry.quantity, 0);
  const uniqueOwned = cards.filter((entry) => entry.quantity > 0).length;

  return {
    ...current,
    cards,
    stats: {
      totalCards,
      uniqueOwned,
      completionPercentage: completionPercentage(uniqueOwned, cards.length),
    },
  };
}

export function patchHomeAfterPackOpen(
  current: HomeResponse | undefined,
  result: OpenPackResponse,
): HomeResponse | undefined {
  if (!current) {
    return current;
  }

  const newlyOwnedCardIds = new Set(
    result.cards
      .filter((card) => card.isNewForUser)
      .map((card) => card.id),
  );
  const totalCards = current.collectionStats.totalCards;
  const uniqueOwned = Math.min(
    totalCards,
    current.collectionStats.uniqueOwned + newlyOwnedCardIds.size,
  );

  return {
    ...current,
    user: {
      ...current.user,
      coins: result.newBalance,
    },
    collectionStats: {
      ...current.collectionStats,
      uniqueOwned,
      completionPercentage: completionPercentage(uniqueOwned, totalCards),
    },
  };
}
