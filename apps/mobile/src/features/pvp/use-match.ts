import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  PvpAction,
  PvpEndTurnInput,
  PvpMatch,
  PvpMatchDetailResponse,
} from "@adventure-time/api-client";

import { apiClient } from "../../lib/api";
import { useSessionStore } from "../../stores/session-store";
import { buildPvpVisualEvents } from "./animation-events";
import { deriveMyMatchView, type MyMatchView } from "./types";

type PvpMatchesResponse = {
  matches: PvpMatch[];
};

type PvpHistoryResponse = {
  matches: PvpMatch[];
  totalCount?: number;
  currentUserId?: string;
  stats?: {
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
  };
};

function getConcedeWinnerId(match: PvpMatch, concedingUserId: string) {
  if (match.inviterId === concedingUserId) {
    return match.inviteeId;
  }

  if (match.inviteeId === concedingUserId) {
    return match.inviterId;
  }

  return match.winnerId;
}

function toConcededMatch(match: PvpMatch, concedingUserId: string): PvpMatch {
  const concededMatch: PvpMatch = {
    ...match,
    status: "COMPLETED",
    winnerId: getConcedeWinnerId(match, concedingUserId),
    completionReason: "CONCEDE",
    hasReplayData: true,
    updatedAt: new Date().toISOString(),
  };

  delete concededMatch.turnExpiresAt;

  return concededMatch;
}

function upsertMatch(matches: PvpMatch[], match: PvpMatch) {
  return [match, ...matches.filter((entry) => entry.id !== match.id)];
}

export function useMatch(matchId: string) {
  const queryClient = useQueryClient();
  const myUserId = useSessionStore((s) => s.user?.id ?? "");
  const logLengthRef = useRef(0);
  const refreshedTerminalMatchRef = useRef<string | null>(null);
  const matchQueryKey = ["pvp-match", matchId] as const;

  const refreshPvpLobbyQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pvp-invites"] });
    queryClient.invalidateQueries({ queryKey: ["pvp-matches"] });
    queryClient.invalidateQueries({ queryKey: ["pvp-history"] });
    queryClient.invalidateQueries({ queryKey: ["pvp-spectate"] });
  }, [queryClient]);

  const { data, isLoading, isError } = useQuery({
    queryKey: matchQueryKey,
    queryFn: () => apiClient.pvpMatch(matchId),
    retry: 0,
    refetchInterval: (query) => {
      if (query.state.status === "error") {
        return false;
      }

      const status = query.state.data?.match.status;

      return status === "COMPLETED" || status === "DECLINED" || status === "EXPIRED"
        ? false
        : 3000;
    },
    enabled: Boolean(matchId),
  });

  const battleState = data?.battleState ?? null;
  const matchView: MyMatchView | null = battleState
    ? deriveMyMatchView(battleState, myUserId)
    : null;

  useEffect(() => {
    const match = data?.match;

    if (!match || match.status === "PENDING" || match.status === "IN_PROGRESS") {
      return;
    }

    const terminalMatchKey = `${match.id}:${match.status}:${match.updatedAt}`;

    if (refreshedTerminalMatchRef.current === terminalMatchKey) {
      return;
    }

    refreshedTerminalMatchRef.current = terminalMatchKey;
    refreshPvpLobbyQueries();
  }, [data?.match, refreshPvpLobbyQueries]);

  const prevLogLength = logLengthRef.current;
  let newEvents = buildPvpVisualEvents([]);
  if (battleState) {
    const logSlice = battleState.log.slice(prevLogLength);
    newEvents = buildPvpVisualEvents(logSlice);
    logLengthRef.current = battleState.log.length;
  }

  const actionMutation = useMutation({
    mutationFn: (action: PvpAction) => apiClient.actPvpMatch(matchId, action),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: matchQueryKey });
    },
    onSuccess: (result) => {
      queryClient.setQueryData<PvpMatchDetailResponse>(matchQueryKey, (current) => ({
        ...(current ?? {}),
        match: result.match,
        battleState: result.battleState,
      }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey });
      refreshPvpLobbyQueries();
    },
  });

  const endTurnMutation = useMutation({
    mutationFn: (input?: PvpEndTurnInput) => apiClient.endTurnPvpMatch(matchId, input),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: matchQueryKey });
    },
    onSuccess: (result) => {
      queryClient.setQueryData<PvpMatchDetailResponse>(matchQueryKey, (current) => ({
        ...(current ?? {}),
        match: result.match,
        battleState: result.battleState,
      }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey });
      refreshPvpLobbyQueries();
    },
  });

  const concedeMutation = useMutation({
    mutationFn: () => apiClient.concedePvpMatch(matchId),
    onSuccess: () => {
      const detailMatch =
        queryClient.getQueryData<PvpMatchDetailResponse>(matchQueryKey)?.match ??
        null;
      let cachedMatch = detailMatch;

      queryClient.setQueryData<PvpMatchesResponse>(
        ["pvp-matches"],
        (current) => {
          if (!current) {
            return current;
          }

          const activeMatch = current.matches.find(
            (match) => match.id === matchId,
          );
          cachedMatch = cachedMatch ?? activeMatch ?? null;

          return {
            ...current,
            matches: current.matches.filter((match) => match.id !== matchId),
          };
        },
      );

      if (!cachedMatch) {
        return;
      }

      const concededMatch = toConcededMatch(cachedMatch, myUserId);

      queryClient.setQueryData<PvpMatchDetailResponse>(
        matchQueryKey,
        (current) =>
          current
            ? {
                ...current,
                match: concededMatch,
                battleState: null,
              }
            : current,
      );
      queryClient.setQueryData<PvpHistoryResponse>(
        ["pvp-history"],
        (current) =>
          current
            ? {
                ...current,
                matches: upsertMatch(current.matches, concededMatch),
              }
            : current,
      );
      queryClient.setQueryData<PvpMatchesResponse>(
        ["pvp-spectate"],
        (current) =>
          current
            ? {
                ...current,
                matches: current.matches.filter((match) => match.id !== matchId),
              }
            : current,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: matchQueryKey });
      refreshPvpLobbyQueries();
    },
  });

  const submitAction = useCallback(
    (action: PvpAction) => actionMutation.mutate(action),
    [actionMutation],
  );

  const submitEndTurn = useCallback(
    (input?: PvpEndTurnInput) => endTurnMutation.mutate(input),
    [endTurnMutation],
  );

  const concede = useCallback(
    () => concedeMutation.mutate(),
    [concedeMutation],
  );

  return {
    matchView,
    isLoading: isLoading && !matchView,
    isError,
    rawMatch: data?.match ?? null,
    isActing: actionMutation.isPending || endTurnMutation.isPending,
    newEvents: newEvents.floatingEvents,
    unitAnimationEvents: newEvents.unitAnimationEvents,
    submitAction,
    submitEndTurn,
    concede,
  };
}
