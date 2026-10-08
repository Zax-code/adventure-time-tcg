import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  leaderboardIntegrityReasonValues,
  type AdminFlaggedLeaderboardResult,
  type LeaderboardCorrectionResponse,
  type LeaderboardIntegrityReason,
} from "@adventure-time/api-client";

import { Button, EmptyState, Field, FormStatus } from "../../components/ui";
import { getErrorMessage, webApiClient } from "../../lib/api";
import { ADMIN_QUERY_KEYS, formatAdminDate } from "./admin-data";
import {
  AdminDataState,
  AdminPageHeader,
  AdminSection,
  AdminStatus,
} from "./admin-common";

const REASON_LABELS: Record<LeaderboardIntegrityReason, string> = {
  suspicious_elapsed_ratio: "Suspicious time ratio",
  client_elapsed_exceeds_server_window: "Client time beyond server window",
  ranked_session_deadline_exceeded: "Submitted after the deadline",
  no_ranked_session: "No ranked session",
};

const MIN_REASON_LENGTH = 8;

function formatElapsed(ms: number | null) {
  if (ms == null) return "Not recorded";
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}

function statusTone(result: AdminFlaggedLeaderboardResult) {
  if (result.resultStatus === "excluded" || result.integrityStatus === "rejected") {
    return "rejected" as const;
  }
  return result.integrityStatus === "accepted" ? ("approved" as const) : ("pending" as const);
}

