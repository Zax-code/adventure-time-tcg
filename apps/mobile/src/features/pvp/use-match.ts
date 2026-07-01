import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  PvpAction,
  PvpEndTurnInput,
  PvpMatch,
  PvpMatchDetailResponse,
} from "@adventure-time/api-client";

import { apiClient } from "../../lib/api";
import { useSessionStore } from "../../stores/session-store";
import {
  buildLatestTurnPvpVisualEvents,
  type PvpVisualEvents,
} from "./animation-events";
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

const EMPTY_VISUAL_EVENTS: PvpVisualEvents = {
  floatingEvents: [],
  unitAnimationEvents: [],
};
const VISUAL_EVENTS_CLEAR_BUFFER_MS = 1400;

type VisualEventsState = {
  matchId: string;
  events: PvpVisualEvents;
};

function hasVisualEvents(events: PvpVisualEvents) {
  return (
    events.floatingEvents.length > 0 || events.unitAnimationEvents.length > 0
  );
}

function getMaxVisualDelayMs(events: PvpVisualEvents) {
  const delays = [
    ...events.floatingEvents.map((event) => event.delayMs ?? 0),
    ...events.unitAnimationEvents.map((event) => event.delayMs ?? 0),
  ];

  return Math.max(0, ...delays);
}

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
  const hasSyncedLogRef = useRef(false);
  const syncedMatchIdRef = useRef<string | null>(null);
  const refreshedTerminalMatchRef = useRef<string | null>(null);
  const [visualEventsState, setVisualEventsState] =
    useState<VisualEventsState | null>(null);
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
  const visualEvents =
    battleState && visualEventsState?.matchId === matchId
      ? visualEventsState.events
      : EMPTY_VISUAL_EVENTS;

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

  useEffect(() => {
    if (syncedMatchIdRef.current !== matchId) {
      syncedMatchIdRef.current = matchId;
      logLengthRef.current = 0;
      hasSyncedLogRef.current = false;
    }

    if (!battleState) {
      return;
    }

    const prevLogLength = hasSyncedLogRef.current ? logLengthRef.current : 0;
    const logSlice = hasSyncedLogRef.current
      ? battleState.log.slice(prevLogLength)
      : battleState.log;

    logLengthRef.current = battleState.log.length;
    hasSyncedLogRef.current = true;

    if (logSlice.length === 0) {
      return;
    }

    const nextVisualEvents = buildLatestTurnPvpVisualEvents(logSlice);
    if (hasVisualEvents(nextVisualEvents)) {
      setVisualEventsState({ matchId, events: nextVisualEvents });
    }
  }, [battleState, matchId]);

  useEffect(() => {
    if (!visualEventsState || !hasVisualEvents(visualEventsState.events)) {
      return;
    }

    const timeoutId = setTimeout(
      () => {
        setVisualEventsState((current) =>
          current === visualEventsState
            ? { ...visualEventsState, events: EMPTY_VISUAL_EVENTS }
            : current,
        );
      },
      getMaxVisualDelayMs(visualEventsState.events) +
        VISUAL_EVENTS_CLEAR_BUFFER_MS,
    );

    return () => clearTimeout(timeoutId);
  }, [visualEventsState]);

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
    newEvents: visualEvents.floatingEvents,
    unitAnimationEvents: visualEvents.unitAnimationEvents,
    submitAction,
    submitEndTurn,
    concede,
  };
}
