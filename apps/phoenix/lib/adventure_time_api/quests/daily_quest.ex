defmodule AdventureTimeApi.Quests.DailyQuest do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "daily_quests" do
    field(:user_id, :binary_id)
    field(:date, :date)
    field(:quest_type, :string)
    field(:target, :integer)
    field(:reward, :integer, default: 0)
    field(:progress, :integer, default: 0)
    field(:completed, :boolean, default: false)
    field(:claimed, :boolean, default: false)
    field(:completed_at, :utc_datetime)
    field(:claimed_at, :utc_datetime)
    field(:reset_by_user_id, :binary_id)

    timestamps(type: :utc_datetime)
  end

  def changeset(quest, attrs) do
    quest
    |> cast(attrs, [
      :user_id,
      :date,
      :quest_type,
      :target,
      :reward,
      :progress,
      :completed,
      :claimed,
      :completed_at,
      :claimed_at,
      :reset_by_user_id
    ])
    |> validate_required([:user_id, :date, :quest_type, :target])
    |> validate_number(:target, greater_than: 0)
    |> validate_number(:progress, greater_than_or_equal_to: 0)
    |> validate_number(:reward, greater_than_or_equal_to: 0)
    |> unique_constraint([:user_id, :date, :quest_type],
      name: :daily_quests_user_id_date_quest_type_key
    )
  end
end
