defmodule AdventureTimeApi.Quests.WordleDictionaryImporter do
  @moduledoc false

  import Ecto.Query, only: [from: 2]

  alias AdventureTimeApi.Quests.{WordleDictionaryWord, WordleEngine}
  alias AdventureTimeApi.Repo

  @chunk_size 500

  def import_from_files(locale, allowed_path, answers_path) when is_binary(locale) do
    locale = String.downcase(String.trim(locale))

    if locale not in ["fr", "en"] do
      {:error, :invalid_locale}
    else
      with {:ok, allowed_words} <- load_words(allowed_path),
           {:ok, answer_words} <- load_words(answers_path) do
        allowed_set = MapSet.new(allowed_words)
        answer_set = MapSet.new(answer_words)

        final_allowed_words =
          MapSet.union(allowed_set, answer_set) |> MapSet.to_list() |> Enum.sort()

        final_answer_set = answer_set
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        rows =
          Enum.map(final_allowed_words, fn word ->
            %{
              id: Ecto.UUID.generate(),
              locale: locale,
              word: word,
              is_allowed_guess: true,
              is_solution_candidate: MapSet.member?(final_answer_set, word),
              inserted_at: now
            }
          end)

        Repo.transaction(fn ->
          Repo.delete_all(from(w in WordleDictionaryWord, where: w.locale == ^locale))

          rows
          |> Enum.chunk_every(@chunk_size)
          |> Enum.each(fn chunk ->
            Repo.insert_all(WordleDictionaryWord, chunk)
          end)
        end)

        :persistent_term.erase({:wordle_candidates, locale})
        :persistent_term.erase({:wordle_words_set, locale})

        {:ok,
         %{
           locale: locale,
           allowed_guess_count: length(final_allowed_words),
           solution_candidate_count: MapSet.size(final_answer_set)
         }}
      end
    end
  end

  defp load_words(path) do
    if File.exists?(path) do
      words =
        path
        |> File.stream!()
        |> Stream.map(&String.trim/1)
        |> Stream.reject(&(&1 == ""))
        |> Stream.filter(&WordleEngine.letter_only_source_word?/1)
        |> Stream.map(&WordleEngine.normalize/1)
        |> Stream.filter(&WordleEngine.valid_length_and_format?/1)
        |> Enum.uniq()
        |> Enum.sort()

      {:ok, words}
    else
      {:error, {:file_not_found, path}}
    end
  end
end
