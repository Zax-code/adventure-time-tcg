defmodule AdventureTimeApi.Quests.WordleDictionaryWord do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "wordle_dictionary_words" do
    field(:locale, :string)
    field(:word, :string)
    field(:display_word, :string)
    field(:is_allowed_guess, :boolean, default: true)
    field(:is_solution_candidate, :boolean, default: true)
    field(:definition, :string)
    field(:definition_part_of_speech, :string)
    field(:definition_source_name, :string)
    field(:definition_source_url, :string)
    field(:definition_fetched_at, :utc_datetime_usec)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(word, attrs) do
    word
    |> cast(attrs, [
      :locale,
      :word,
      :display_word,
      :is_allowed_guess,
      :is_solution_candidate,
      :definition,
      :definition_part_of_speech,
      :definition_source_name,
      :definition_source_url,
      :definition_fetched_at
    ])
    |> validate_required([:locale, :word])
    |> unique_constraint([:locale, :word], name: :wordle_dictionary_words_locale_word_key)
  end
end
