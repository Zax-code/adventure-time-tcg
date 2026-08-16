defmodule AdventureTimeApi.Repo.Migrations.AddAccessAssessmentPseudonyms do
  use Ecto.Migration

  def change do
    alter table(:access_request_assessments) do
      add(:identity_provider_pseudonym, :text)
      add(:installation_provider_pseudonym, :text)
      add(:pseudonym_version, :text)
    end
  end
end
