alias AdventureTimeApi.Accounts.User
alias AdventureTimeApi.Quests.WordleDictionaryWord
alias AdventureTimeApi.Repo

# Catalog cards, rarities, packs, card abilities, and card images are imported
# from the legacy PWA or managed through admin tools. Do not seed stale catalog
# data from this file.

# Wordle Dictionary
# Source CSV: exported from backup DB via:
#   PGPASSWORD=postgres psql -h 127.0.0.1 -p 5434 -U postgres adventure_time_tcg \
#     -c "\COPY (SELECT word, is_allowed_guess, is_solution_candidate FROM wordle_dictionary_words WHERE locale='fr' ORDER BY word) TO '/tmp/fr_words.csv' CSV HEADER"
wordle_csv = "/tmp/fr_words.csv"

if File.exists?(wordle_csv) do
  existing_count =
    WordleDictionaryWord
    |> Repo.aggregate(:count, :id)

  if existing_count == 0 do
    IO.puts("Seeding Wordle dictionary from #{wordle_csv}...")
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    rows =
      wordle_csv
      |> File.stream!()
      |> Stream.drop(1)
      |> Enum.flat_map(fn line ->
        case String.split(String.trim(line), ",") do
          [word, allowed, candidate] ->
            [
              %{
                locale: "fr",
                word: word,
                is_allowed_guess: allowed == "t",
                is_solution_candidate: candidate == "t",
                inserted_at: now
              }
            ]

          _ ->
            []
        end
      end)

    rows
    |> Enum.chunk_every(500)
    |> Enum.each(fn chunk ->
      Repo.insert_all(WordleDictionaryWord, chunk,
        on_conflict: :nothing,
        conflict_target: [:locale, :word]
      )
    end)

    IO.puts("Inserted #{length(rows)} French Wordle words.")
  else
    IO.puts("Wordle dictionary already seeded (#{existing_count} words), skipping.")
  end
else
  IO.puts("WARNING: Wordle CSV not found at #{wordle_csv}. Skipping Wordle seed.")

  IO.puts(
    "Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 5434 -U postgres adventure_time_tcg -c \"\\COPY (SELECT word, is_allowed_guess, is_solution_candidate FROM wordle_dictionary_words WHERE locale='fr' ORDER BY word) TO '/tmp/fr_words.csv' CSV HEADER\""
  )
end

bootstrap_superadmin_email =
  System.get_env("BOOTSTRAP_SUPERADMIN_EMAIL")
  |> case do
    nil -> "boomslang.a@gmail.com"
    email -> String.trim(email)
  end

if is_binary(bootstrap_superadmin_email) and bootstrap_superadmin_email != "" do
  existing_user = Repo.get_by(User, email: String.downcase(bootstrap_superadmin_email))

  attrs = %{
    email: bootstrap_superadmin_email,
    display_name: "Super Admin",
    role: :super_admin,
    access_status: :approved
  }

  case existing_user do
    nil ->
      %User{}
      |> User.registration_changeset(attrs)
      |> User.access_changeset(%{role: :super_admin, access_status: :approved})
      |> Repo.insert!()

    %User{} = user ->
      user
      |> User.registration_changeset(%{
        email: user.email,
        display_name: user.display_name || "Super Admin"
      })
      |> User.access_changeset(%{role: :super_admin, access_status: :approved})
      |> Repo.update!()
  end
end
