defmodule AdventureTimeApi.Leaderboards.Slots do
  @moduledoc "Creates immutable natural-local-day competition slots."

  import Ecto.Query

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Leaderboards.{Calendar, CompetitionSlot}
  alias AdventureTimeApi.Repo

  @spec get_or_create(User.t(), Date.t(), DateTime.t()) ::
          {:ok, CompetitionSlot.t()} | {:error, term()}
  def get_or_create(%User{} = user, %Date{} = date, now \\ DateTime.utc_now()) do
    case Repo.get_by(CompetitionSlot, user_id: user.id, local_date: date) do
      %CompetitionSlot{} = slot ->
        {:ok, slot}

      nil ->
        create(user, date, now)
    end
  end

  defp create(user, date, now) do
    timezone = user.timezone || "Europe/Paris"

    with {:ok, bounds} <- Calendar.slot(date, timezone) do
      status = slot_status(bounds, now)

      Repo.transaction(fn ->
        if status == :open do
          from(slot in CompetitionSlot,
            where: slot.user_id == ^user.id and slot.status == :open
          )
          |> Repo.update_all(set: [status: :closed, updated_at: now])
        end

        %CompetitionSlot{}
        |> CompetitionSlot.changeset(%{
          user_id: user.id,
          competition_week_key: bounds.competition_week_key,
          slot_number: Date.day_of_week(date, :monday),
          local_date: date,
          detected_timezone: timezone,
          effective_timezone: timezone,
          starts_at: bounds.starts_at,
          ends_at: bounds.ends_at,
          status: status
        })
        |> Repo.insert(
          on_conflict: :nothing,
          conflict_target: [:user_id, :competition_week_key, :local_date]
        )
        |> case do
          {:ok, _slot} ->
            Repo.get_by!(CompetitionSlot, user_id: user.id, local_date: date)

          {:error, reason} ->
            Repo.rollback(reason)
        end
      end)
    end
  end

  defp slot_status(bounds, now) do
    cond do
      DateTime.compare(now, bounds.starts_at) == :lt -> :scheduled
      DateTime.compare(now, bounds.ends_at) == :lt -> :open
      true -> :closed
    end
  end
end
