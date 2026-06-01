defmodule AdventureTimeApi.Quests.WordleDictionaryWordDefinition do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "wordle_dictionary_word_definitions" do
    field(:display_word, :string)
    field(:definition, :string)
    field(:part_of_speech, :string)
    field(:source_name, :string)
    field(:source_url, :string)
    field(:fetched_at, :utc_datetime_usec)

    belongs_to(:wordle_dictionary_word, AdventureTimeApi.Quests.WordleDictionaryWord,
      type: :binary_id
    )

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(definition, attrs) do
    definition
    |> cast(attrs, [
      :wordle_dictionary_word_id,
      :display_word,
      :definition,
      :part_of_speech,
      :source_name,
      :source_url,
      :fetched_at
    ])
    |> validate_required([
      :wordle_dictionary_word_id,
      :display_word,
      :definition,
      :source_name,
      :source_url,
      :fetched_at
    ])
    |> unique_constraint([:wordle_dictionary_word_id, :display_word],
      name: :wordle_dictionary_word_definitions_word_display_key
    )
  end
end
