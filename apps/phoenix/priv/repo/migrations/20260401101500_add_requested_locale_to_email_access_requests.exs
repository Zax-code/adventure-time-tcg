defmodule AdventureTimeApi.Repo.Migrations.AddRequestedLocaleToEmailAccessRequests do
  use Ecto.Migration

  def change do
    alter table(:email_access_requests) do
      add(:requested_locale, :locale, null: false, default: "en")
    end
  end
end
