defmodule AdventureTimeApi.Leaderboards.ResultTelemetry do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leaderboard_result_telemetry" do
    field(:result_id, :binary_id)
    field(:board_id, :binary_id)
    field(:competition_date, :date)
    field(:scoring_version_id, :binary_id)
    field(:normalized_metrics, :map, default: %{})
    field(:source, :string)
    field(:platform, :string)
    field(:app_version, :string)
    field(:validity_reason_codes, {:array, :string}, default: [])
    field(:integrity_reason_codes, {:array, :string}, default: [])
    field(:session_metrics, :map, default: %{})
    field(:cohort, :map, default: %{})
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  def changeset(telemetry, attrs) do
    telemetry
    |> cast(attrs, [
      :result_id,
      :board_id,
      :competition_date,
      :scoring_version_id,
      :normalized_metrics,
      :source,
      :platform,
      :app_version,
      :validity_reason_codes,
      :integrity_reason_codes,
      :session_metrics,
      :cohort
    ])
    |> validate_required([:result_id, :board_id, :competition_date, :scoring_version_id])
    |> unique_constraint(:result_id)
  end
end
