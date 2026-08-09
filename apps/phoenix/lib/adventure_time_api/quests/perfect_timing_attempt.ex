defmodule AdventureTimeApi.Quests.PerfectTimingAttempt do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @statuses ["started", "result", "discarded", "kept", "auto_finalized", "failed"]
  @stop_reasons ["manual", "navigation", "background", "server_recovery"]
  @directions ["early", "late", "exact"]
  @tiers ["perfect", "amazing", "great", "close", "miss"]

  schema "perfect_timing_attempts" do
    field(:user_id, :binary_id)
    field(:date, :date)
    field(:attempt_number, :integer)
    field(:target_ms, :integer)
    field(:status, :string, default: "started")
    field(:stop_reason, :string)
    field(:elapsed_ms, :integer)
    field(:deviation_ms, :integer)
    field(:direction, :string)
    field(:tier, :string)
    field(:reward, :integer, default: 0)
    field(:started_at, :utc_datetime_usec)
    field(:completed_at, :utc_datetime_usec)

    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  def start_changeset(attempt, attrs) do
    attempt
    |> cast(attrs, [:date, :attempt_number, :target_ms, :started_at])
    |> validate_required([:date, :attempt_number, :target_ms, :started_at])
    |> validate_number(:attempt_number, greater_than_or_equal_to: 1, less_than_or_equal_to: 3)
    |> validate_number(:target_ms, greater_than_or_equal_to: 3_000, less_than_or_equal_to: 10_000)
    |> validate_change(:target_ms, fn :target_ms, value ->
      if rem(value, 100) == 0, do: [], else: [target_ms: "must use 100 millisecond increments"]
    end)
    |> unique_constraint([:user_id, :date, :attempt_number],
      name: :perfect_timing_attempts_user_date_number_key
    )
  end

  def result_changeset(attempt, attrs) do
    attempt
    |> cast(attrs, [
      :status,
      :stop_reason,
      :elapsed_ms,
      :deviation_ms,
      :direction,
      :tier,
      :reward,
      :completed_at
    ])
    |> validate_required([
      :status,
      :stop_reason,
      :elapsed_ms,
      :deviation_ms,
      :direction,
      :tier,
      :reward,
      :completed_at
    ])
    |> validate_inclusion(:status, @statuses -- ["started"])
    |> validate_inclusion(:stop_reason, @stop_reasons)
    |> validate_inclusion(:direction, @directions)
    |> validate_inclusion(:tier, @tiers)
    |> validate_number(:elapsed_ms, greater_than_or_equal_to: 0)
    |> validate_number(:deviation_ms, greater_than_or_equal_to: 0)
    |> validate_number(:reward, greater_than_or_equal_to: 0, less_than_or_equal_to: 100)
  end

  def status_changeset(attempt, status) do
    attempt
    |> change(status: status)
    |> validate_inclusion(:status, @statuses)
  end
end
