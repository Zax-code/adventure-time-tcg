defmodule AdventureTimeApi.Leaderboards.RankedSessions do
  @moduledoc "Server-observed timing evidence for ranked quest sessions."

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Leaderboards.{Board, RankedSession, Slots}
  alias AdventureTimeApi.Repo

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

  @spec settle_daily_numbers(Ecto.UUID.t(), Date.t(), String.t(), Ecto.UUID.t(), DateTime.t()) ::
          {:ok, RankedSession.t()} | {:error, atom()}
  def settle_daily_numbers(user_id, %Date{} = date, mode, source_id, now \\ DateTime.utc_now())
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
          integrity_status =
            if DateTime.compare(now, session.server_deadline_at) == :gt,
              do: :rejected,
              else: :accepted

          reason_codes =
            if integrity_status == :accepted,
              do: ["server_observed_elapsed"],
              else: ["ranked_session_deadline_exceeded"]

          session
          |> Ecto.Changeset.change(%{
            source_kind: "daily_numbers_daily_attempt",
            source_id: source_id,
            status: :settled,
            server_ended_at: now,
            integrity_status: integrity_status,
            integrity_reason_codes: reason_codes
          })
          |> Repo.update!()

        nil ->
          Repo.rollback(:ranked_session_missing)
      end
    end)
  end

  defp nonce_hash do
    random_bytes = :crypto.strong_rand_bytes(32)

    :crypto.hash(:sha256, random_bytes)
    |> Base.encode16(case: :lower)
  end
end
