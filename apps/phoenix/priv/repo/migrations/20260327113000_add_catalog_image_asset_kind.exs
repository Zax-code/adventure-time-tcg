defmodule AdventureTimeApi.Repo.Migrations.AddCatalogImageAssetKind do
  use Ecto.Migration

  def up do
    execute("ALTER TYPE image_kind ADD VALUE IF NOT EXISTS 'catalog'")
  end

  def down do
    raise "cannot remove enum value 'catalog' from image_kind"
  end
end
