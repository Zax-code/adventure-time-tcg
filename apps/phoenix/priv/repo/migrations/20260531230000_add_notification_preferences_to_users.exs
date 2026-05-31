defmodule AdventureTimeApi.Repo.Migrations.AddNotificationPreferencesToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add(:notify_daily_reset, :boolean, null: false, default: true)
      add(:notify_step_goal, :boolean, null: false, default: true)
      add(:notify_pvp_invite, :boolean, null: false, default: true)
      add(:notify_pvp_turn, :boolean, null: false, default: true)
      add(:notify_gift_received, :boolean, null: false, default: true)
    end
  end
end
