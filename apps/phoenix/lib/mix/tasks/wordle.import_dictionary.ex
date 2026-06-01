defmodule Mix.Tasks.Wordle.ImportDictionary do
  use Mix.Task

  alias AdventureTimeApi.Quests.WordleDictionaryImporter

  @shortdoc "Import a Wordle dictionary for a locale from repo-managed word lists"

  @impl Mix.Task
  def run(args) do
    Mix.Task.run("app.start")

    {opts, _rest, _invalid} =
      OptionParser.parse(args,
        strict: [
          locale: :string,
          allowed: :string,
          answers: :string
        ]
      )

    locale = opts[:locale] || "en"
    allowed_path = opts[:allowed] || default_allowed_path(locale)
    answers_path = opts[:answers] || default_answers_path(locale)

    case WordleDictionaryImporter.import_from_files(locale, allowed_path, answers_path) do
      {:ok, result} ->
        Mix.shell().info(
          "Imported #{result.allowed_guess_count} allowed guesses and #{result.solution_candidate_count} solution candidates for #{result.locale}."
        )

      {:error, :invalid_locale} ->
        Mix.raise("Unsupported locale #{inspect(locale)}. Expected one of: fr, en")

      {:error, {:file_not_found, path}} ->
        Mix.raise("Dictionary file not found: #{path}")
    end
  end

  defp default_allowed_path("en"),
    do: Path.expand("priv/repo/seed_data/wordle_en_allowed_guesses.txt", File.cwd!())

  defp default_allowed_path("fr"),
    do: Path.expand("priv/repo/seed_data/wordle_fr_allowed_guesses.txt", File.cwd!())

  defp default_allowed_path(locale),
    do: Path.expand("priv/repo/seed_data/wordle_#{locale}_allowed_guesses.txt", File.cwd!())

  defp default_answers_path("en"),
    do: Path.expand("priv/repo/seed_data/wordle_en_answers.txt", File.cwd!())

  defp default_answers_path("fr"),
    do: Path.expand("priv/repo/seed_data/wordle_fr_answers.txt", File.cwd!())

  defp default_answers_path(locale),
    do: Path.expand("priv/repo/seed_data/wordle_#{locale}_answers.txt", File.cwd!())
end
