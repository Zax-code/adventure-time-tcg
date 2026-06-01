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
             "AMOUR" => [
               %{
                 display_word: "amour",
                 definition: "Sentiment agreable et intense.",
                 part_of_speech: "Nom commun",
                 source_name: "DBnary / Wiktionnaire",
                 source_url: "https://fr.wiktionary.org/wiki/amour#Fran%C3%A7ais"
               }
             ]
           }
  end

  test "load_french_definitions_from_lines keeps multiple accented variants for one normalized word" do
    lines = [
      "fra:abime__nom__1  rdf:type  ontolex:Word , ontolex:LexicalEntry;",
      "        dbnary:partOfSpeech    \"-nom-\";",
      "        ontolex:canonicalForm  fra:__cf_abime__nom__1;",
      "        ontolex:sense          fra:__ws_1_abime__nom__1 .",
      "",
      "fra:__cf_abime__nom__1",
      "        rdf:type             ontolex:Form;",
      "        ontolex:writtenRep   \"abîme\"@fr .",
      "",
      "fra:__ws_1_abime__nom__1",
      "        rdf:type            ontolex:LexicalSense;",
      "        skos:definition     [ rdf:value  \"Gouffre tres profond.\"@fr ] .",
      "",
      "fra:abime__verb__2  rdf:type  ontolex:Word , ontolex:LexicalEntry;",
      "        dbnary:partOfSpeech    \"-verb-\";",
      "        ontolex:canonicalForm  fra:__cf_abime__verb__2;",
      "        ontolex:sense          fra:__ws_1_abime__verb__2 .",
      "",
      "fra:__cf_abime__verb__2",
      "        rdf:type             ontolex:Form;",
      "        ontolex:writtenRep   \"abîmé\"@fr .",
      "",
      "fra:__ws_1_abime__verb__2",
      "        rdf:type            ontolex:LexicalSense;",
      "        skos:definition     [ rdf:value  \"Participe passe de abimer.\"@fr ] ."
    ]

    variants_by_word =
      WordleDefinitionImporter.load_french_display_variants_from_lines(
        ["abîme", "abîmé"],
        ["ABIME"]
      )

    assert WordleDefinitionImporter.load_french_definitions_from_lines(
             lines,
             ["ABIME"],
             variants_by_word
           ) == %{
             "ABIME" => [
               %{
                 display_word: "abîme",
                 definition: "Gouffre tres profond.",
                 part_of_speech: "Nom commun",
                 source_name: "DBnary / Wiktionnaire",
                 source_url: "https://fr.wiktionary.org/wiki/ab%C3%AEme#Fran%C3%A7ais"
               },
               %{
                 display_word: "abîmé",
                 definition: "Participe passe de abimer.",
                 part_of_speech: "Verbe",
                 source_name: "DBnary / Wiktionnaire",
                 source_url: "https://fr.wiktionary.org/wiki/ab%C3%AEm%C3%A9#Fran%C3%A7ais"
               }
             ]
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
             "APPLE" => [
               %{
                 display_word: "apple",
                 definition: "A common fruit grown on trees.",
                 part_of_speech: "Noun",
                 source_name: "Open English WordNet",
                 source_url: "https://en-word.net/"
               }
             ]
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
             "APPLE" => [
               %{
                 display_word: "apple",
                 definition: "The usually round fruit of a tree of the rose family.",
                 part_of_speech: "Noun",
                 source_name: "Wiktextract / English Wiktionary",
                 source_url: "https://en.wiktionary.org/wiki/apple#English"
               }
             ]
           }
  end

  test "load_french_wiktextract_from_lines keeps multiple accented variants for one normalized word" do
    variants_by_word =
      WordleDefinitionImporter.load_french_display_variants_from_lines(
        ["abîme", "abîmé"],
        ["ABIME"]
      )

    lines = [
      Jason.encode!(%{
        "word" => "abîme",
        "lang_code" => "fr",
        "pos" => "noun",
        "senses" => [%{"glosses" => ["Gouffre très profond."]}]
      }),
      Jason.encode!(%{
        "word" => "abîmé",
        "lang_code" => "fr",
        "pos" => "verb",
        "senses" => [%{"glosses" => ["Participe passé de abîmer."]}]
      })
    ]

    assert WordleDefinitionImporter.load_french_wiktextract_from_lines(
             lines,
             ["ABIME"],
             variants_by_word
           ) == %{
             "ABIME" => [
               %{
                 display_word: "abîme",
                 definition: "Gouffre très profond.",
                 part_of_speech: "Noun",
                 source_name: "Wiktextract / Wiktionnaire",
                 source_url: "https://fr.wiktionary.org/wiki/ab%C3%AEme#Fran%C3%A7ais"
               },
               %{
                 display_word: "abîmé",
                 definition: "Participe passé de abîmer.",
                 part_of_speech: "Verb",
                 source_name: "Wiktextract / Wiktionnaire",
                 source_url: "https://fr.wiktionary.org/wiki/ab%C3%AEm%C3%A9#Fran%C3%A7ais"
               }
             ]
           }
  end
end
