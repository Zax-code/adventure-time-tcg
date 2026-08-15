defmodule AdventureTimeApi.Leaderboards.DailyResult do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @type t :: %__MODULE__{}

  schema "leaderboard_daily_results" do
    field(:user_id, :binary_id)
    field(:board_id, :binary_id)
    field(:competition_slot_id, :binary_id)
    field(:competition_date, :date)
    field(:ranked_session_id, :binary_id)
    field(:source_kind, :string)
    field(:source_id, :binary_id)
    field(:raw_result_schema_version, :integer, default: 1)
    field(:raw_result, :map)
    field(:raw_numeric_value, :integer)
    field(:outcome, :string)
    field(:points_milli, :integer)
    field(:scoring_version_id, :binary_id)

    field(:result_status, Ecto.Enum,
      values: [:pending, :accepted, :rejected, :excluded, :snapshotted],
      default: :pending
    )

    field(:integrity_status, Ecto.Enum,
      values: [:pending, :accepted, :review, :rejected],
      default: :pending
    )

    field(:eligibility_status, Ecto.Enum,
      values: [:eligible, :ineligible, :moderated],
      default: :eligible
    )

    field(:active, :boolean, default: true)
    field(:provisional, :boolean, default: true)
    field(:submitted_at, :utc_datetime_usec)
    field(:accepted_at, :utc_datetime_usec)
    field(:supersedes_result_id, :binary_id)
    field(:excluded_reason, :string)
    field(:excluded_by_user_id, :binary_id)
    field(:excluded_at, :utc_datetime_usec)
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(result, attrs) do
    result
    |> cast(attrs, [
      :user_id,
      :board_id,
      :competition_slot_id,
      :competition_date,
      :ranked_session_id,
      :source_kind,
      :source_id,
      :raw_result_schema_version,
      :raw_result,
      :raw_numeric_value,
      :outcome,
      :points_milli,
      :scoring_version_id,
      :result_status,
      :integrity_status,
      :eligibility_status,
      :active,
      :provisional,
      :submitted_at,
      :accepted_at,
      :supersedes_result_id,
      :excluded_reason,
      :excluded_by_user_id,
      :excluded_at
    ])
    |> validate_required([
      :user_id,
      :board_id,
      :competition_slot_id,
      :competition_date,
      :source_kind,
      :source_id,
      :raw_result_schema_version,
      :raw_result,
      :scoring_version_id,
      :result_status,
      :integrity_status,
      :eligibility_status,
      :active,
      :provisional,
      :submitted_at
    ])
    |> validate_number(:raw_result_schema_version, greater_than: 0)
    |> validate_number(:points_milli,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: 1_000_000
    )
    |> unique_constraint([:user_id, :board_id, :competition_date],
      name: :leaderboard_daily_results_one_active_result
    )
    |> unique_constraint([:source_kind, :source_id, :board_id])
  end
end
