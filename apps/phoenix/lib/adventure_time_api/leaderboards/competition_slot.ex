defmodule AdventureTimeApi.Leaderboards.CompetitionSlot do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "leaderboard_competition_slots" do
    field(:user_id, :binary_id)
    field(:competition_week_key, :date)
    field(:slot_number, :integer)
    field(:local_date, :date)
    field(:detected_timezone, :string)
    field(:effective_timezone, :string)
    field(:starts_at, :utc_datetime_usec)
    field(:ends_at, :utc_datetime_usec)
    field(:status, Ecto.Enum, values: [:scheduled, :open, :closed, :void], default: :scheduled)
    field(:timezone_change_reason, :string)
    field(:metadata, :map, default: %{})
    timestamps(type: :utc_datetime_usec)
  end

  def changeset(slot, attrs) do
    changeset =
      slot
      |> cast(attrs, [
        :user_id,
        :competition_week_key,
        :slot_number,
        :local_date,
        :detected_timezone,
        :effective_timezone,
        :starts_at,
        :ends_at,
        :status,
        :timezone_change_reason,
        :metadata
      ])
      |> validate_required([
        :user_id,
        :competition_week_key,
        :slot_number,
        :local_date,
        :detected_timezone,
        :effective_timezone,
        :starts_at,
        :ends_at,
        :status
      ])
      |> validate_number(:slot_number, greater_than_or_equal_to: 1, less_than_or_equal_to: 7)

    starts_at = get_field(changeset, :starts_at)

    validate_change(changeset, :ends_at, fn :ends_at, ends_at ->
      if match?(%DateTime{}, starts_at) and DateTime.compare(starts_at, ends_at) != :lt do
        [ends_at: "must be after starts_at"]
      else
        []
      end
    end)
  end
end
