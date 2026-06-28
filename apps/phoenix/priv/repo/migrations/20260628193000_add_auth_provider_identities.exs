defmodule AdventureTimeApi.Repo.Migrations.AddAuthProviderIdentities do
  use Ecto.Migration

  def change do
    create table(:auth_provider_identities, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:provider, :text, null: false)
      add(:provider_subject_hash, :text, null: false)
      add(:email, :citext)
      add(:display_name, :text)

      timestamps(type: :utc_datetime)
    end

    create(
      unique_index(:auth_provider_identities, [:provider, :provider_subject_hash],
        name: :auth_provider_identities_provider_subject_key
      )
    )

    create(
      index(:auth_provider_identities, [:user_id], name: :auth_provider_identities_user_id_idx)
    )
  end
end
