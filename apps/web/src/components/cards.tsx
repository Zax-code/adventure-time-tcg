import type { ReactNode } from "react";
import type { CollectionResponse } from "@adventure-time/api-client";
import { Link } from "react-router-dom";

import { CardArt } from "@/components/game-art";
import {
  DiamondIcon,
  GiftHeartIcon,
  SwordsIcon,
  ZapIcon,
} from "@/components/icons";

export type CollectionEntry = CollectionResponse["cards"][number];

export function CardTile({
  entry,
  link = true,
  selected = false,
}: {
  entry: CollectionEntry;
  link?: boolean;
  selected?: boolean;
}) {
  const content = (
    <>
      <div className={`card-art type-${entry.card.type.toLowerCase()} rarity-${entry.card.rarity.name.toLowerCase()}`}>
        <CardArt card={entry.card} />
        <span className="rarity-badge">{entry.card.rarity.name}</span>
      </div>
      <div className="card-copy">
        <small>{entry.card.type} · {entry.card.rarity.name}</small>
        <b>{entry.card.name}</b>
        <span>{entry.card.character}</span>
      </div>
      <div className="card-stats" aria-label="Card statistics">
        <span title="Health"><GiftHeartIcon /> {entry.card.hp}</span>
        <span title="Attack"><SwordsIcon /> {entry.card.attack}</span>
        <span title="Defense"><DiamondIcon /> {entry.card.defense}</span>
        <span title="Speed"><ZapIcon /> {entry.card.speed}</span>
      </div>
      <span className="quantity-badge">{entry.quantity > 0 ? `×${entry.quantity}` : "Missing"}</span>
    </>
  );

  if (!link) {
    return <article className={`card-tile ${selected ? "selected" : ""}`.trim()}>{content}</article>;
  }

  return (
    <Link
      aria-label={`${entry.card.name}, ${entry.quantity > 0 ? `${entry.quantity} owned` : "not owned"}`}
      className={`card-tile ${entry.quantity === 0 ? "unowned" : ""} ${selected ? "selected" : ""}`.trim()}
      to={`/collection/${entry.cardId}`}
    >
      {content}
    </Link>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="card-grid">{children}</div>;
}
