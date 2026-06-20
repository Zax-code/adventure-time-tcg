defmodule Mix.Tasks.Wordle.ImportDefinitions do
  use Mix.Task

  alias AdventureTimeApi.Quests.WordleDefinitionImporter

  @shortdoc "Import Wordle definitions into the DB from offline dictionary datasets"

  @impl Mix.Task
  def run(args) do
    Mix.Task.run("app.start")

    {opts, _rest, _invalid} =
      OptionParser.parse(args,
        strict: [
          locale: :string,
          scope: :string,
          fr_dbnary: :string,
          fr_wiktextract: :string,
          fr_word_list: :string,
          en_oewn: :string,
          en_wiktextract: :string,
          snapshot: :string,
          refresh_sources: :boolean
        ]
      )

    opts = maybe_use_default_snapshot(opts)

    case WordleDefinitionImporter.import(opts) do
      {:ok, results} ->
        Enum.each(results, fn result ->
          missing_text =
            case result.missing_words do
              [] -> "0 missing"
              words -> "#{length(words)} missing (#{Enum.join(words, ", ")})"
            end

          Mix.shell().info(
            "[#{result.locale}] updated #{result.updated_count}/#{result.target_count} rows, matched #{result.matched_count}, #{missing_text}"
          )
        end)

      {:error, :invalid_locale} ->
        Mix.raise("Unsupported locale. Expected one of: fr, en, all")

      {:error, :invalid_scope} ->
        Mix.raise("Unsupported scope. Expected one of: solutions, all")

      {:error, {:file_not_found, path}} ->
        Mix.raise("Source file not found: #{path}")

      {:error, {:download_failed, source, reason}} ->
        Mix.raise("Failed to download #{source}: #{inspect(reason)}")
    end
  end

  defp maybe_use_default_snapshot(opts) do
    cond do
      opts[:snapshot] ->
        opts

      opts[:refresh_sources] ->
        opts

      File.exists?(default_snapshot_path()) ->
        Keyword.put(opts, :snapshot, default_snapshot_path())

      true ->
        opts
    end
  end

  defp default_snapshot_path do
    Path.expand("priv/repo/seed_data/wordle_definitions_snapshot.jsonl", File.cwd!())
  end
end
