defmodule AdventureTimeApi.Quests.WordleDefinitionImporter do
  @moduledoc false

  import Ecto.Query, only: [from: 2]

  alias AdventureTimeApi.Quests.{
    WordleDictionaryWord,
    WordleDictionaryWordDefinition,
    WordleEngine
  }

  alias AdventureTimeApi.Repo

  @supported_locales ["fr", "en"]
  @supported_scopes ["solutions", "all"]

  @fr_source_name "DBnary / Wiktionnaire"
  @fr_wiktextract_source_name "Wiktextract / Wiktionnaire"
  @en_oewn_source_name "Open English WordNet"
  @en_wiktextract_source_name "Wiktextract / English Wiktionary"

  @default_fr_dbnary_url "https://kaiko.getalp.org/static/ontolex/latest/fr_dbnary_ontolex.ttl.bz2"
  @default_wiktextract_url "https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz"
  @default_en_oewn_url "https://en-word.net/static/english-wordnet-2025-json.zip"
  @default_en_wiktextract_url @default_wiktextract_url

  @default_fr_word_list_candidates [
    "/home/zax/adventure-time-tcg-pwa/wordle-french-word-list.txt",
    "~/adventure-time-tcg-pwa/wordle-french-word-list.txt",
    "~/Develop/adventure-time-tcg-pwa/wordle-french-word-list.txt"
  ]

  @fr_pos_labels %{
    "-adj-" => "Adjectif",
    "-adv-" => "Adverbe",
    "-conj-" => "Conjonction",
    "-det-" => "Determinant",
    "-interj-" => "Interjection",
    "-name-" => "Nom propre",
    "-nom-" => "Nom commun",
    "-num-" => "Numeral",
    "-onoma-" => "Onomatopee",
    "-post-" => "Postposition",
    "-pref-" => "Prefixe",
    "-prep-" => "Preposition",
    "-pronom-" => "Pronom",
    "-verb-" => "Verbe"
  }

  @fr_lexinfo_pos_labels %{
    "adjective" => "Adjectif",
    "adverb" => "Adverbe",
    "conjunction" => "Conjonction",
    "determiner" => "Determinant",
    "interjection" => "Interjection",
    "noun" => "Nom commun",
    "numeral" => "Numeral",
    "onomatopoeia" => "Onomatopee",
    "postposition" => "Postposition",
    "prefix" => "Prefixe",
    "preposition" => "Preposition",
    "pronoun" => "Pronom",
    "properNoun" => "Nom propre",
    "verb" => "Verbe"
  }

  @en_pos_labels %{
    "n" => "Noun",
    "v" => "Verb",
    "a" => "Adjective",
    "s" => "Adjective",
    "r" => "Adverb"
  }

  @ttl_escape_replacements [
    {"\\\\", "\\"},
    {"\\\"", "\""},
    {"\\t", "\t"},
    {"\\n", "\n"},
    {"\\r", "\r"}
  ]

  @doc false
  def default_sources do
    %{
      fr_dbnary: @default_fr_dbnary_url,
      fr_wiktextract: @default_wiktextract_url,
      fr_word_list: default_french_word_list_source(),
      en_oewn: @default_en_oewn_url,
      en_wiktextract: @default_en_wiktextract_url
    }
  end

  def import(opts \\ []) do
    with {:ok, locales} <- normalize_locales(opts[:locale] || "all"),
         {:ok, scope} <- normalize_scope(opts[:scope] || "solutions") do
      temp_dir =
        Path.join(System.tmp_dir!(), "wordle-definition-import-#{System.system_time(:second)}")

      File.mkdir_p!(temp_dir)

      try do
        Enum.reduce_while(locales, {:ok, []}, fn locale, {:ok, results} ->
          case import_locale(locale, scope, opts, temp_dir) do
            {:error, _reason} = error -> {:halt, error}
            result -> {:cont, {:ok, results ++ [result]}}
          end
        end)
      after
        File.rm_rf(temp_dir)
      end
    end
  end

  defp import_locale("fr", scope, opts, temp_dir) do
    target_words = target_words("fr", scope)
    display_variants_by_word = load_french_display_variants(target_words, opts)
    source = opts[:fr_dbnary] || @default_fr_dbnary_url

    with {:ok, source_path} <- ensure_source_file(source, temp_dir, "fr_dbnary_ontolex.ttl.bz2") do
      dbnary_definitions =
        source_path
        |> decompressed_line_stream()
        |> load_french_definitions_from_lines(target_words, display_variants_by_word)

      missing_words =
        MapSet.difference(MapSet.new(target_words), Map.keys(dbnary_definitions) |> MapSet.new())
        |> MapSet.to_list()
        |> Enum.sort()

      wiktextract_definitions =
        if missing_words == [] do
          %{}
        else
          wiktextract_source = opts[:fr_wiktextract] || @default_wiktextract_url

          with {:ok, wiktextract_path} <-
                 ensure_source_file(wiktextract_source, temp_dir, "raw-wiktextract-data.jsonl.gz") do
            wiktextract_path
            |> decompressed_line_stream()
            |> load_french_wiktextract_from_lines(missing_words, display_variants_by_word)
          end
        end

      definitions =
        case wiktextract_definitions do
          %{} = fallback_definitions ->
            merge_word_variant_maps(dbnary_definitions, fallback_definitions)

          {:error, _reason} = error ->
            error
        end

      case definitions do
        %{} = resolved_definitions ->
          build_result(
            "fr",
            target_words,
            resolved_definitions,
            persist_definitions("fr", resolved_definitions, display_variants_by_word)
          )

        {:error, _reason} = error ->
          error
      end
    end
  end

  defp import_locale("en", scope, opts, temp_dir) do
    target_words = target_words("en", scope)

    oewn_source = opts[:en_oewn] || @default_en_oewn_url

    with {:ok, oewn_zip_path} <- ensure_source_file(oewn_source, temp_dir, "english-wordnet.zip") do
      oewn_extract_dir = Path.join(temp_dir, "oewn")
      extract_zip!(oewn_zip_path, oewn_extract_dir)

      oewn_definitions = load_english_oewn_from_dir(oewn_extract_dir, target_words)

      missing_words =
        MapSet.difference(MapSet.new(target_words), Map.keys(oewn_definitions) |> MapSet.new())
        |> MapSet.to_list()
        |> Enum.sort()

      wiktextract_definitions =
        if missing_words == [] do
          %{}
        else
          wiktextract_source = opts[:en_wiktextract] || @default_en_wiktextract_url

          with {:ok, wiktextract_path} <-
                 ensure_source_file(wiktextract_source, temp_dir, "raw-wiktextract-data.jsonl.gz") do
            wiktextract_path
            |> decompressed_line_stream()
            |> load_english_wiktextract_from_lines(missing_words)
          end
        end

      definitions =
        case wiktextract_definitions do
          %{} = fallback_definitions ->
            merge_word_variant_maps(oewn_definitions, fallback_definitions)

          {:error, _reason} = error ->
            error
        end

      case definitions do
        %{} = resolved_definitions ->
          build_result(
            "en",
            target_words,
            resolved_definitions,
            persist_definitions("en", resolved_definitions)
          )

        {:error, _reason} = error ->
          error
      end
    end
  end

  defp build_result(locale, target_words, definitions, updated_count) do
    matched_words = Map.keys(definitions) |> MapSet.new()
    target_word_set = MapSet.new(target_words)

    missing_words =
      MapSet.difference(target_word_set, matched_words) |> MapSet.to_list() |> Enum.sort()

    %{
      locale: locale,
      target_count: length(target_words),
      updated_count: updated_count,
      matched_count: map_size(definitions),
      missing_words: missing_words
    }
  end

  defp target_words(locale, scope) do
    base_query = from(w in WordleDictionaryWord, where: w.locale == ^locale)

    scoped_query =
      case scope do
        "solutions" -> from(w in base_query, where: w.is_solution_candidate == true)
        "all" -> base_query
      end

    scoped_query
    |> then(&from(w in &1, select: w.word))
    |> Repo.all()
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp persist_definitions(locale, definitions_by_word, display_variants_by_word \\ %{}) do
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)
    words = Map.keys(definitions_by_word)

    Repo.transaction(fn ->
      word_rows =
        from(
          w in WordleDictionaryWord,
          where: w.locale == ^locale and w.word in ^words,
          select: {w.word, w.id}
        )
        |> Repo.all()
        |> Map.new()

      Enum.reduce(definitions_by_word, 0, fn {word, variants}, updated_count ->
        case Map.get(word_rows, word) do
          nil ->
            updated_count

          word_id ->
            resolved_variants =
              display_variants_by_word
              |> Map.get(word, MapSet.new())
              |> normalize_display_variant_set()
              |> then(&prepare_variants(locale, word, variants, &1, now))

            from(d in WordleDictionaryWordDefinition,
              where: d.wordle_dictionary_word_id == ^word_id
            )
            |> Repo.delete_all()

            if resolved_variants != [] do
              Repo.insert_all(
                WordleDictionaryWordDefinition,
                Enum.map(resolved_variants, fn variant ->
                  %{
                    id: Ecto.UUID.generate(),
                    wordle_dictionary_word_id: word_id,
                    display_word: variant.display_word,
                    definition: variant.definition,
                    part_of_speech: variant.part_of_speech,
                    source_name: variant.source_name,
                    source_url: variant.source_url,
                    fetched_at: now,
                    inserted_at: now
                  }
                end)
              )

              primary_variant = List.first(resolved_variants)

              from(
                w in WordleDictionaryWord,
                where: w.id == ^word_id
              )
              |> Repo.update_all(
                set: [
                  display_word: primary_variant.display_word,
                  definition: primary_variant.definition,
                  definition_part_of_speech: primary_variant.part_of_speech,
                  definition_source_name: primary_variant.source_name,
                  definition_source_url: primary_variant.source_url,
                  definition_fetched_at: now
                ]
              )
            end

            updated_count + 1
        end
      end)
    end)
    |> case do
      {:ok, updated_count} -> updated_count
      {:error, reason} -> raise "Failed to persist Wordle definitions: #{inspect(reason)}"
    end
  end

  @doc false
  def load_french_definitions_from_lines(lines, target_words, display_variants_by_word \\ %{}) do
    normalized_targets = target_words |> Enum.map(&WordleEngine.normalize/1) |> MapSet.new()

    initial_state = %{
      current_subject: nil,
      targets: normalized_targets,
      pending_entries: %{},
      form_to_entry: %{},
      relevant_entries: %{},
      sense_to_entry: %{}
    }

    final_state =
      Enum.reduce(lines, initial_state, fn raw_line, state ->
        line = String.trim_trailing(raw_line, "\r")
        current_subject = extract_subject(line) || state.current_subject

        state
        |> Map.put(:current_subject, current_subject)
        |> collect_pending_entry(current_subject, line)
        |> collect_written_rep(current_subject, line)
        |> collect_definition(current_subject, line)
      end)

    Enum.reduce(final_state.relevant_entries, %{}, fn {_entry_subject, entry}, acc ->
      if is_binary(entry.word) and is_binary(entry.definition) and entry.definition != "" do
        put_word_variant(
          acc,
          entry.word,
          %{
            display_word: resolve_french_display_word(entry, display_variants_by_word),
            definition: entry.definition,
            part_of_speech: entry.part_of_speech,
            source_name: @fr_source_name,
            source_url: french_source_url(entry.raw_word || entry.word)
          }
        )
      else
        acc
      end
    end)
  end

  defp collect_pending_entry(state, nil, _line), do: state

  defp collect_pending_entry(state, current_subject, line) do
    part_of_speech =
      extract_fr_dbnary_part_of_speech(line) ||
        extract_fr_lexinfo_part_of_speech(line)

    pending_entry = Map.get(state.pending_entries, current_subject, %{senses: []})

    pending_entry =
      pending_entry
      |> maybe_put(:form_subject, extract_form_subject(line))
      |> maybe_put(:part_of_speech, part_of_speech)
      |> update_senses(extract_sense_subjects(line))

    form_to_entry =
      case pending_entry[:form_subject] do
        nil -> state.form_to_entry
        form_subject -> Map.put(state.form_to_entry, form_subject, current_subject)
      end

    pending_entries =
      if pending_entry == %{senses: []} do
        state.pending_entries
      else
        Map.put(state.pending_entries, current_subject, pending_entry)
      end

    %{state | pending_entries: pending_entries, form_to_entry: form_to_entry}
  end

  defp collect_written_rep(state, nil, _line), do: state

  defp collect_written_rep(state, current_subject, line) do
    case {Map.get(state.form_to_entry, current_subject), extract_written_rep(line)} do
      {entry_subject, raw_word} when is_binary(entry_subject) and is_binary(raw_word) ->
        normalized_word = WordleEngine.normalize(raw_word)
        pending_entry = Map.get(state.pending_entries, entry_subject, %{senses: []})

        state =
          if MapSet.member?(state.targets, normalized_word) do
            relevant_entries =
              Map.put(state.relevant_entries, entry_subject, %{
                word: normalized_word,
                raw_word: normalize_display_word(raw_word),
                definition: nil,
                part_of_speech: pending_entry[:part_of_speech]
              })

            sense_to_entry =
              Enum.reduce(pending_entry[:senses] || [], state.sense_to_entry, fn sense_subject,
                                                                                 acc ->
                Map.put(acc, sense_subject, entry_subject)
              end)

            %{state | relevant_entries: relevant_entries, sense_to_entry: sense_to_entry}
          else
            state
          end

        %{
          state
          | form_to_entry: Map.delete(state.form_to_entry, current_subject),
            pending_entries: Map.delete(state.pending_entries, entry_subject)
        }

      _ ->
        state
    end
  end

  defp collect_definition(state, nil, _line), do: state

  defp collect_definition(state, current_subject, line) do
    case {Map.get(state.sense_to_entry, current_subject), extract_ttl_definition(line)} do
      {entry_subject, definition} when is_binary(entry_subject) and is_binary(definition) ->
        relevant_entry = Map.get(state.relevant_entries, entry_subject)

        if relevant_entry && is_nil(relevant_entry.definition) do
          relevant_entries =
            Map.put(state.relevant_entries, entry_subject, %{
              relevant_entry
              | definition: definition
            })

          %{state | relevant_entries: relevant_entries}
        else
          state
        end

      _ ->
        state
    end
  end

  @doc false
  def load_english_oewn_from_dir(dir, target_words) do
    target_words =
      target_words |> Enum.map(&WordleEngine.normalize/1) |> Enum.uniq() |> Enum.sort()

    entry_candidates =
      target_words
      |> Enum.group_by(fn word -> String.first(String.downcase(word)) || "0" end)
      |> Enum.reduce(%{}, fn {letter, words}, acc ->
        entry_path = Path.join(dir, "entries-#{letter}.json")

        if File.exists?(entry_path) do
          entry_data = entry_path |> File.read!() |> Jason.decode!()

          Enum.reduce(words, acc, fn word, inner_acc ->
            lowercase_word = String.downcase(word)

            entry =
              Map.get(entry_data, lowercase_word) ||
                Map.get(entry_data, String.capitalize(lowercase_word))

            case extract_oewn_candidate(entry) do
              nil -> inner_acc
              candidate -> Map.put(inner_acc, word, candidate)
            end
          end)
        else
          acc
        end
      end)

    synset_ids = entry_candidates |> Map.values() |> Enum.map(& &1.synset) |> MapSet.new()
    synset_definitions = load_oewn_synset_definitions(dir, synset_ids)

    Enum.reduce(entry_candidates, %{}, fn {word, candidate}, acc ->
      case Map.get(synset_definitions, candidate.synset) do
        nil ->
          acc

        definition ->
          put_word_variant(
            acc,
            word,
            %{
              display_word: String.downcase(word),
              definition: definition,
              part_of_speech: candidate.part_of_speech,
              source_name: @en_oewn_source_name,
              source_url: "https://en-word.net/"
            }
          )
      end
    end)
  end

  defp extract_oewn_candidate(entry) when is_map(entry) do
    Enum.find_value(["n", "v", "a", "r", "s"], fn pos_key ->
      with %{"sense" => senses} when is_list(senses) <- Map.get(entry, pos_key),
           %{"synset" => synset} <- List.first(senses),
           true <- is_binary(synset) do
        %{synset: synset, part_of_speech: Map.get(@en_pos_labels, pos_key)}
      else
        _ -> nil
      end
    end)
  end

  defp extract_oewn_candidate(_entry), do: nil

  defp load_oewn_synset_definitions(dir, synset_ids) do
    synset_files =
      dir
      |> Path.join("*.json")
      |> Path.wildcard()
      |> Enum.reject(fn path ->
        basename = Path.basename(path)
        String.starts_with?(basename, "entries-") or basename == "frames.json"
      end)
      |> Enum.sort()

    {definitions, _remaining} =
      Enum.reduce_while(synset_files, {%{}, synset_ids}, fn path, {definitions, remaining} ->
        if MapSet.size(remaining) == 0 do
          {:halt, {definitions, remaining}}
        else
          file_data = path |> File.read!() |> Jason.decode!()

          {definitions, remaining} =
            Enum.reduce(file_data, {definitions, remaining}, fn {synset_id, synset_data},
                                                                {inner_definitions,
                                                                 inner_remaining} ->
              if MapSet.member?(inner_remaining, synset_id) do
                definition = extract_oewn_synset_definition(synset_data)

                if definition do
                  {
                    Map.put(inner_definitions, synset_id, definition),
                    MapSet.delete(inner_remaining, synset_id)
                  }
                else
                  {inner_definitions, inner_remaining}
                end
              else
                {inner_definitions, inner_remaining}
              end
            end)

          {:cont, {definitions, remaining}}
        end
      end)

    definitions
  end

  defp extract_oewn_synset_definition(%{"definition" => definitions}) when is_list(definitions) do
    definitions
    |> Enum.find(&valid_definition?/1)
    |> normalize_definition()
  end

  defp extract_oewn_synset_definition(_), do: nil

  @doc false
  def load_english_wiktextract_from_lines(lines, target_words) do
    pending_words = target_words |> Enum.map(&WordleEngine.normalize/1) |> MapSet.new()

    {definitions, _pending_words} =
      Enum.reduce_while(lines, {%{}, pending_words}, fn raw_line, {definitions, pending_words} ->
        if MapSet.size(pending_words) == 0 do
          {:halt, {definitions, pending_words}}
        else
          line = String.trim(raw_line)

          if line == "" do
            {:cont, {definitions, pending_words}}
          else
            case Jason.decode(line) do
              {:ok, entry} ->
                word = entry["word"]
                lang_code = entry["lang_code"]
                normalized_word = if is_binary(word), do: WordleEngine.normalize(word), else: nil

                cond do
                  lang_code != "en" or not is_binary(normalized_word) ->
                    {:cont, {definitions, pending_words}}

                  not MapSet.member?(pending_words, normalized_word) ->
                    {:cont, {definitions, pending_words}}

                  true ->
                    case extract_wiktextract_definition(entry) do
                      nil ->
                        {:cont, {definitions, pending_words}}

                      definition ->
                        record = %{
                          display_word: normalize_display_word(word),
                          definition: definition.definition,
                          part_of_speech: definition.part_of_speech,
                          source_name: @en_wiktextract_source_name,
                          source_url: english_wiktionary_source_url(word)
                        }

                        {:cont,
                         {put_word_variant(definitions, normalized_word, record),
                          MapSet.delete(pending_words, normalized_word)}}
                    end
                end

              _ ->
                {:cont, {definitions, pending_words}}
            end
          end
        end
      end)

    definitions
  end

  @doc false
  def load_french_wiktextract_from_lines(lines, target_words, display_variants_by_word \\ %{}) do
    pending_words = target_words |> Enum.map(&WordleEngine.normalize/1) |> MapSet.new()

    {definitions, _pending_words} =
      Enum.reduce_while(lines, {%{}, pending_words}, fn raw_line, {definitions, pending_words} ->
        if MapSet.size(pending_words) == 0 do
          {:halt, {definitions, pending_words}}
        else
          line = String.trim(raw_line)

          if line == "" do
            {:cont, {definitions, pending_words}}
          else
            case Jason.decode(line) do
              {:ok, entry} ->
                word = entry["word"]
                lang_code = entry["lang_code"]
                normalized_word = if is_binary(word), do: WordleEngine.normalize(word), else: nil

                cond do
                  lang_code != "fr" or not is_binary(normalized_word) ->
                    {:cont, {definitions, pending_words}}

                  not MapSet.member?(pending_words, normalized_word) ->
                    {:cont, {definitions, pending_words}}

                  not allowed_french_display_variant?(
                    normalized_word,
                    normalize_display_word(word),
                    display_variants_by_word
                  ) ->
                    {:cont, {definitions, pending_words}}

                  true ->
                    case extract_wiktextract_definition(entry) do
                      nil ->
                        {:cont, {definitions, pending_words}}

                      definition ->
                        record = %{
                          display_word:
                            resolve_french_display_word(
                              %{
                                word: normalized_word,
                                raw_word: normalize_display_word(word)
                              },
                              display_variants_by_word
                            ),
                          definition: definition.definition,
                          part_of_speech: definition.part_of_speech,
                          source_name: @fr_wiktextract_source_name,
                          source_url: french_source_url(word)
                        }

                        updated_definitions =
                          put_word_variant(definitions, normalized_word, record)

                        updated_pending_words =
                          if has_all_french_variants?(
                               normalized_word,
                               updated_definitions,
                               display_variants_by_word
                             ) do
                            MapSet.delete(pending_words, normalized_word)
                          else
                            pending_words
                          end

                        {:cont, {updated_definitions, updated_pending_words}}
                    end
                end

              _ ->
                {:cont, {definitions, pending_words}}
            end
          end
        end
      end)

    definitions
  end

  @doc false
  def load_french_display_variants_from_lines(lines, target_words) do
    target_set = target_words |> MapSet.new()

    Enum.reduce(lines, %{}, fn raw_line, acc ->
      raw_line
      |> String.trim()
      |> normalize_display_word()
      |> case do
        "" ->
          acc

        display_word ->
          normalized_word = WordleEngine.normalize(display_word)

          if String.length(normalized_word) == 5 and MapSet.member?(target_set, normalized_word) do
            Map.update(
              acc,
              normalized_word,
              MapSet.new([display_word]),
              &MapSet.put(&1, display_word)
            )
          else
            acc
          end
      end
    end)
  end

  defp extract_wiktextract_definition(entry) do
    senses = List.wrap(entry["senses"])

    gloss =
      Enum.find_value(senses, fn sense ->
        sense
        |> Map.get("glosses", [])
        |> Enum.find(&valid_definition?/1)
      end)

    if valid_definition?(gloss) do
      %{
        definition: normalize_definition(gloss),
        part_of_speech: format_wiktextract_pos(entry["pos"])
      }
    end
  end

  defp format_wiktextract_pos(pos) when is_binary(pos) do
    pos
    |> String.replace("_", " ")
    |> String.split()
    |> Enum.map_join(" ", &String.capitalize/1)
  end

  defp format_wiktextract_pos(_pos), do: nil

  defp merge_word_variant_maps(left, right) do
    Map.merge(left, right, fn _word, left_variants, right_variants ->
      dedupe_variants(left_variants ++ right_variants)
    end)
  end

  defp put_word_variant(acc, word, variant) do
    Map.update(acc, word, [variant], fn variants ->
      dedupe_variants(variants ++ [variant])
    end)
  end

  defp dedupe_variants(variants) do
    variants
    |> Enum.reduce(%{}, fn variant, acc ->
      key =
        variant.display_word
        |> normalize_display_word()
        |> String.downcase()

      Map.put_new(acc, key, variant)
    end)
    |> Map.values()
    |> Enum.sort_by(fn variant -> String.downcase(variant.display_word) end)
  end

  defp prepare_variants(locale, word, variants, display_variants, _now) do
    variants
    |> Enum.map(&resolve_variant(locale, word, &1, display_variants))
    |> Enum.reject(&is_nil/1)
    |> dedupe_variants()
  end

  defp resolve_variant("fr", word, variant, display_variants) do
    display_word =
      variant
      |> Map.put(:word, word)
      |> resolve_french_display_word(display_variants)

    if valid_definition?(variant.definition) and valid_definition?(display_word) do
      %{variant | display_word: display_word, source_url: french_source_url(display_word)}
    end
  end

  defp resolve_variant(_locale, _word, variant, _display_variants) do
    display_word = normalize_display_word(variant.display_word || "")

    if valid_definition?(variant.definition) and valid_definition?(display_word) do
      %{variant | display_word: display_word}
    end
  end

  defp resolve_french_display_word(entry, display_variants_by_word) do
    normalized_word = entry.word
    raw_word = normalize_display_word(entry[:raw_word] || "")
    allowed_variants = Map.get(display_variants_by_word, normalized_word, MapSet.new())
    allowed_list = allowed_variants |> Enum.to_list() |> Enum.sort()

    resolved =
      cond do
        raw_word != "" and MapSet.size(allowed_variants) == 0 ->
          raw_word

        raw_word != "" ->
          Enum.find(allowed_list, &(String.downcase(&1) == String.downcase(raw_word)))

        MapSet.size(allowed_variants) == 1 ->
          hd(allowed_list)

        true ->
          List.first(allowed_list)
      end

    cond do
      is_binary(resolved) and resolved != "" -> resolved
      allowed_list != [] -> hd(allowed_list)
      raw_word != "" -> raw_word
      true -> String.downcase(normalized_word)
    end
  end

  defp allowed_french_display_variant?(normalized_word, display_word, display_variants_by_word) do
    allowed_variants = Map.get(display_variants_by_word, normalized_word, MapSet.new())
    display_word = normalize_display_word(display_word)

    MapSet.size(allowed_variants) == 0 or
      MapSet.member?(allowed_variants, display_word) or
      Enum.any?(allowed_variants, &(String.downcase(&1) == String.downcase(display_word)))
  end

  defp has_all_french_variants?(normalized_word, definitions, display_variants_by_word) do
    expected_variants = Map.get(display_variants_by_word, normalized_word, MapSet.new())

    if MapSet.size(expected_variants) == 0 do
      Map.has_key?(definitions, normalized_word)
    else
      found_variants =
        definitions
        |> Map.get(normalized_word, [])
        |> Enum.map(&normalize_display_word(&1.display_word))
        |> MapSet.new()

      MapSet.subset?(expected_variants, found_variants)
    end
  end

  defp normalize_display_variant_set(%MapSet{} = display_variants), do: display_variants
  defp normalize_display_variant_set(_), do: MapSet.new()

  defp load_french_display_variants(target_words, opts) do
    case opts[:fr_word_list] || default_french_word_list_source() do
      nil ->
        %{}

      source ->
        case ensure_optional_source_file(source) do
          {:ok, source_path} ->
            source_path
            |> decompressed_line_stream()
            |> load_french_display_variants_from_lines(target_words)

          {:error, {:file_not_found, _path}} ->
            %{}
        end
    end
  end

  defp default_french_word_list_source do
    Enum.find_value(@default_fr_word_list_candidates, fn candidate ->
      expanded = Path.expand(candidate)
      if File.exists?(expanded), do: expanded
    end)
  end

  defp ensure_optional_source_file(source) when is_binary(source) do
    expanded = Path.expand(source)

    if File.exists?(expanded) do
      {:ok, expanded}
    else
      {:error, {:file_not_found, expanded}}
    end
  end

  defp normalize_display_word(word) when is_binary(word) do
    word
    |> String.trim()
    |> :unicode.characters_to_nfc_binary()
  end

  defp normalize_display_word(_word), do: ""

  defp normalize_definition(definition) when is_binary(definition) do
    definition
    |> String.trim()
    |> case do
      "" -> nil
      value -> value
    end
  end

  defp normalize_definition(_definition), do: nil

  defp valid_definition?(value), do: is_binary(value) and String.trim(value) != ""

  defp normalize_locales("all"), do: {:ok, @supported_locales}

  defp normalize_locales(locale) when is_binary(locale) do
    locale = String.downcase(String.trim(locale))

    if locale in @supported_locales do
      {:ok, [locale]}
    else
      {:error, :invalid_locale}
    end
  end

  defp normalize_scope(scope) when is_binary(scope) do
    scope = String.downcase(String.trim(scope))

    if scope in @supported_scopes do
      {:ok, scope}
    else
      {:error, :invalid_scope}
    end
  end

  defp ensure_source_file(source, temp_dir, filename) when is_binary(source) do
    if String.starts_with?(source, ["http://", "https://"]) do
      path = Path.join(temp_dir, filename)

      case Req.get(url: source, into: File.stream!(path, [:write, :binary])) do
        {:ok, %Req.Response{status: status}} when status in 200..299 ->
          {:ok, path}

        {:ok, %Req.Response{status: status}} ->
          {:error, {:download_failed, source, status}}

        {:error, reason} ->
          {:error, {:download_failed, source, reason}}
      end
    else
      expanded = Path.expand(source)

      if File.exists?(expanded) do
        {:ok, expanded}
      else
        {:error, {:file_not_found, expanded}}
      end
    end
  end

  defp extract_zip!(zip_path, destination_dir) do
    File.rm_rf(destination_dir)
    File.mkdir_p!(destination_dir)

    case :zip.extract(String.to_charlist(zip_path), cwd: String.to_charlist(destination_dir)) do
      {:ok, _files} -> :ok
      {:error, reason} -> raise "Failed to extract #{zip_path}: #{inspect(reason)}"
    end
  end

  defp decompressed_line_stream(path) do
    case Path.extname(path) do
      ".bz2" -> command_line_stream("bzip2", ["-dc", path])
      ".gz" -> command_line_stream("gzip", ["-dc", path])
      _ -> File.stream!(path)
    end
  end

  defp command_line_stream(executable, args) do
    executable_path =
      System.find_executable(executable) ||
        raise "Required executable #{inspect(executable)} was not found in PATH"

    Stream.resource(
      fn ->
        port =
          Port.open({:spawn_executable, executable_path}, [
            :binary,
            :exit_status,
            {:args, args}
          ])

        %{port: port, buffer: "", done: false}
      end,
      fn
        %{done: true} = state ->
          {:halt, state}

        %{port: port, buffer: buffer} = state ->
          receive do
            {^port, {:data, chunk}} ->
              combined = buffer <> chunk
              parts = String.split(combined, "\n")
              rest = List.last(parts) || ""
              lines = Enum.drop(parts, -1)
              {lines, %{state | buffer: rest}}

            {^port, {:exit_status, 0}} ->
              lines = if buffer == "", do: [], else: [buffer]
              {lines, %{state | done: true, buffer: ""}}

            {^port, {:exit_status, status}} ->
              raise "Command #{inspect(executable)} #{Enum.join(args, " ")} failed with status #{status}"
          end
      end,
      fn %{port: port, done: done} ->
        if not done do
          Port.close(port)
        end
      end
    )
  end

  defp extract_subject(line) when is_binary(line) do
    case Regex.run(~r/^(\S+)/, line) do
      [_, subject] -> subject
      _ -> nil
    end
  end

  defp extract_form_subject(line) do
    case Regex.run(~r/ontolex:(?:canonicalForm|otherForm)\s+(\S+)/, line) do
      [_, subject] -> clean_ttl_identifier(subject)
      _ -> nil
    end
  end

  defp extract_sense_subjects(line) do
    case Regex.run(~r/ontolex:sense\s+(.+)$/, line) do
      [_, suffix] ->
        suffix
        |> then(&Regex.scan(~r/fra:[A-Za-z0-9_]+/, &1))
        |> Enum.map(&List.first/1)

      _ ->
        []
    end
  end

  defp extract_written_rep(line) do
    case Regex.run(~r/ontolex:writtenRep\s+"((?:[^"\\]|\\.)+)"/, line) do
      [_, value] -> ttl_unescape(value)
      _ -> nil
    end
  end

  defp extract_ttl_definition(line) do
    case Regex.run(~r/skos:definition\s+\[\s*rdf:value\s+"((?:[^"\\]|\\.)+)"/, line) do
      [_, value] -> ttl_unescape(value) |> normalize_definition()
      _ -> nil
    end
  end

  defp extract_fr_dbnary_part_of_speech(line) do
    case Regex.run(~r/dbnary:partOfSpeech\s+"([^"]+)"/, line) do
      [_, tag] -> Map.get(@fr_pos_labels, tag, fallback_fr_pos_label(tag))
      _ -> nil
    end
  end

  defp extract_fr_lexinfo_part_of_speech(line) do
    case Regex.run(~r/lexinfo:partOfSpeech\s+lexinfo:([A-Za-z]+)/, line) do
      [_, tag] -> Map.get(@fr_lexinfo_pos_labels, tag, fallback_fr_pos_label(tag))
      _ -> nil
    end
  end

  defp fallback_fr_pos_label(raw_tag) when is_binary(raw_tag) do
    raw_tag
    |> String.trim("-")
    |> String.replace("-", " ")
    |> String.split()
    |> Enum.map_join(" ", &String.capitalize/1)
    |> case do
      "" -> nil
      label -> label
    end
  end

  defp clean_ttl_identifier(identifier) do
    identifier
    |> String.trim()
    |> String.trim_trailing(".")
    |> String.trim_trailing(";")
    |> String.trim_trailing(",")
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp update_senses(entry, []), do: entry

  defp update_senses(entry, senses) do
    Map.update(entry, :senses, senses, fn existing ->
      (existing ++ senses) |> Enum.uniq()
    end)
  end

  defp ttl_unescape(value) do
    Enum.reduce(@ttl_escape_replacements, value, fn {pattern, replacement}, acc ->
      String.replace(acc, pattern, replacement)
    end)
  end

  defp french_source_url(word) do
    encoded_word = word |> normalize_display_word() |> String.downcase() |> URI.encode()
    "https://fr.wiktionary.org/wiki/#{encoded_word}#Fran%C3%A7ais"
  end

  defp english_wiktionary_source_url(word) do
    encoded_word = word |> normalize_display_word() |> String.downcase() |> URI.encode()
    "https://en.wiktionary.org/wiki/#{encoded_word}#English"
  end
end
