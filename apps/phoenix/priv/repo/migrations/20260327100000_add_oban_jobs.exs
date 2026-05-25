defmodule AdventureTimeApi.Repo.Migrations.AddObanJobs do
  use Ecto.Migration

  def up do
    Oban.Migrations.up(version: 12)
  end

  def down do
    Oban.Migrations.down(version: 12)
  end
end
