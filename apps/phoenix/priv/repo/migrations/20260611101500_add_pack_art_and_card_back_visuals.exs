defmodule AdventureTimeApi.Repo.Migrations.AddPackArtAndCardBackVisuals do
  use Ecto.Migration

  def change do
    alter table(:packs) do
      add(
        :pack_art_asset_id,
        references(:image_assets, type: :binary_id, on_delete: :nilify_all)
      )
    end

    create(index(:packs, [:pack_art_asset_id], name: :packs_pack_art_asset_id_idx))

    create table(:card_back_visuals, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:theme_name, :string, null: false)
      add(:rarity_name, :string, null: false)

      add(
        :image_asset_id,
        references(:image_assets, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      index(:card_back_visuals, [:image_asset_id], name: :card_back_visuals_image_asset_id_idx)
    )

    create(
      unique_index(:card_back_visuals, [:theme_name, :rarity_name],
        name: :card_back_visuals_theme_rarity_key
      )
    )
  end
end
