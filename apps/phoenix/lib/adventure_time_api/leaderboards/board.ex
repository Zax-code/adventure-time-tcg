defmodule AdventureTimeApi.Leaderboards.Board do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @type t :: %__MODULE__{}

  schema "leaderboard_boards" do
    field(:key, :string)

    field(:quest_family, Ecto.Enum,
      values: [:overall, :steps, :daily_numbers, :wordle, :speed_calculus, :perfect_timing]
    )

    field(:mode, :string)
    field(:direction, Ecto.Enum, values: [:higher, :lower, :points])
    field(:board_kind, Ecto.Enum, values: [:source, :derived_family, :derived_overall])
    field(:derived_members, :map, default: %{})
    field(:enabled, :boolean, default: true)
    field(:prizes_enabled, :boolean, default: false)
    field(:display_order, :integer)
    field(:raw_result_kind, :string)
    field(:validation_policy, :map, default: %{})
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(board, attrs) do
    board
    |> cast(attrs, [
      :key,
      :quest_family,
      :mode,
      :direction,
      :board_kind,
      :derived_members,
      :enabled,
      :prizes_enabled,
      :display_order,
      :raw_result_kind,
      :validation_policy
    ])
    |> validate_required([
      :key,
      :quest_family,
      :mode,
      :direction,
      :board_kind,
      :display_order,
      :raw_result_kind
    ])
    |> validate_number(:display_order, greater_than: 0)
    |> unique_constraint(:key)
    |> unique_constraint([:quest_family, :mode])
  end
end
