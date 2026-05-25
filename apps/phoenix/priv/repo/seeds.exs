alias AdventureTimeApi.Catalog.Rarity
alias AdventureTimeApi.Quests.WordleDictionaryWord
alias AdventureTimeApi.Catalog.{Card, Pack}
alias AdventureTimeApi.Accounts.User
alias AdventureTimeApi.Pvp.{AbilityDef, CardAbility}
alias AdventureTimeApi.Repo

rarities = [
  %{name: "Common", drop_rate: 60.0, color: "#9CA3AF"},
  %{name: "Uncommon", drop_rate: 25.0, color: "#10B981"},
  %{name: "Rare", drop_rate: 10.0, color: "#3B82F6"},
  %{name: "Epic", drop_rate: 1.0, color: "#8B5CF6"},
  %{name: "Legendary", drop_rate: 0.1, color: "#F59E0B"}
]

Enum.each(rarities, fn attrs ->
  %Rarity{}
  |> Rarity.changeset(attrs)
  |> Repo.insert!(on_conflict: {:replace, [:drop_rate, :color]}, conflict_target: [:name])
end)

rarity_ids =
  Rarity
  |> Repo.all()
  |> Map.new(&{&1.name, &1.id})

cards = [
  %{
    name: "Finn the Human",
    character: "Finn",
    description: "A brave hero who charges into danger with his sword ready.",
    hp: 18,
    attack: 8,
    defense: 5,
    speed: 52,
    type: "Hero",
    rarity_id: rarity_ids["Common"],
    is_featured: true,
    is_archived: false
  },
  %{
    name: "Jake the Dog",
    character: "Jake",
    description: "A stretchy partner who can adapt to almost any fight.",
    hp: 16,
    attack: 7,
    defense: 6,
    speed: 48,
    type: "Hero",
    rarity_id: rarity_ids["Common"],
    is_featured: true,
    is_archived: false
  },
  %{
    name: "Princess Bubblegum",
    character: "Princess Bubblegum",
    description: "A candy scientist who outsmarts opponents with clever plans.",
    hp: 14,
    attack: 6,
    defense: 7,
    speed: 46,
    type: "Candy",
    rarity_id: rarity_ids["Uncommon"],
    is_featured: false,
    is_archived: false
  },
  %{
    name: "Marceline",
    character: "Marceline",
    description: "A vampire rocker whose riffs hit hard and fast.",
    hp: 15,
    attack: 9,
    defense: 4,
    speed: 58,
    type: "Undead",
    rarity_id: rarity_ids["Rare"],
    is_featured: true,
    is_archived: false
  },
  %{
    name: "Ice King",
    character: "Ice King",
    description: "A chaotic wizard who brings frosty pressure to the arena.",
    hp: 17,
    attack: 7,
    defense: 5,
    speed: 42,
    type: "Ice",
    rarity_id: rarity_ids["Uncommon"],
    is_featured: false,
    is_archived: false
  },
  %{
    name: "BMO",
    character: "BMO",
    description: "A cheerful console friend whose quick thinking keeps the team steady.",
    hp: 13,
    attack: 6,
    defense: 8,
    speed: 55,
    type: "Tech",
    rarity_id: rarity_ids["Common"],
    is_featured: false,
    is_archived: false
  }
]

Enum.each(cards, fn attrs ->
  case Repo.get_by(Card, name: attrs.name) do
    nil ->
      %Card{}
      |> Card.changeset(attrs)
      |> Repo.insert!()

    %Card{} = card ->
      card
      |> Card.changeset(attrs)
      |> Repo.update!()
  end
end)

# ── Ability Defs ─────────────────────────────────────────────────────────────
ability_seeds = [
  %{
    key: "default.focused_strike",
    name: "Focused Strike",
    name_fr: "Frappe ciblée",
    description: "Deals 130% of normal damage to a single target.",
    description_fr: "Inflige 130 % des dégâts normaux à une cible.",
    type: "SKILL",
    cost: 1,
    cooldown: 2,
    once_per_match: false,
    payload: %{"damageMul" => 1.3}
  },
  %{
    key: "default.battle_cry",
    name: "Battle Cry",
    name_fr: "Cri de guerre",
    description: "Rallies inner strength, recovering 15% of max HP.",
    description_fr: "Puise dans ses forces intérieures et récupère 15 % de ses PV max.",
    type: "ULTIMATE",
    cost: 3,
    cooldown: nil,
    once_per_match: true,
    payload: %{"healPctOfMaxHp" => 0.15}
  }
]

for attrs <- ability_seeds do
  unless Repo.get_by(AbilityDef, key: attrs.key) do
    %AbilityDef{}
    |> AbilityDef.changeset(attrs)
    |> Repo.insert!()
  end
end

skill_def = Repo.get_by!(AbilityDef, key: "default.focused_strike")
ultimate_def = Repo.get_by!(AbilityDef, key: "default.battle_cry")

seed_card_names = [
  "Finn the Human",
  "Jake the Dog",
  "Princess Bubblegum",
  "Marceline",
  "Ice King",
  "BMO"
]

seed_card_ids =
  Card
  |> Repo.all()
  |> Enum.filter(&(&1.name in seed_card_names))
  |> Enum.map(& &1.id)

for card_id <- seed_card_ids do
  unless Repo.get_by(CardAbility, card_id: card_id) do
    %CardAbility{}
    |> CardAbility.changeset(%{
      card_id: card_id,
      skill_id: skill_def.id,
      ultimate_id: ultimate_def.id
    })
    |> Repo.insert!()
  end
end

starter_pack_attrs = %{
  name: "Hero Pack",
  description: "A starter booster filled with familiar heroes from Ooo.",
  card_count: 5,
  cost: 100,
  color: "#F59E0B",
  is_active: true,
  guaranteed_rarity: "Rare"
}

case Repo.get_by(Pack, name: starter_pack_attrs.name) do
  nil ->
    %Pack{}
    |> Pack.changeset(starter_pack_attrs)
    |> Repo.insert!()

  %Pack{} = pack ->
    pack
    |> Pack.changeset(starter_pack_attrs)
    |> Repo.update!()
end

# ── Wordle Dictionary ────────────────────────────────────────────────────────
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
