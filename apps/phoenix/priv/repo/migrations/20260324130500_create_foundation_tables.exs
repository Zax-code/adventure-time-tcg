defmodule AdventureTimeApi.Repo.Migrations.CreateFoundationTables do
  use Ecto.Migration

  def up do
    execute("CREATE EXTENSION IF NOT EXISTS citext", "DROP EXTENSION IF EXISTS citext")

    execute(
      "CREATE TYPE step_source AS ENUM ('device_health', 'fitbit')",
      "DROP TYPE step_source"
    )

    execute("CREATE TYPE locale AS ENUM ('en', 'fr')", "DROP TYPE locale")
    execute("CREATE TYPE image_kind AS ENUM ('card', 'profile')", "DROP TYPE image_kind")

    execute(
      "CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin')",
      "DROP TYPE user_role"
    )

    execute(
      "CREATE TYPE user_access_status AS ENUM ('pending', 'approved', 'rejected')",
      "DROP TYPE user_access_status"
    )

    create table(:users, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:email, :citext, null: false)
      add(:display_name, :string)
      add(:coins, :integer, null: false, default: 100)
      add(:dust, :integer, null: false, default: 0)
      add(:preferred_language, :locale, null: false, default: "en")
      add(:last_daily_claim, :utc_datetime)
      add(:avatar_asset_id, :binary_id)
      add(:role, :user_role, null: false, default: "user")
      add(:access_status, :user_access_status, null: false, default: "pending")
      add(:preferred_step_source, :step_source, null: false, default: "device_health")

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:users, [:email], name: :users_email_key))
    create(constraint(:users, :users_coins_nonnegative, check: "coins >= 0"))
    create(constraint(:users, :users_dust_nonnegative, check: "dust >= 0"))

    create table(:email_auth_credentials, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:password_hash, :text, null: false)
      add(:email_verified_at, :utc_datetime)

      timestamps(type: :utc_datetime)
    end

    create(
      unique_index(:email_auth_credentials, [:user_id], name: :email_auth_credentials_user_id_key)
    )

    create table(:auth_sessions, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:refresh_token_hash, :text, null: false)
      add(:user_agent, :text)
      add(:ip_address, :string)
      add(:expires_at, :utc_datetime, null: false)
      add(:revoked_at, :utc_datetime)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(index(:auth_sessions, [:user_id], name: :auth_sessions_user_id_idx))
    create(index(:auth_sessions, [:expires_at], name: :auth_sessions_expires_at_idx))

    create table(:rarities, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:name, :string, null: false)
      add(:drop_rate, :float, null: false)
      add(:color, :string, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(unique_index(:rarities, [:name], name: :rarities_name_key))
    create(constraint(:rarities, :rarities_drop_rate_positive, check: "drop_rate > 0"))

    create table(:image_assets, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:kind, :image_kind, null: false)
      add(:mime_type, :string, null: false)
      add(:object_key, :string)
      add(:placeholder_svg, :text)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(index(:image_assets, [:kind], name: :image_assets_kind_idx))

    alter table(:users) do
      modify(
        :avatar_asset_id,
        references(:image_assets, type: :binary_id, on_delete: :nilify_all)
      )
    end

    create table(:cards, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:name, :string, null: false)
      add(:character, :string, null: false)
      add(:description, :text, null: false)
      add(:hp, :integer, null: false)
      add(:attack, :integer, null: false)
      add(:defense, :integer, null: false)
      add(:speed, :integer, null: false, default: 40)
      add(:type, :string, null: false)
      add(:rarity_id, references(:rarities, type: :binary_id, on_delete: :restrict), null: false)
      add(:image_asset_id, references(:image_assets, type: :binary_id, on_delete: :nilify_all))
      add(:is_featured, :boolean, null: false, default: false)
      add(:is_archived, :boolean, null: false, default: false)

      timestamps(type: :utc_datetime)
    end

    create(index(:cards, [:rarity_id], name: :cards_rarity_id_idx))
    create(index(:cards, [:image_asset_id], name: :cards_image_asset_id_idx))
    create(index(:cards, [:is_featured], name: :cards_is_featured_idx))
    create(constraint(:cards, :cards_hp_positive, check: "hp > 0"))
    create(constraint(:cards, :cards_attack_nonnegative, check: "attack >= 0"))
    create(constraint(:cards, :cards_defense_nonnegative, check: "defense >= 0"))
    create(constraint(:cards, :cards_speed_positive, check: "speed > 0"))

    create table(:packs, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:name, :string, null: false)
      add(:description, :text, null: false)
      add(:card_count, :integer, null: false, default: 5)
      add(:cost, :integer, null: false, default: 100)
      add(:image_url, :text, null: false)
      add(:color, :string, null: false, default: "#EC4899")
      add(:is_active, :boolean, null: false, default: true)
      add(:guaranteed_rarity, :string)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(unique_index(:packs, [:name], name: :packs_name_key))
    create(constraint(:packs, :packs_card_count_positive, check: "card_count > 0"))
    create(constraint(:packs, :packs_cost_nonnegative, check: "cost >= 0"))

    create table(:owned_cards, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:card_id, references(:cards, type: :binary_id, on_delete: :restrict), null: false)
      add(:quantity, :integer, null: false, default: 1)
      add(:obtained_at, :utc_datetime, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(index(:owned_cards, [:user_id], name: :owned_cards_user_id_idx))

    create(
      unique_index(:owned_cards, [:user_id, :card_id], name: :owned_cards_user_id_card_id_key)
    )

    create(constraint(:owned_cards, :owned_cards_quantity_nonnegative, check: "quantity >= 0"))
  end

  def down do
    drop(table(:owned_cards))
    drop(table(:packs))
    drop(table(:cards))
    drop(table(:image_assets))
    drop(table(:rarities))
    drop(table(:auth_sessions))
    drop(table(:email_auth_credentials))
    drop(table(:users))

    execute("DROP TYPE user_access_status", "")
    execute("DROP TYPE user_role", "")
    execute("DROP TYPE image_kind", "")
    execute("DROP TYPE locale", "")
    execute("DROP TYPE step_source", "")
    execute("DROP EXTENSION IF EXISTS citext", "")
  end
end
