defmodule AdventureTimeApi.Repo.Migrations.AddCardGifts do
  use Ecto.Migration

  def up do
    execute(
      "CREATE TYPE card_gift_status AS ENUM ('pending', 'accepted', 'rejected')",
      "DROP TYPE card_gift_status"
    )

    create table(:card_gifts, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:card_id, references(:cards, type: :binary_id, on_delete: :restrict), null: false)

      add(:from_user_id, references(:users, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:to_user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:quantity, :integer, null: false, default: 1)
      add(:message, :text)
      add(:status, :card_gift_status, null: false, default: "pending")

      timestamps(type: :utc_datetime)
    end

    create(index(:card_gifts, [:to_user_id], name: :card_gifts_to_user_id_idx))
    create(index(:card_gifts, [:from_user_id], name: :card_gifts_from_user_id_idx))
    create(index(:card_gifts, [:status], name: :card_gifts_status_idx))
    create(constraint(:card_gifts, :card_gifts_quantity_positive, check: "quantity > 0"))
    create(constraint(:card_gifts, :card_gifts_not_self, check: "from_user_id <> to_user_id"))
  end

  def down do
    drop(table(:card_gifts))
    execute("DROP TYPE card_gift_status", "")
  end
end
