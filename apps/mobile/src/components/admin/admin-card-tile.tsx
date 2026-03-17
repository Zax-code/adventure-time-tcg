import type { AdminCardDetail, AdminCardsResponse } from "@adventure-time/shared";

import { CardTile } from "../card-tile";

type AdminCard = AdminCardsResponse["cards"][number] | AdminCardDetail;

export function AdminCardTile({
  card,
  onPress,
  size = "small",
}: {
  card: AdminCard;
  onPress?: () => void;
  size?: "small" | "large";
}) {
  return (
    <CardTile
      entry={{
        id: `admin-${card.id}`,
        cardId: card.id,
        quantity: 1,
        obtainedAt: new Date().toISOString(),
        card: {
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
            id: card.rarityId,
            name: card.rarityName,
            dropRate: 0,
            color: "",
          },
        },
      }}
      size={size}
      onPress={onPress}
    />
  );
}
