defmodule AdventureTimeApi.Quests.WordleEngine do
  @moduledoc """
  Pure Wordle logic: normalization, daily word selection, guess evaluation.
  No database access — all functions are deterministic given their inputs.
  """

  @target_length 5

  @doc """
  Strip French accents (NFD decomposition → remove combining diacritics),
  remove non-alpha characters, uppercase. Matches backup normalizeFrenchWord.
  """
  def normalize(word) do
    word
    |> :unicode.characters_to_nfd_binary()
    |> String.replace(~r/[\x{0300}-\x{036F}]/u, "")
    |> String.replace(~r/[^a-zA-Z]/, "")
    |> String.upcase()
  end

  @doc "Returns true if the word is exactly #{@target_length} uppercase ASCII letters."
  def valid_length_and_format?(word) do
    String.match?(word, ~r/^[A-Z]{#{@target_length}}$/)
  end

  @doc """
  Deterministically select a word for the given date.
  Uses SHA-256 of the ISO date string; takes first 8 hex chars as unsigned int mod word count.
  Words list must be sorted consistently (alphabetically) for stability across restarts.
  """
  def select_word_for_date(words, %Date{} = date) when is_list(words) and words != [] do
    date_key = Date.to_iso8601(date)
    hash_hex = :crypto.hash(:sha256, date_key) |> Base.encode16(case: :lower)
    <<first_8::binary-size(8), _::binary>> = hash_hex
    index = String.to_integer(first_8, 16) |> rem(length(words))
    Enum.at(words, index)
  end

  @doc """
  Evaluate a normalized 5-letter guess against the target.
  Returns a list of 5 atoms: :correct, :present, or :absent.
  Handles duplicate letters correctly (same algorithm as backup evaluateGuess).
  """
  def evaluate_guess(guess, target) do
    guess_chars = String.upcase(guess) |> String.graphemes()
    target_chars = String.upcase(target) |> String.graphemes()
    result = List.duplicate(:absent, length(guess_chars))

    # Count available target characters
    counts =
      Enum.reduce(target_chars, %{}, fn char, acc ->
        Map.update(acc, char, 1, &(&1 + 1))
      end)

    # Pass 1: mark exact matches, decrement counts
    {result, counts} =
      guess_chars
      |> Enum.with_index()
      |> Enum.reduce({result, counts}, fn {char, idx}, {res, cnts} ->
        if char == Enum.at(target_chars, idx) do
          {List.replace_at(res, idx, :correct), Map.update(cnts, char, 0, &(&1 - 1))}
        else
          {res, cnts}
        end
      end)

    # Pass 2: mark present letters (not already correct), decrement counts
    {result, _counts} =
      guess_chars
      |> Enum.with_index()
      |> Enum.reduce({result, counts}, fn {char, idx}, {res, cnts} ->
        if Enum.at(res, idx) == :correct do
          {res, cnts}
        else
          remaining = Map.get(cnts, char, 0)

          if remaining > 0 do
            {List.replace_at(res, idx, :present), Map.put(cnts, char, remaining - 1)}
          else
            {res, cnts}
          end
        end
      end)

    result
  end

  @doc "Serialize evaluation atoms to strings for JSON output."
  def evaluation_to_strings(evaluation) do
    Enum.map(evaluation, fn
      :correct -> "correct"
      :present -> "present"
      :absent -> "absent"
    end)
  end
end
