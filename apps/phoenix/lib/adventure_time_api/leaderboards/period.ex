defmodule AdventureTimeApi.Leaderboards.Period do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leaderboard_periods" do
    field(:period_type, Ecto.Enum, values: [:day, :week])
    field(:competition_timezone, :string, default: "global")
    field(:starts_at, :utc_datetime_usec)
    field(:ends_at, :utc_datetime_usec)
    field(:closes_at, :utc_datetime_usec)
    field(:competition_date, :date)
    field(:week_start, :date)

    field(:status, Ecto.Enum,
      values: [:scheduled, :open, :closing, :closed, :corrected],
      default: :scheduled
    )

    field(:origin, Ecto.Enum, values: [:verified, :legacy_unverified], default: :verified)
    field(:prizes_allowed, :boolean, default: false)
    field(:scoring_version_id, :binary_id)
    field(:launch_partial, :boolean, default: false)
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(period, attrs) do
    period
    |> cast(attrs, [
      :period_type,
      :competition_timezone,
      :starts_at,
      :ends_at,
      :closes_at,
      :competition_date,
      :week_start,
      :status,
      :origin,
      :prizes_allowed,
      :scoring_version_id,
      :launch_partial
    ])
    |> validate_required([
      :period_type,
      :competition_timezone,
      :starts_at,
      :ends_at,
      :closes_at,
      :status,
      :origin,
      :prizes_allowed,
      :scoring_version_id,
      :launch_partial
    ])
    |> unique_constraint([:period_type, :starts_at])
  end
end
