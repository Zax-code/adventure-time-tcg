defmodule AdventureTimeApi.Leaderboards.RankedSessions do
  @moduledoc """
  Server-observed timing evidence for ranked quest sessions.

  Daily Numbers scoring still uses the client's elapsed time, because the mobile
  timer pauses while the board is off screen. The session only bounds it: a client
  time longer than the server window (plus tolerance) or a submission after the slot
  deadline is rejected, and a client time far below a long server window is flagged
  for review without being rejected.
  """

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Leaderboards.{Board, RankedSession, Slots}
  alias AdventureTimeApi.Repo

  @client_elapsed_tolerance_ms 5_000
  @suspicious_ratio 0.2
  @suspicious_min_server_elapsed_ms 120_000

  @spec start_daily_numbers(User.t(), Date.t(), String.t(), DateTime.t()) ::
          {:ok, RankedSession.t()} | {:error, term()}
  def start_daily_numbers(%User{} = user, %Date{} = date, mode, now \\ DateTime.utc_now())
      when mode in ["1-5", "2-4", "3-3"] do
    with %Board{} = board <- Repo.get_by(Board, key: "daily-numbers/#{mode}", enabled: true),
         {:ok, slot} <- Slots.get_or_create(user, date, now) do
      Repo.transaction(fn ->
        from(session in RankedSession,
          where:
            session.user_id == ^user.id and session.board_id == ^board.id and
              session.status == :started and session.competition_date != ^date
        )
        |> Repo.update_all(
          set: [
            status: :expired,
            integrity_status: :rejected,
            integrity_reason_codes: ["competition_date_expired"],
            server_ended_at: now,
            updated_at: now
          ]
        )

        case Repo.one(
               from(session in RankedSession,
                 where:
                   session.user_id == ^user.id and session.board_id == ^board.id and
                     session.competition_date == ^date and session.status == :started,
                 lock: "FOR UPDATE"
               )
             ) do
          %RankedSession{} = session ->
            session

          nil ->
            session = %RankedSession{
              user_id: user.id,
              board_id: board.id,
              competition_slot_id: slot.id,
              competition_date: date,
              session_number: 1,
              status: :started,
              server_started_at: now,
              server_deadline_at: slot.ends_at,
              challenge_version: "#{Date.to_iso8601(date)}:#{mode}",
              nonce_hash: nonce_hash(),
              integrity_status: :pending,
              integrity_reason_codes: []
            }

            Repo.insert!(session,
              on_conflict: :nothing,
              conflict_target: [:user_id, :board_id, :competition_date, :session_number]
            )

            Repo.get_by!(RankedSession,
              user_id: user.id,
              board_id: board.id,
              competition_date: date,
              session_number: 1
            )
        end
      end)
    else
      nil -> {:error, :unknown_or_disabled_board}
      error -> error
    end
  end

  @spec settle_daily_numbers(
          Ecto.UUID.t(),
          Date.t(),
          String.t(),
          Ecto.UUID.t(),
          DateTime.t(),
          keyword()
        ) :: {:ok, RankedSession.t()} | {:error, atom()}
  def settle_daily_numbers(
        user_id,
        %Date{} = date,
        mode,
        source_id,
        now \\ DateTime.utc_now(),
        opts \\ []
      )
      when mode in ["1-5", "2-4", "3-3"] do
    board = Repo.get_by(Board, key: "daily-numbers/#{mode}", enabled: true)

    Repo.transaction(fn ->
      session =
        board &&
          Repo.one(
            from(session in RankedSession,
              where:
                session.user_id == ^user_id and session.board_id == ^board.id and
                  session.competition_date == ^date and session.status == :started,
              lock: "FOR UPDATE"
            )
          )

      case session do
        %RankedSession{} = session ->
          server_elapsed_ms =
            max(DateTime.diff(now, session.server_started_at, :millisecond), 0)

          client_elapsed_ms = Keyword.get(opts, :client_elapsed_ms)

          {integrity_status, reason_codes} =
            evaluate_elapsed(session, now, server_elapsed_ms, client_elapsed_ms)

          session
          |> Ecto.Changeset.change(%{
            source_kind: "daily_numbers_daily_attempt",
            source_id: source_id,
            status: :settled,
            server_ended_at: now,
            integrity_status: integrity_status,
            integrity_reason_codes: reason_codes,
            client_metadata:
              Map.merge(session.client_metadata || %{}, %{
                "serverElapsedMs" => server_elapsed_ms,
                "clientElapsedMs" => client_elapsed_ms
              })
          })
          |> Repo.update!()

        nil ->
          Repo.rollback(:ranked_session_missing)
      end
    end)
  end

  defp evaluate_elapsed(session, now, server_elapsed_ms, client_elapsed_ms) do
    cond do
      DateTime.compare(now, session.server_deadline_at) == :gt ->
        {:rejected, ["ranked_session_deadline_exceeded"]}

      is_integer(client_elapsed_ms) and
          client_elapsed_ms > server_elapsed_ms + @client_elapsed_tolerance_ms ->
        {:rejected, ["client_elapsed_exceeds_server_window"]}

      is_integer(client_elapsed_ms) and
        server_elapsed_ms > @suspicious_min_server_elapsed_ms and
          client_elapsed_ms < server_elapsed_ms * @suspicious_ratio ->
        {:accepted, ["server_observed_elapsed", "suspicious_elapsed_ratio"]}

      true ->
        {:accepted, ["server_observed_elapsed"]}
    end
  end

  @doc "The settled session that attests a Daily Numbers attempt, if any."
  @spec settled_for_daily_numbers_attempt(Ecto.UUID.t()) :: RankedSession.t() | nil
  def settled_for_daily_numbers_attempt(attempt_id) do
    Repo.one(
      from(session in RankedSession,
        where:
          session.source_kind == "daily_numbers_daily_attempt" and
            session.source_id == ^attempt_id and session.status == :settled,
        limit: 1
      )
    )
  end

  defp nonce_hash do
    random_bytes = :crypto.strong_rand_bytes(32)

    :crypto.hash(:sha256, random_bytes)
    |> Base.encode16(case: :lower)
  end
end
