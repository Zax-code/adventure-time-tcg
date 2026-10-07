defmodule AdventureTimeApi.Repo.Migrations.AddCurrentPlayerIdToPvpMatches do
  use Ecto.Migration

  def change do
    alter table(:pvp_matches) do
      add(:current_player_id, :binary_id)
    end
  end
end
