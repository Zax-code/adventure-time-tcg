defmodule AdventureTimeApi.Repo.Migrations.RemovePackImageUrl do
  use Ecto.Migration

  def change do
    alter table(:packs) do
      remove(:image_url, :text)
    end
  end
end
