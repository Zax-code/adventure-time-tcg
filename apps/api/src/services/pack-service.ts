import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db, cards, ownedCards, packs, rarities, users } from "@adventure-time/db";

type CardWithRarity = typeof cards.$inferSelect & {
  rarity: typeof rarities.$inferSelect;
};

function selectCardByRarity(
  availableCards: CardWithRarity[],
  availableRarities: Array<typeof rarities.$inferSelect>,
  guaranteedRarity?: string | null,
) {
  if (guaranteedRarity) {
    const guaranteed = availableRarities.find((rarity) => rarity.name === guaranteedRarity);
    if (guaranteed) {
      const guaranteedCards = availableCards.filter((card) => card.rarityId === guaranteed.id);
      if (guaranteedCards.length > 0) {
        return guaranteedCards[Math.floor(Math.random() * guaranteedCards.length)];
      }
    }
  }

  const totalWeight = availableRarities.reduce((sum, rarity) => sum + rarity.dropRate, 0);
  let roll = Math.random() * totalWeight;
  let selectedRarityId: string | null = null;
  for (const rarity of availableRarities) {
    roll -= rarity.dropRate;
    if (roll <= 0) {
      selectedRarityId = rarity.id;
      break;
    }
  }

  if (!selectedRarityId) {
    selectedRarityId = availableRarities[0]?.id ?? null;
  }

  const cardsOfRarity = availableCards.filter((card) => card.rarityId === selectedRarityId);
  if (cardsOfRarity.length === 0) {
    return availableCards[Math.floor(Math.random() * availableCards.length)];
  }

  return cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
}

export async function openPackForUser(userId: string, packId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    throw new Error("User not found");
  }

  const pack = await db.query.packs.findFirst({ where: eq(packs.id, packId) });
  if (!pack || !pack.isActive) {
    throw new Error("Pack not found or inactive");
  }

  if (user.coins < pack.cost) {
    throw new Error("Not enough coins");
  }

  const availableCards = await db.query.cards.findMany({
    where: eq(cards.isArchived, false),
    with: { rarity: true },
  }) as CardWithRarity[];
  const availableRarities = await db.query.rarities.findMany({ orderBy: [desc(rarities.dropRate)] });

  if (availableCards.length === 0) {
    throw new Error("No cards available");
  }

  const selectedCards: CardWithRarity[] = [];
  if (pack.guaranteedRarity) {
    selectedCards.push(selectCardByRarity(availableCards, availableRarities, pack.guaranteedRarity));
  }

  const remainingSlots = pack.cardCount - selectedCards.length;
  for (let index = 0; index < remainingSlots; index += 1) {
    selectedCards.push(selectCardByRarity(availableCards, availableRarities));
  }

  for (let index = selectedCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [selectedCards[index], selectedCards[swapIndex]] = [selectedCards[swapIndex], selectedCards[index]];
  }

  const existingOwned = await db.query.ownedCards.findMany({
    where: eq(ownedCards.userId, userId),
  });
  const ownedIds = new Set(existingOwned.map((entry) => entry.cardId));

  const result = await db.transaction(async (tx) => {
    await tx.update(users).set({ coins: user.coins - pack.cost, updatedAt: new Date() }).where(eq(users.id, userId));

    for (const card of selectedCards) {
      const existing = await tx.query.ownedCards.findFirst({
        where: and(eq(ownedCards.cardId, card.id), eq(ownedCards.userId, userId)),
      });

      if (existing) {
        await tx
          .update(ownedCards)
          .set({ quantity: existing.quantity + 1 })
          .where(eq(ownedCards.id, existing.id));
      } else {
        await tx.insert(ownedCards).values({
          id: randomUUID(),
          cardId: card.id,
          userId,
          quantity: 1,
          obtainedAt: new Date(),
        });
      }
    }

    const updatedUser = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    return updatedUser;
  });

  return {
    pack,
    cards: selectedCards.map((card) => ({
      id: card.id,
      name: card.name,
      character: card.character,
      description: card.description,
      hp: card.hp,
      attack: card.attack,
      defense: card.defense,
      speed: card.speed,
      type: card.type,
      imageAssetId: card.imageAssetId,
      rarity: {
        id: card.rarity.id,
        name: card.rarity.name,
        dropRate: card.rarity.dropRate,
        color: card.rarity.color,
      },
      isNewForUser: !ownedIds.has(card.id),
    })),
    newBalance: result?.coins ?? user.coins,
  };
}
