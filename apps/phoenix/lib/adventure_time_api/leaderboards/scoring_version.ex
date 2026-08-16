defmodule AdventureTimeApi.Leaderboards.ScoringVersion do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leaderboard_scoring_versions" do
    field(:version, :string)
    field(:schema_version, :integer)
    field(:configuration, :map)
    field(:configuration_hash, :string)
    field(:effective_week_start, :date)
    field(:status, Ecto.Enum, values: [:draft, :scheduled, :active, :retired], default: :draft)
    field(:created_by_user_id, :binary_id)
    field(:activated_at, :utc_datetime_usec)
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(version, attrs) do
    version
    |> cast(attrs, [
      :version,
      :schema_version,
      :configuration,
      :configuration_hash,
      :effective_week_start,
      :status,
      :created_by_user_id,
      :activated_at
    ])
    |> validate_required([
      :version,
      :schema_version,
      :configuration,
      :configuration_hash,
      :effective_week_start,
      :status
    ])
    |> unique_constraint(:version)
    |> unique_constraint(:effective_week_start)
  end
end
