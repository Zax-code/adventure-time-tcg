export function calculateCollectionCompletion(totalCards: number, uniqueOwned: number) {
  if (totalCards <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((uniqueOwned / totalCards) * 100)));
}
