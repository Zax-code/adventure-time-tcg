defmodule AdventureTimeApi.Repo.Migrations.AddTimezoneToUsers do
  use Ecto.Migration

  def up do
    alter table(:users) do
      add :timezone, :string, null: false, default: "Europe/Paris"
    end
  end

  def down do
    alter table(:users) do
      remove :timezone
    end
  end
end
