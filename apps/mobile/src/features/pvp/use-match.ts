import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PvpAction, PvpEndTurnInput } from "@adventure-time/api-client";

import { apiClient } from "../../lib/api";
import { useSessionStore } from "../../stores/session-store";
import {
  getEventAmount,
  getEventTargetInstanceId,
  isCritEvent,
  isMissEvent,
} from "./event-payload";
import { deriveMyMatchView, type FloatingEvent, type MyMatchView } from "./types";

export function useMatch(matchId: string) {
  const queryClient = useQueryClient();
  const myUserId = useSessionStore((s) => s.user?.id ?? "");
  const logLengthRef = useRef(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pvp-match", matchId],
    queryFn: () => apiClient.pvpMatch(matchId),
    retry: 0,
    refetchInterval: (query) => (query.state.status === "error" ? false : 3000),
    enabled: Boolean(matchId),
  });

  const battleState = data?.battleState ?? null;
  const matchView: MyMatchView | null = battleState
    ? deriveMyMatchView(battleState, myUserId)
    : null;

  const prevLogLength = logLengthRef.current;
  const newEvents: FloatingEvent[] = [];
  if (battleState) {
    const logSlice = battleState.log.slice(prevLogLength);
    for (const event of logSlice) {
      if (event.type === "damage" || event.type === "crit") {
        const targetInstanceId = getEventTargetInstanceId(event) ?? "";
        const amount = getEventAmount(event) ?? 0;
        if (targetInstanceId) {
          newEvents.push({
            seq: event.seq,
            targetInstanceId,
            type: isMissEvent(event)
              ? "miss"
              : isCritEvent(event)
                ? "crit"
                : "damage",
            amount,
          });
        }
      } else if (event.type === "heal") {
        const targetInstanceId = getEventTargetInstanceId(event) ?? "";
        const amount = getEventAmount(event) ?? 0;
        if (targetInstanceId && amount > 0) {
          newEvents.push({
            seq: event.seq,
            targetInstanceId,
            type: "heal",
            amount,
          });
        }
      }
    }
    logLengthRef.current = battleState.log.length;
  }

  const actionMutation = useMutation({
    mutationFn: (action: PvpAction) => apiClient.actPvpMatch(matchId, action),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["pvp-match", matchId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pvp-match", matchId] });
    },
  });

  const endTurnMutation = useMutation({
    mutationFn: (input?: PvpEndTurnInput) => apiClient.endTurnPvpMatch(matchId, input),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["pvp-match", matchId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pvp-match", matchId] });
    },
  });

  const concedeMutation = useMutation({
    mutationFn: () => apiClient.concedePvpMatch(matchId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pvp-match", matchId] });
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
    newEvents,
    submitAction,
    submitEndTurn,
    concede,
  };
}
