defmodule AdventureTimeApi.Repo.Migrations.AddDefinitionsToWordleDictionaryWords do
  use Ecto.Migration

  def change do
    alter table(:wordle_dictionary_words) do
      add :definition, :text
      add :definition_part_of_speech, :string
      add :definition_source_name, :string
      add :definition_source_url, :text
      add :definition_fetched_at, :utc_datetime_usec
    end
  end
end
