defmodule AdventureTimeApi.Repo.Migrations.AddExpiryAndRemoveLegacyPvpState do
  use Ecto.Migration

  def up do
    alter table(:pvp_matches) do
      add :expires_at, :utc_datetime
      remove :state
    end

    drop constraint(:pvp_matches, :pvp_matches_status_valid)

    create constraint(:pvp_matches, :pvp_matches_status_valid,
             check: "status IN ('pending', 'in_progress', 'completed', 'declined', 'expired')"
           )

    create index(:pvp_matches, [:status, :expires_at], name: :pvp_matches_status_expires_at_idx)

    execute(
      "ALTER TYPE card_gift_status ADD VALUE IF NOT EXISTS 'expired'",
      ""
    )

    alter table(:card_gifts) do
      add :expires_at, :utc_datetime
    end

    create index(:card_gifts, [:status, :expires_at], name: :card_gifts_status_expires_at_idx)
  end

  def down do
    drop index(:card_gifts, [:status, :expires_at], name: :card_gifts_status_expires_at_idx)

    alter table(:card_gifts) do
      remove :expires_at
    end

    drop index(:pvp_matches, [:status, :expires_at], name: :pvp_matches_status_expires_at_idx)
    drop constraint(:pvp_matches, :pvp_matches_status_valid)

    create constraint(:pvp_matches, :pvp_matches_status_valid,
             check: "status IN ('pending', 'in_progress', 'completed', 'declined')"
           )

    alter table(:pvp_matches) do
      add :state, :map
      remove :expires_at
    end

    execute(
      """
      CREATE TYPE card_gift_status_old AS ENUM ('pending', 'accepted', 'rejected');

      ALTER TABLE card_gifts
      ALTER COLUMN status TYPE card_gift_status_old
      USING status::text::card_gift_status_old;

      DROP TYPE card_gift_status;
      ALTER TYPE card_gift_status_old RENAME TO card_gift_status;
      """,
      "ALTER TYPE card_gift_status ADD VALUE IF NOT EXISTS 'expired'"
    )
  end
end
