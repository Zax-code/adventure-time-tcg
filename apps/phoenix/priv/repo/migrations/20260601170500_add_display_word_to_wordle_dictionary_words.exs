defmodule AdventureTimeApi.Repo.Migrations.AddDisplayWordToWordleDictionaryWords do
  use Ecto.Migration

  def change do
    alter table(:wordle_dictionary_words) do
      add :display_word, :string
    end
  end
end
