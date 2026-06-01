defmodule AdventureTimeApi.Repo.Migrations.AddWordleDictionaryWordDefinitions do
  use Ecto.Migration

  def change do
    create table(:wordle_dictionary_word_definitions, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(
        :wordle_dictionary_word_id,
        references(:wordle_dictionary_words, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:display_word, :string, null: false)
      add(:definition, :text, null: false)
      add(:part_of_speech, :string)
      add(:source_name, :string, null: false)
      add(:source_url, :string, null: false)
      add(:fetched_at, :utc_datetime_usec, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(
      unique_index(
        :wordle_dictionary_word_definitions,
        [:wordle_dictionary_word_id, :display_word],
        name: :wordle_dictionary_word_definitions_word_display_key
      )
    )

    create(
      index(:wordle_dictionary_word_definitions, [:wordle_dictionary_word_id],
        name: :wordle_dictionary_word_definitions_word_id_idx
      )
    )
  end
end
