export type PackAnimationData = {
  backgroundColor: string;
  cardCountLabel: string;
  color: string;
  guaranteedRarity?: string | null;
  name: string;
};

export type PackOpeningSequenceMode = "burst" | "charge" | "loading";

export type PackOpeningSequenceProps = {
  burstDurationMs?: number;
  mode: PackOpeningSequenceMode;
  pack: PackAnimationData;
};
