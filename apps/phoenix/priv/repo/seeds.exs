import Ecto.Query

alias AdventureTimeApi.Accounts.User
alias AdventureTimeApi.Catalog.{Card, ImageAsset, Pack, Rarity}
alias AdventureTimeApi.Inventory.OwnedCard
alias AdventureTimeApi.Pvp.{AbilityDef, CardAbility, Loadout, Match}
alias AdventureTimeApi.Quests.WordleDictionaryWord
alias AdventureTimeApi.Repo

defmodule AdventureTimeApi.Seeds.PvpCatalog do
  import Ecto.Query

  alias AdventureTimeApi.Catalog.{Card, ImageAsset, Pack, Rarity}
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Pvp.{AbilityDef, CardAbility, Loadout, Match}
  alias AdventureTimeApi.Repo

  @seed_path Path.expand("seed_data/pvp_seed_catalog.json", __DIR__)
  @seed_images_dir Path.expand("seed_data/pvp_card_images", __DIR__)

  @placeholder_pack %{
    name: "Hero Pack",
    description: "A starter booster filled with familiar heroes from Ooo."
  }

  @placeholder_ability_keys ["default.focused_strike", "default.battle_cry"]
  @e2e_card_name_prefix "E2E "

  @placeholder_cards [
    %{
      name: "Finn the Human",
      character: "Finn",
      description: "A brave hero who charges into danger with his sword ready."
    },
    %{
      name: "Jake the Dog",
      character: "Jake",
      description: "A stretchy partner who can adapt to almost any fight."
    },
    %{
      name: "Princess Bubblegum",
      character: "Princess Bubblegum",
      description: "A candy scientist who outsmarts opponents with clever plans."
    },
    %{
      name: "Marceline",
      character: "Marceline",
      description: "A vampire rocker whose riffs hit hard and fast."
    },
    %{
      name: "Ice King",
      character: "Ice King",
      description: "A chaotic wizard who brings frosty pressure to the arena."
    },
    %{
      name: "BMO",
      character: "BMO",
      description: "A cheerful console friend whose quick thinking keeps the team steady."
    }
  ]

  def run! do
    catalog = load_seed_catalog!()

    cleanup_placeholder_seed!()
    ensure_seed_bucket!()

    rarity_ids = upsert_rarities!(catalog["rarities"] || [])

    Enum.each(catalog["packs"] || [], &upsert_pack!/1)

    Enum.each(catalog["cards"] || [], fn row ->
      upsert_seed_card_bundle!(row, rarity_ids)
    end)

    IO.puts(
      "Seeded #{length(catalog["cards"] || [])} live PvP cards, #{length(catalog["packs"] || [])} packs, and #{length(catalog["rarities"] || [])} rarities."
    )
  end

  defp load_seed_catalog! do
    @seed_path
    |> File.read!()
    |> Jason.decode!()
  end

  defp cleanup_placeholder_seed! do
    placeholder_card_ids =
      Enum.flat_map(@placeholder_cards, fn attrs ->
        Card
        |> where(
          [card],
          card.name == ^attrs.name and
            card.character == ^attrs.character and
            card.description == ^attrs.description
        )
        |> Repo.all()
        |> Enum.map(& &1.id)
      end)
      |> Enum.uniq()

    e2e_card_ids =
      Card
      |> where([card], like(card.name, ^"#{@e2e_card_name_prefix}%"))
      |> Repo.all()
      |> Enum.map(& &1.id)

    cleanup_cards!(Enum.uniq(placeholder_card_ids ++ e2e_card_ids))

    from(pack in Pack,
      where:
        pack.name == ^@placeholder_pack.name and
          pack.description == ^@placeholder_pack.description
    )
    |> Repo.delete_all()

    from(ability_def in AbilityDef, where: ability_def.key in ^@placeholder_ability_keys)
    |> Repo.delete_all()
  end

  defp cleanup_cards!([]), do: :ok

  defp cleanup_cards!(card_ids) do
    image_asset_ids =
      Card
      |> where([card], card.id in ^card_ids and not is_nil(card.image_asset_id))
      |> Repo.all()
      |> Enum.map(& &1.image_asset_id)
      |> Enum.uniq()

    loadout_ids =
      Loadout
      |> Repo.all()
      |> Enum.filter(&overlap?(&1.card_ids, card_ids))
      |> Enum.map(& &1.id)

    if loadout_ids != [] do
      from(loadout in Loadout, where: loadout.id in ^loadout_ids)
      |> Repo.delete_all()
    end

    match_ids =
      Match
      |> Repo.all()
      |> Enum.filter(fn match ->
        overlap?(match.inviter_card_ids, card_ids) or overlap?(match.invitee_card_ids, card_ids)
      end)
      |> Enum.map(& &1.id)

    if match_ids != [] do
      from(match in Match, where: match.id in ^match_ids)
      |> Repo.delete_all()
    end

    from(owned_card in OwnedCard, where: owned_card.card_id in ^card_ids)
    |> Repo.delete_all()

    from(card_ability in CardAbility, where: card_ability.card_id in ^card_ids)
    |> Repo.delete_all()

    from(card in Card, where: card.id in ^card_ids)
    |> Repo.delete_all()

    if image_asset_ids != [] do
      from(image_asset in ImageAsset, where: image_asset.id in ^image_asset_ids)
      |> Repo.delete_all()
    end
  end

  defp overlap?(nil, _card_ids), do: false

  defp overlap?(existing_ids, card_ids) when is_list(existing_ids) do
    blocked = MapSet.new(card_ids)
    Enum.any?(existing_ids, &MapSet.member?(blocked, &1))
  end

  defp upsert_rarities!(rarities) do
    Enum.reduce(rarities, %{}, fn rarity, acc ->
      attrs = %{
        name: rarity["name"],
        drop_rate: rarity["dropRate"] * 1.0,
        color: rarity["color"]
      }

      record =
        Repo.get(Rarity, rarity["id"]) ||
          Repo.get_by(Rarity, name: attrs.name)

      seeded =
        case record do
          nil ->
            %Rarity{id: rarity["id"]}
            |> Rarity.changeset(attrs)
            |> Repo.insert!()

          %Rarity{} = existing ->
            existing
            |> Rarity.changeset(attrs)
            |> Repo.update!()
        end

      Map.put(acc, attrs.name, seeded.id)
    end)
  end

  defp upsert_pack!(pack) do
    attrs = %{
      name: pack["name"],
      description: pack["description"],
      card_count: pack["cardCount"],
      cost: pack["cost"],
      color: pack["color"],
      is_active: pack["isActive"],
      guaranteed_rarity: pack["guaranteedRarity"]
    }

    record =
      Repo.get(Pack, pack["id"]) ||
        Repo.get_by(Pack, name: attrs.name)

    case record do
      nil ->
        %Pack{id: pack["id"]}
        |> Pack.changeset(attrs)
        |> Repo.insert!()

      %Pack{} = existing ->
        existing
        |> Pack.changeset(attrs)
        |> Repo.update!()
    end
  end

  defp upsert_seed_card_bundle!(row, rarity_ids) do
    image_asset = upsert_image_asset!(row["imageAsset"])
    card = upsert_card!(row["card"], rarity_ids, image_asset.id)
    ability_ids = upsert_abilities!(row["abilities"] || %{})
    upsert_card_ability!(row["cardAbility"], card.id, ability_ids)
  end

  defp upsert_image_asset!(image_asset) do
    image_binary =
      @seed_images_dir
      |> Path.join(image_asset["seedFile"])
      |> File.read!()

    upload_object!(image_asset["objectKey"], image_binary, image_asset["mimeType"])

    attrs = %{
      kind: String.to_existing_atom(image_asset["kind"]),
      mime_type: image_asset["mimeType"],
      object_key: image_asset["objectKey"],
      placeholder_svg: image_asset["placeholderSvg"]
    }

    record =
      Repo.get(ImageAsset, image_asset["id"]) ||
        Repo.get_by(ImageAsset, object_key: image_asset["objectKey"])

    case record do
      nil ->
        %ImageAsset{id: image_asset["id"]}
        |> ImageAsset.changeset(attrs)
        |> Repo.insert!()

      %ImageAsset{} = existing ->
        existing
        |> ImageAsset.changeset(attrs)
        |> Repo.update!()
    end
  end

  defp upsert_card!(card, rarity_ids, image_asset_id) do
    attrs = %{
      name: card["name"],
      character: card["character"],
      description: card["description"],
      hp: card["hp"],
      attack: card["attack"],
      defense: card["defense"],
      speed: card["speed"],
      type: card["type"],
      rarity_id: Map.fetch!(rarity_ids, card["rarity"]["name"]),
      image_asset_id: image_asset_id,
      is_featured: card["isFeatured"],
      is_archived: card["isArchived"]
    }

    record =
      Repo.get(Card, card["id"]) ||
        Repo.get_by(Card, name: attrs.name, character: attrs.character)

    case record do
      nil ->
        %Card{id: card["id"]}
        |> Card.changeset(attrs)
        |> Repo.insert!()

      %Card{} = existing ->
        existing
        |> Card.changeset(attrs)
        |> Repo.update!()
    end
  end

  defp upsert_abilities!(abilities) do
    Enum.reduce(["passive", "skill", "ultimate"], %{}, fn slot, acc ->
      case abilities[slot] do
        nil ->
          Map.put(acc, String.to_atom(slot), nil)

        ability ->
          attrs = %{
            key: ability["key"],
            name: ability["name"],
            name_fr: ability["nameFr"],
            description: ability["description"],
            description_fr: ability["descriptionFr"],
            type: ability["type"],
            cost: ability["cost"] || 0,
            cooldown: ability["cooldown"],
            once_per_match: ability["oncePerMatch"] || false,
            payload: ability["payload"] || %{}
          }

          record =
            Repo.get(AbilityDef, ability["id"]) ||
              Repo.get_by(AbilityDef, key: attrs.key)

          seeded =
            case record do
              nil ->
                %AbilityDef{id: ability["id"]}
                |> AbilityDef.changeset(attrs)
                |> Repo.insert!()

              %AbilityDef{} = existing ->
                existing
                |> AbilityDef.changeset(attrs)
                |> Repo.update!()
            end

          Map.put(acc, String.to_atom(slot), seeded.id)
      end
    end)
  end

  defp upsert_card_ability!(card_ability, card_id, ability_ids) do
    attrs = %{
      card_id: card_id,
      passive_id: ability_ids.passive,
      skill_id: ability_ids.skill,
      ultimate_id: ability_ids.ultimate
    }

    record =
      Repo.get(CardAbility, card_ability["id"]) ||
        Repo.get_by(CardAbility, card_id: card_id)

    case record do
      nil ->
        %CardAbility{id: card_ability["id"]}
        |> CardAbility.changeset(attrs)
        |> Repo.insert!()

      %CardAbility{} = existing ->
        existing
        |> CardAbility.changeset(attrs)
        |> Repo.update!()
    end
  end

  defp upload_object!(object_key, binary_data, mime_type) do
    %{base_url: base_url, bucket: bucket, access_key: access_key, secret_key: secret_key} =
      object_storage_config()

    url = object_url(base_url, bucket, object_key)

    case signed_request(:put, url, binary_data, access_key, secret_key, [
           {"content-type", mime_type},
           {"cache-control", "private, max-age=31536000, immutable"},
           {"x-amz-meta-kind", "cardIllustration"}
         ]) do
      {:ok, %{status: status}} when status in [200, 201] ->
        :ok

      {:ok, %{status: status, body: body}} ->
        raise "seed image upload failed with status #{status}: #{inspect(body)}"

      {:error, reason} ->
        raise "seed image upload failed: #{inspect(reason)}"
    end
  end

  defp ensure_seed_bucket! do
    %{base_url: base_url, bucket: bucket, access_key: access_key, secret_key: secret_key} =
      object_storage_config()

    bucket_url = String.trim_trailing(base_url, "/") <> "/" <> bucket

    case signed_request(:put, bucket_url, "", access_key, secret_key, []) do
      {:ok, %{status: status}} when status in [200, 201, 204, 409] ->
        :ok

      {:ok, %{status: status, body: body}} ->
        raise "seed bucket creation failed with status #{status}: #{inspect(body)}"

      {:error, reason} ->
        raise "seed bucket creation failed: #{inspect(reason)}"
    end
  end

  defp object_storage_config do
    config =
      Application.get_env(:adventure_time_api, AdventureTimeApi.Media, [])
      |> Enum.into(%{})

    base_url =
      System.get_env("MINIO_BASE_URL") ||
        config[:base_url] ||
        minio_base_url_from_parts()

    bucket = System.get_env("MINIO_BUCKET") || config[:bucket]
    access_key = System.get_env("MINIO_ACCESS_KEY") || config[:access_key]
    secret_key = System.get_env("MINIO_SECRET_KEY") || config[:secret_key]

    unless is_binary(base_url) and base_url != "" do
      raise "MinIO base URL is not configured for seeds"
    end

    unless is_binary(bucket) and bucket != "" do
      raise "MinIO bucket is not configured for seeds"
    end

    unless is_binary(access_key) and access_key != "" do
      raise "MinIO access key is not configured for seeds"
    end

    unless is_binary(secret_key) and secret_key != "" do
      raise "MinIO secret key is not configured for seeds"
    end

    %{
      base_url: base_url,
      bucket: bucket,
      access_key: access_key,
      secret_key: secret_key
    }
  end

  defp minio_base_url_from_parts do
    case {System.get_env("MINIO_ENDPOINT"), System.get_env("MINIO_PORT")} do
      {endpoint, port}
      when is_binary(endpoint) and endpoint != "" and is_binary(port) and port != "" ->
        scheme = if System.get_env("MINIO_USE_SSL") in ~w(true 1), do: "https", else: "http"
        "#{scheme}://#{endpoint}:#{port}"

      _ ->
        nil
    end
  end

  defp object_url(base_url, bucket, object_key) do
    encoded_key =
      object_key
      |> String.split("/", trim: true)
      |> Enum.map(fn segment -> URI.encode(segment, &URI.char_unreserved?/1) end)
      |> Enum.join("/")

    String.trim_trailing(base_url, "/") <> "/" <> bucket <> "/" <> encoded_key
  end

  defp signed_request(method, url, body, access_key, secret_key, extra_headers) do
    uri = URI.parse(url)
    payload_hash = sha256_hex(body)
    amz_date = amz_now()
    date_stamp = String.slice(amz_date, 0, 8)
    host = host_header(uri)

    headers =
      [
        {"host", host},
        {"x-amz-content-sha256", payload_hash},
        {"x-amz-date", amz_date}
      ] ++ extra_headers

    canonical_request =
      [
        method |> Atom.to_string() |> String.upcase(),
        canonical_uri(uri),
        canonical_query(uri),
        canonical_headers(headers),
        "",
        signed_headers(headers),
        payload_hash
      ]
      |> Enum.join("\n")

    credential_scope = Enum.join([date_stamp, "us-east-1", "s3", "aws4_request"], "/")

    string_to_sign =
      [
        "AWS4-HMAC-SHA256",
        amz_date,
        credential_scope,
        sha256_hex(canonical_request)
      ]
      |> Enum.join("\n")

    signature =
      signing_key(secret_key, date_stamp)
      |> hmac(string_to_sign)
      |> Base.encode16(case: :lower)

    authorization =
      "AWS4-HMAC-SHA256 Credential=#{access_key}/#{credential_scope}, SignedHeaders=#{signed_headers(headers)}, Signature=#{signature}"

    Req.request(
      method: method,
      url: url,
      body: body,
      headers: headers ++ [{"authorization", authorization}]
    )
  end

  defp canonical_uri(%URI{path: path}) do
    path
    |> to_string()
    |> String.split("/", trim: false)
    |> Enum.map(fn segment -> URI.encode(segment, &URI.char_unreserved?/1) end)
    |> Enum.join("/")
    |> case do
      "" -> "/"
      encoded -> encoded
    end
  end

  defp canonical_query(%URI{query: nil}), do: ""

  defp canonical_query(%URI{query: query}) do
    query
    |> URI.decode_query()
    |> Enum.sort_by(fn {key, value} -> {key, value} end)
    |> Enum.map_join("&", fn {key, value} ->
      URI.encode_www_form(key) <> "=" <> URI.encode_www_form(value)
    end)
  end

  defp canonical_headers(headers) do
    headers
    |> Enum.map(fn {key, value} ->
      normalized = value |> to_string() |> String.trim() |> String.replace(~r/\s+/, " ")
      {String.downcase(key), normalized}
    end)
    |> Enum.sort_by(fn {key, _value} -> key end)
    |> Enum.map_join("\n", fn {key, value} -> "#{key}:#{value}" end)
  end

  defp signed_headers(headers) do
    headers
    |> Enum.map(fn {key, _value} -> String.downcase(key) end)
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.join(";")
  end

  defp host_header(%URI{host: host, port: port, scheme: scheme}) do
    default_port = if scheme == "https", do: 443, else: 80

    case port do
      nil -> host
      ^default_port -> host
      _ -> "#{host}:#{port}"
    end
  end

  defp amz_now do
    DateTime.utc_now()
    |> DateTime.truncate(:second)
    |> Calendar.strftime("%Y%m%dT%H%M%SZ")
  end

  defp signing_key(secret_key, date_stamp) do
    ("AWS4" <> secret_key)
    |> hmac(date_stamp)
    |> hmac("us-east-1")
    |> hmac("s3")
    |> hmac("aws4_request")
  end

  defp hmac(key, data), do: :crypto.mac(:hmac, :sha256, key, data)
  defp sha256_hex(data), do: :crypto.hash(:sha256, data) |> Base.encode16(case: :lower)
end

AdventureTimeApi.Seeds.PvpCatalog.run!()

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
