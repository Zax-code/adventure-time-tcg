export type CardDustActionType = "craft" | "recycle";

export type CardDustActionAnimationState = {
  id: number;
  type: CardDustActionType;
  disappearCard?: boolean;
  revealLockedCard?: boolean;
};

export const CARD_DUST_ACTION_DURATION_MS = {
  craft: 1120,
  recycle: 960,
} as const;
