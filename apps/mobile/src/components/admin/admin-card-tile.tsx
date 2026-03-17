import { memo, useMemo } from "react";

import type { AdminCardDetail, AdminCardsResponse } from "@adventure-time/shared";

import { CardTile } from "../card-tile";

type AdminCard = AdminCardsResponse["cards"][number] | AdminCardDetail;

export const AdminCardTile = memo(function AdminCardTile({
  card,
  onPress,
  size = "small",
  fitContainer = false,
}: {
  card: AdminCard;
  onPress?: () => void;
  size?: "small" | "large";
  fitContainer?: boolean;
}) {
  const entry = useMemo(
    () => ({
      id: `admin-${card.id}`,
      cardId: card.id,
      quantity: 1,
      obtainedAt: "admin",
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
    }),
    [card],
  );

  return (
    <CardTile
      entry={entry}
      size={size}
      fitContainer={fitContainer}
      onPress={onPress}
    />
  );
});
