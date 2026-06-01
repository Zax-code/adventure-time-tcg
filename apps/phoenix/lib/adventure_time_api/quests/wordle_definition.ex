defmodule AdventureTimeApi.Quests.WordleDefinition do
  @moduledoc false

  @language_sections %{
    "en" => "English",
    "fr" => "Français"
  }

  @source_names %{
    "en" => "English Wiktionary",
    "fr" => "Wiktionnaire"
  }

  @ignored_section_prefixes %{
    "en" => [
      "alternative forms",
      "alternative spelling",
      "anagrams",
      "antonyms",
      "compounds",
      "conjugation",
      "declension",
      "derived terms",
      "descendants",
      "etymology",
      "further reading",
      "hyponyms",
      "hypernyms",
      "notes",
      "pronunciation",
      "quotations",
      "references",
      "related terms",
      "see also",
      "synonyms",
      "translations",
      "usage notes"
    ],
    "fr" => [
      "anagrammes",
      "antonymes",
      "attestations",
      "dérivés",
      "étymologie",
      "gentilés",
      "hyperonymes",
      "hyponymes",
      "notes",
      "paronymes",
      "prononciation",
      "proverbes",
      "quasi-synonymes",
      "références",
      "synonymes",
      "traductions",
      "vocabulaire apparenté"
    ]
  }

  @part_of_speech_prefixes %{
    "en" => [
      "abbreviation",
      "acronym",
      "adjective",
      "adverb",
      "article",
      "conjunction",
      "contraction",
      "determiner",
      "initialism",
      "interjection",
      "letter",
      "noun",
      "numeral",
      "participle",
      "phrase",
      "prefix",
      "preposition",
      "proper noun",
      "pronoun",
      "proverb",
      "suffix",
      "symbol",
      "verb"
    ],
    "fr" => [
      "adjectif",
      "adverbe",
      "article",
      "conjonction",
      "déterminant",
      "interjection",
      "locution",
      "nom",
      "numéral",
      "onomatopée",
      "particule",
      "préfixe",
      "préposition",
      "pronom",
      "suffixe",
      "symbole",
      "verbe"
    ]
  }

  @section_text_pattern ~r/<ol>\s*<li\b[^>]*>(.*?)(?=<dl\b|<ul\b|<ol\b|<\/li>)/s
  @empty_html_pattern ~r/<[^>]+>/
  @reference_pattern ~r/<sup\b[^>]*class="reference"[^>]*>.*?<\/sup>/s
  @style_pattern ~r/<style\b[^>]*>.*?<\/style>/s
  @comment_pattern ~r/<!--.*?-->/s

  def fetch(locale, word) when is_binary(locale) and is_binary(word) do
    page_title = word |> String.trim() |> String.downcase()

    with {:ok, section} <- fetch_definition_section(locale, page_title),
         {:ok, html} <- fetch_section_html(locale, page_title, section.index),
         {:ok, definition} <- extract_definition_from_html(html) do
      {:ok,
       %{
         definition: definition,
         part_of_speech: section.title,
         source_name: Map.fetch!(@source_names, locale),
         source_url: source_url(locale, page_title)
       }}
    end
  end

  defp fetch_definition_section(locale, page_title) do
    with {:ok, %{"parse" => %{"sections" => sections}}} <-
           api_get(locale, page_title, %{
             "action" => "parse",
             "prop" => "sections",
             "redirects" => true
           }),
         {:ok, language_section_number} <- find_language_section_number(locale, sections),
         {:ok, section} <- find_part_of_speech_section(locale, language_section_number, sections) do
      {:ok, section}
    end
  end

  defp fetch_section_html(locale, page_title, section_index) do
    with {:ok, %{"parse" => %{"text" => html}}} <-
           api_get(locale, page_title, %{
             "action" => "parse",
             "prop" => "text",
             "section" => section_index,
             "disableeditsection" => true,
             "disablelimitreport" => true,
             "disabletoc" => true,
             "redirects" => true
           }) do
      {:ok, html}
    end
  end

  defp api_get(locale, page_title, params) do
    url = "#{base_url(locale)}/w/api.php"

    case Req.get(
           url: url,
           params:
             Map.merge(%{"format" => "json", "formatversion" => 2, "page" => page_title}, params)
         ) do
      {:ok, %Req.Response{status: status, body: %{"error" => _}}} when status in 200..299 ->
        {:error, :definition_not_found}

      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 and is_map(body) ->
        {:ok, body}

      _ ->
        {:error, :definition_fetch_failed}
    end
  end

  defp find_language_section_number(locale, sections) do
    language_section = Map.fetch!(@language_sections, locale)

    case Enum.find(sections, fn section ->
           section["level"] == "2" and normalize_title(section["line"]) == language_section
         end) do
      %{"number" => number} -> {:ok, number}
      _ -> {:error, :definition_not_found}
    end
  end

  defp find_part_of_speech_section(locale, language_section_number, sections) do
    descendants =
      Enum.filter(sections, fn section ->
        section["level"] == "3" and
          String.starts_with?(section["number"], language_section_number <> ".")
      end)

    case Enum.find(descendants, &lexical_section?(locale, &1)) ||
           Enum.find(descendants, &(not ignored_section?(locale, &1))) do
      %{"index" => index, "line" => line} -> {:ok, %{index: index, title: normalize_title(line)}}
      _ -> {:error, :definition_not_found}
    end
  end

  defp lexical_section?(locale, %{"line" => line}) do
    title = normalize_title(line) |> String.downcase()

    Enum.any?(Map.fetch!(@part_of_speech_prefixes, locale), &String.starts_with?(title, &1))
  end

  defp ignored_section?(locale, %{"line" => line}) do
    title = normalize_title(line) |> String.downcase()

    Enum.any?(Map.fetch!(@ignored_section_prefixes, locale), &String.starts_with?(title, &1))
  end

  defp extract_definition_from_html(html) do
    case Regex.run(@section_text_pattern, html, capture: :all_but_first) do
      [definition_html] ->
        definition =
          definition_html
          |> strip_markup()
          |> normalize_whitespace()

        if definition == "" do
          {:error, :definition_not_found}
        else
          {:ok, definition}
        end

      _ ->
        {:error, :definition_not_found}
    end
  end

  defp strip_markup(html) do
    html
    |> String.replace(@comment_pattern, " ")
    |> String.replace(@style_pattern, " ")
    |> String.replace(@reference_pattern, " ")
    |> String.replace(@empty_html_pattern, " ")
    |> decode_entities()
  end

  defp decode_entities(text) do
    text
    |> String.replace("&nbsp;", " ")
    |> String.replace("&amp;", "&")
    |> String.replace("&quot;", "\"")
    |> String.replace("&apos;", "'")
    |> String.replace("&#39;", "'")
    |> String.replace("&lt;", "<")
    |> String.replace("&gt;", ">")
    |> then(fn value ->
      Regex.replace(~r/&#x([0-9a-fA-F]+);/, value, fn _, hex ->
        hex |> String.to_integer(16) |> List.wrap() |> :unicode.characters_to_binary()
      end)
    end)
    |> then(fn value ->
      Regex.replace(~r/&#(\d+);/, value, fn _, digits ->
        digits |> String.to_integer() |> List.wrap() |> :unicode.characters_to_binary()
      end)
    end)
  end

  defp normalize_title(title) do
    title
    |> strip_markup()
    |> normalize_whitespace()
  end

  defp normalize_whitespace(text) do
    text
    |> String.replace(~r/\s+/u, " ")
    |> String.replace(~r/\(\s+/u, "(")
    |> String.replace(~r/\s+\)/u, ")")
    |> String.replace(~r/\s+([,.;:!?])/u, "\\1")
    |> String.trim()
  end

  defp source_url(locale, page_title) do
    "#{source_base_url(locale)}/wiki/#{URI.encode(page_title)}##{URI.encode(Map.fetch!(@language_sections, locale))}"
  end

  defp base_url(locale) do
    Application.get_env(:adventure_time_api, __MODULE__, [])
    |> Keyword.get(:base_urls, %{})
    |> Map.get(locale, "https://#{locale}.wiktionary.org")
  end

  defp source_base_url(locale), do: "https://#{locale}.wiktionary.org"
end
