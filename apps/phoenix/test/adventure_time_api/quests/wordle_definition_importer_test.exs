defmodule AdventureTimeApi.Quests.WordleDefinitionImporterTest do
  use ExUnit.Case, async: true

  alias AdventureTimeApi.Quests.WordleDefinitionImporter

  test "load_french_definitions_from_lines extracts the first DBnary sense for target words" do
    lines = [
      "fra:amour__nom__1  rdf:type  ontolex:Word , ontolex:LexicalEntry;",
      "        dbnary:partOfSpeech    \"-nom-\";",
      "        ontolex:canonicalForm  fra:__cf_amour__nom__1;",
      "        ontolex:sense          fra:__ws_1_amour__nom__1 , fra:__ws_2_amour__nom__1 .",
      "",
      "fra:__cf_amour__nom__1",
      "        rdf:type             ontolex:Form;",
      "        ontolex:writtenRep   \"amour\"@fr .",
      "",
      "fra:__ws_1_amour__nom__1",
      "        rdf:type            ontolex:LexicalSense;",
      "        skos:definition     [ rdf:value  \"Sentiment agreable et intense.\"@fr ] .",
      "",
      "fra:__ws_2_amour__nom__1",
      "        rdf:type            ontolex:LexicalSense;",
      "        skos:definition     [ rdf:value  \"Definition secondaire.\"@fr ] ."
    ]

    assert WordleDefinitionImporter.load_french_definitions_from_lines(lines, ["AMOUR"]) == %{
             "AMOUR" => %{
               definition: "Sentiment agreable et intense.",
               part_of_speech: "Nom commun",
               source_name: "DBnary / Wiktionnaire",
               source_url: "https://fr.wiktionary.org/wiki/amour#Fran%C3%A7ais"
             }
           }
  end

  test "load_english_oewn_from_dir resolves definitions through entries and synsets" do
    tmp_dir =
      Path.join(
        System.tmp_dir!(),
        "wordle-definition-importer-test-#{System.unique_integer([:positive])}"
      )

    File.mkdir_p!(tmp_dir)
    on_exit(fn -> File.rm_rf(tmp_dir) end)

    File.write!(
      Path.join(tmp_dir, "entries-a.json"),
      Jason.encode!(%{
        "apple" => %{
          "n" => %{
            "sense" => [
              %{"synset" => "07755101-n"}
            ]
          }
        }
      })
    )

    File.write!(
      Path.join(tmp_dir, "noun.food.json"),
      Jason.encode!(%{
        "07755101-n" => %{
          "definition" => ["A common fruit grown on trees."],
          "partOfSpeech" => "n"
        }
      })
    )

    File.write!(Path.join(tmp_dir, "frames.json"), Jason.encode!(%{}))

    assert WordleDefinitionImporter.load_english_oewn_from_dir(tmp_dir, ["APPLE"]) == %{
             "APPLE" => %{
               definition: "A common fruit grown on trees.",
               part_of_speech: "Noun",
               source_name: "Open English WordNet",
               source_url: "https://en-word.net/"
             }
           }
  end

  test "load_english_wiktextract_from_lines uses the first matching English gloss" do
    line =
      Jason.encode!(%{
        "word" => "apple",
        "lang_code" => "en",
        "pos" => "noun",
        "senses" => [
          %{"glosses" => ["The usually round fruit of a tree of the rose family."]}
        ]
      })

    assert WordleDefinitionImporter.load_english_wiktextract_from_lines([line], ["APPLE"]) == %{
             "APPLE" => %{
               definition: "The usually round fruit of a tree of the rose family.",
               part_of_speech: "Noun",
               source_name: "Wiktextract / English Wiktionary",
               source_url: "https://en.wiktionary.org/wiki/apple#English"
             }
           }
  end
end