export function AdminLeaderboardIntegrityPage() {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<LeaderboardIntegrityReason>(
    "suspicious_elapsed_ratio",
  );
  const [chosenId, setChosenId] = useState<string>();
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<LeaderboardCorrectionResponse>();
  const queryKey = ADMIN_QUERY_KEYS.leaderboardIntegrity(reason);
  const {
    data,
    error: queryError,
    isPending: queryPending,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => webApiClient.adminFlaggedLeaderboardResults(reason),
  });
  const results = data?.results ?? [];
  const selected = results.find((result) => result.id === chosenId) ?? results[0];
  const trimmedNote = note.trim();
  const noteValid = trimmedNote.length >= MIN_REASON_LENGTH;

  const exclude = useMutation({
    mutationFn: (result: AdminFlaggedLeaderboardResult) =>
      webApiClient.excludeLeaderboardResult(result.id, { reason: trimmedNote }),
    onSuccess: async () => {
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard-integrity"] });
    },
  });
  const previewCorrection = useMutation({
    mutationFn: (result: AdminFlaggedLeaderboardResult) =>
      webApiClient.previewLeaderboardCorrection(result.snapshotId ?? "", {
        reason: trimmedNote,
        excludeUserIds: [],
        excludeDailyResultIds: [result.id],
      }),
    onSuccess: (response) => setPreview(response),
  });
  const confirmCorrection = useMutation({
    mutationFn: (pending: LeaderboardCorrectionResponse) =>
      webApiClient.confirmLeaderboardCorrection(pending.sourceSnapshotId, {
        previewHash: pending.previewHash,
        confirm: true,
      }),
    onSuccess: async () => {
      setPreview(undefined);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "leaderboard-integrity"] });
    },
  });

  const actionError =
    exclude.error ?? previewCorrection.error ?? confirmCorrection.error;
  const actionMessage = actionError
    ? getErrorMessage(actionError)
    : exclude.isSuccess
      ? "Result excluded from the live leaderboard."
      : confirmCorrection.isSuccess
        ? "Correction applied to the published snapshot."
        : undefined;

  function selectResult(id: string) {
    setChosenId(id);
    setPreview(undefined);
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Super-admin moderation"
        lede="Ranked Daily Numbers results keep the player's own timer for scoring. Server-timed sessions only flag results for review here; nothing is excluded automatically."
        title="Review leaderboard integrity."
      />
      <FormStatus
        message={actionMessage}
        success={exclude.isSuccess || confirmCorrection.isSuccess}
      />
      {queryPending || queryError ? (
        <AdminDataState
          error={queryError}
          loading={queryPending}
          onRetry={() => void refetch()}
        />
      ) : null}
      {data ? (
        <div className="admin-request-layout">
          <AdminSection
            action={
              <label>
                <span className="sr-only">Integrity reason</span>
                <select
                  onChange={(event) => {
                    setReason(event.currentTarget.value as LeaderboardIntegrityReason);
                    setChosenId(undefined);
                    setPreview(undefined);
                  }}
                  value={reason}
                >
                  {leaderboardIntegrityReasonValues.map((value) => (
                    <option key={value} value={value}>
                      {REASON_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
            }
            description={`${results.length} results from the last 14 days`}
            title="Flagged results"
          >
            {results.length ? (
              <div className="admin-request-list">
                {results.map((result) => (
                  <button
                    aria-pressed={result.id === selected?.id}
                    className="admin-request-row"
                    key={result.id}
                    onClick={() => selectResult(result.id)}
                    type="button"
                  >
                    <span className="admin-user-avatar">
                      {(result.displayName ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <h3>{result.displayName ?? "Deleted player"}</h3>
                      <p>
                        {result.boardKey} · {result.competitionDate}
                      </p>
                    </div>
                    <small>
                      {formatElapsed(result.clientElapsedMs)} /{" "}
                      {formatElapsed(result.serverElapsedMs)}
                    </small>
                    <AdminStatus tone={statusTone(result)}>
                      {result.resultStatus}
                    </AdminStatus>
                    <time dateTime={result.submittedAt ?? undefined}>
                      {formatAdminDate(result.submittedAt)}
                    </time>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                copy="No recent result carries this integrity reason."
                title="Nothing to review"
              />
            )}
          </AdminSection>
          <aside className="panel admin-request-detail">
            {selected ? (
              <>
                <span className="eyebrow">Result evidence</span>
                <h2>{selected.displayName ?? "Deleted player"}</h2>
                <dl className="admin-detail-list">
                  <div>
                    <dt>Board and day</dt>
                    <dd>
                      {selected.boardKey} · {selected.competitionDate}
                    </dd>
                  </div>
                  <div>
                    <dt>Client timer (scored)</dt>
                    <dd>{formatElapsed(selected.clientElapsedMs)}</dd>
                  </div>
                  <div>
                    <dt>Server window</dt>
                    <dd>{formatElapsed(selected.serverElapsedMs)}</dd>
                  </div>
                  <div>
                    <dt>Points</dt>
                    <dd>
                      {selected.pointsMilli == null
                        ? "Not scored"
                        : (selected.pointsMilli / 1000).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {selected.resultStatus} · integrity {selected.integrityStatus}
                    </dd>
                  </div>
                  <div>
                    <dt>Reason codes</dt>
                    <dd>{selected.integrityReasonCodes.join(", ") || "None"}</dd>
                  </div>
                </dl>
                {selected.resultStatus === "accepted" ||
                (selected.resultStatus === "snapshotted" && selected.snapshotId) ? (
                  <>
                    <Field
                      hint={`At least ${MIN_REASON_LENGTH} characters; recorded in the audit trail.`}
                      label="Moderation reason"
                    >
                      <textarea
                        aria-label="Moderation reason"
                        onChange={(event) => setNote(event.currentTarget.value)}
                        rows={3}
                        value={note}
                      />
                    </Field>
                    {selected.resultStatus === "accepted" ? (
                      <Button
                        busy={exclude.isPending}
                        disabled={!noteValid}
                        onClick={() => exclude.mutate(selected)}
                        tone="ghost"
                      >
                        Exclude result
                      </Button>
                    ) : preview && preview.sourceSnapshotId === selected.snapshotId ? (
                      <>
                        <p>
                          The published snapshot will be replaced by an audited
                          revision without this result. Rank changes:{" "}
                          {Object.keys(preview.rankDelta).length} players.
                        </p>
                        <Button
                          busy={confirmCorrection.isPending}
                          onClick={() => confirmCorrection.mutate(preview)}
                        >
                          Confirm correction
                        </Button>
                      </>
                    ) : (
                      <Button
                        busy={previewCorrection.isPending}
                        disabled={!noteValid}
                        onClick={() => previewCorrection.mutate(selected)}
                        tone="ghost"
                      >
                        Preview correction
                      </Button>
                    )}
                  </>
                ) : (
                  <p>This result is already out of the leaderboard.</p>
                )}
              </>
            ) : (
              <p>Select a result to review its evidence.</p>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
