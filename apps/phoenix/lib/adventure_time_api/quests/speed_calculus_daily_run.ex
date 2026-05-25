defmodule AdventureTimeApi.Quests.SpeedCalculusDailyRun do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "speed_calculus_daily_runs" do
    field(:user_id, :binary_id)
    field(:date, :date)
    field(:run_number, :integer)
    field(:seed, :string)
    field(:answers, {:array, :integer}, default: [])
    field(:status, :string, default: "in_progress")
    field(:score, :integer)
    field(:reward, :integer)
    field(:started_at, :utc_datetime)
    field(:finished_at, :utc_datetime)
    field(:pause_expires_at, :utc_datetime)
    field(:play_deadline_at, :utc_datetime)
    field(:manual_paused_at, :utc_datetime)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(run, attrs) do
    run
    |> cast(attrs, [
      :user_id,
      :date,
      :run_number,
      :seed,
      :answers,
      :status,
      :score,
      :reward,
      :started_at,
      :finished_at,
      :pause_expires_at,
      :play_deadline_at,
      :manual_paused_at
    ])
    |> validate_required([:user_id, :date, :run_number, :seed, :started_at, :play_deadline_at])
    |> validate_number(:run_number, greater_than_or_equal_to: 1, less_than_or_equal_to: 3)
    |> validate_inclusion(:status, ["in_progress", "completed", "abandoned"])
    |> unique_constraint([:user_id, :date, :run_number],
      name: :speed_calculus_daily_runs_user_id_date_run_number_key
    )
  end
end
