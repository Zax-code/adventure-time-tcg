import {
  type AdminCardDetail,
  type AdminCardsResponse,
  type CardType,
} from "@adventure-time/api-client";

type EditableCard = AdminCardsResponse["cards"][number] | AdminCardDetail;

export type CardDraft = {
  name: string;
  character: string;
  description: string;
  hp: string;
  attack: string;
  defense: string;
  speed: string;
  type: CardType;
  rarityId: string;
};

export type AssignmentDraft = {
  passiveId: string;
  skillId: string;
  ultimateId: string;
};

export const BLANK_CARD_DRAFT: CardDraft = {
  name: "",
  character: "",
  description: "",
  hp: "100",
  attack: "20",
  defense: "20",
  speed: "40",
  type: "Hero",
  rarityId: "",
};

export function toCardDraft(card: EditableCard): CardDraft {
  return {
    name: card.name,
    character: card.character,
    description: card.description,
    hp: String(card.hp),
    attack: String(card.attack),
    defense: String(card.defense),
    speed: String(card.speed),
    type: card.type,
    rarityId: card.rarityId,
  };
}

export function toCardSavePayload(draft: CardDraft) {
  return {
    name: draft.name.trim(),
    character: draft.character.trim(),
    description: draft.description.trim(),
    hp: Number(draft.hp),
    attack: Number(draft.attack),
    defense: Number(draft.defense),
    speed: Number(draft.speed),
    type: draft.type,
    rarityId: draft.rarityId,
  };
}
