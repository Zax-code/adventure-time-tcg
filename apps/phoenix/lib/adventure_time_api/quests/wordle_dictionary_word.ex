defmodule AdventureTimeApi.Quests.WordleDictionaryWord do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "wordle_dictionary_words" do
    field(:locale, :string)
    field(:word, :string)
    field(:is_allowed_guess, :boolean, default: true)
    field(:is_solution_candidate, :boolean, default: true)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(word, attrs) do
    word
    |> cast(attrs, [:locale, :word, :is_allowed_guess, :is_solution_candidate])
    |> validate_required([:locale, :word])
    |> unique_constraint([:locale, :word], name: :wordle_dictionary_words_locale_word_key)
  end
end
