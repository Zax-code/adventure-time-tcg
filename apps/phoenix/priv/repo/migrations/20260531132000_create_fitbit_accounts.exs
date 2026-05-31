defmodule AdventureTimeApi.Repo.Migrations.CreateFitbitAccounts do
  use Ecto.Migration

  def change do
    create table(:fitbit_accounts, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)

      add(:fitbit_user_id, :text, null: false)
      add(:access_token, :text, null: false)
      add(:refresh_token, :text, null: false)
      add(:token_expires_at, :utc_datetime, null: false)
      add(:scope, :text, null: false)
      add(:subscription_id, :text)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:fitbit_accounts, [:user_id], name: :fitbit_accounts_user_id_key))

    create(
      unique_index(:fitbit_accounts, [:fitbit_user_id], name: :fitbit_accounts_fitbit_user_id_key)
    )
  end
end
