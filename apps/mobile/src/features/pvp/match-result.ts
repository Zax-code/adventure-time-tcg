import type { PvpMatch } from "@adventure-time/api-client";

export type PvpMatchResultTone = "win" | "loss" | "draw";

export type PvpMatchResultView = {
  tone: PvpMatchResultTone;
  labelKey: string;
  badge: string;
};

export function getPvpMatchResultView(
  match: Pick<PvpMatch, "winnerId" | "completionReason">,
  currentUserId: string | null | undefined,
): PvpMatchResultView {
  if (match.winnerId == null || match.completionReason === "DRAW") {
    return { tone: "draw", labelKey: "pvp.draw", badge: "D" };
  }

  const won = currentUserId != null && match.winnerId === currentUserId;

  if (match.completionReason === "TIMEOUT") {
    return won
      ? { tone: "win", labelKey: "pvp.timeoutWin", badge: "W" }
      : { tone: "loss", labelKey: "pvp.timedOut", badge: "T" };
  }

  if (match.completionReason === "CONCEDE") {
    return won
      ? { tone: "win", labelKey: "pvp.concedeWin", badge: "W" }
      : { tone: "loss", labelKey: "pvp.conceded", badge: "C" };
  }

  return won
    ? { tone: "win", labelKey: "pvp.win", badge: "W" }
    : { tone: "loss", labelKey: "pvp.loss", badge: "L" };
}
