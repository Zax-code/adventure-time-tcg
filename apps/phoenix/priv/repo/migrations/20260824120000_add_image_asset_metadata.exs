defmodule AdventureTimeApi.Repo.Migrations.AddImageAssetMetadata do
  use Ecto.Migration

  def change do
    alter table(:image_assets) do
      add(:width, :integer)
      add(:height, :integer)
      add(:byte_size, :bigint)
      add(:content_hash, :string, size: 64)
    end

    create(
      constraint(:image_assets, :image_assets_width_positive, check: "width IS NULL OR width > 0")
    )

    create(
      constraint(:image_assets, :image_assets_height_positive,
        check: "height IS NULL OR height > 0"
      )
    )

    create(
      constraint(:image_assets, :image_assets_byte_size_positive,
        check: "byte_size IS NULL OR byte_size > 0"
      )
    )

    create(
      constraint(:image_assets, :image_assets_content_hash_sha256,
        check: "content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$'"
      )
    )
  end
end
