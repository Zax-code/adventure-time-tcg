import { memo, useMemo } from "react";

import type { AdminCardDetail, AdminCardsResponse } from "@adventure-time/api-client";

import { CardTile } from "../card-tile";

type AdminCard = AdminCardsResponse["cards"][number] | AdminCardDetail;

export const AdminCardTile = memo(
  function AdminCardTile({
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
      [
        card.id,
        card.name,
        card.character,
        card.description,
        card.hp,
        card.attack,
        card.defense,
        card.speed,
        card.type,
        card.imageAssetId,
        card.rarityId,
        card.rarityName,
      ],
    );

    return (
      <CardTile
        entry={entry}
        size={size}
        fitContainer={fitContainer}
        onPress={onPress}
      />
    );
  },
  (prev, next) =>
    prev.card.id === next.card.id &&
    prev.card.name === next.card.name &&
    prev.card.character === next.card.character &&
    prev.card.hp === next.card.hp &&
    prev.card.attack === next.card.attack &&
    prev.card.defense === next.card.defense &&
    prev.card.speed === next.card.speed &&
    prev.card.type === next.card.type &&
    prev.card.rarityId === next.card.rarityId &&
    prev.card.rarityName === next.card.rarityName &&
    prev.card.imageAssetId === next.card.imageAssetId &&
    prev.size === next.size &&
    prev.fitContainer === next.fitContainer &&
    prev.onPress === next.onPress,
);
