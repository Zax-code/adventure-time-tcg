defmodule AdventureTimeApi.Quests.WordleEngineTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Quests.WordleEngine

  test "letter_only_source_word?/1 accepts single words and rejects compounds" do
    assert WordleEngine.letter_only_source_word?("abîme")
    assert WordleEngine.letter_only_source_word?("ocean")

    refute WordleEngine.letter_only_source_word?("fût-ce")
    refute WordleEngine.letter_only_source_word?("mis fin")
    refute WordleEngine.letter_only_source_word?("pin-up")
  end
end
