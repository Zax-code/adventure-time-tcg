defmodule AdventureTimeApi.PwaImport do
  @moduledoc false

  alias AdventureTimeApi.Accounts.{
    EmailAccessRequest,
    EmailCredential,
    EmailVerificationCode,
    User
  }

  alias AdventureTimeApi.Catalog.{Card, CardType, ImageAsset, Pack, Rarity}
  alias AdventureTimeApi.Health.StepSnapshot
  alias AdventureTimeApi.Inventory.OwnedCard
  alias AdventureTimeApi.Pvp.{AbilityDef, CardAbility}

  alias AdventureTimeApi.Quests.{
    DailyQuest,
    SpeedCalculusDailyRun,
    WordleDailyAttempt,
    WordleDictionaryWord
  }

  alias AdventureTimeApi.Repo
  alias AdventureTimeApi.Social.CardGift

  @gift_ttl_days 7
  @default_source_env_path "/home/zax/adventure-time-tcg/.env.postgres.production.local"
  @default_target_env_path "/home/zax/adventure-time-tcg/apps/phoenix/.env"
  @default_report_dir "/home/zax/adventure-time-tcg/.migration-reports"
  @managed_card_prefix "/api/media/card/"
  @managed_profile_prefix "/api/media/profile/"

  @source_tables [
    allowed_emails: ~s("AllowedEmail"),
    email_access_requests: ~s("EmailAccessRequest"),
    email_verification_codes: ~s("EmailVerificationCode"),
    users: ~s("User"),
    user_settings: ~s("UserSettings"),
    fitbit_accounts: ~s("FitbitAccount"),
    email_credentials: ~s("EmailAuthCredential"),
    image_assets: ~s("ImageAsset"),
    rarities: ~s("Rarity"),
    cards: ~s("Card"),
    packs: ~s("Pack"),
    owned_cards: ~s("OwnedCard"),
    abilities: ~s("AbilityDef"),
    card_abilities: ~s("CardAbility"),
    card_gifts: ~s("CardGift"),
    daily_quests: ~s("DailyQuest"),
    wordle_attempts: ~s("WordleDailyAttempt"),
    speed_runs: ~s("SpeedCalculusDailyRun"),
    wordle_dictionary_words: ~s("WordleDictionaryWord"),
    pvp_matches: ~s("PvpMatch"),
    pvp_loadouts: ~s("PvpLoadout")
  ]

  @target_verify_tables [
    users: "users",
    email_auth_credentials: "email_auth_credentials",
    email_access_requests: "email_access_requests",
    email_verification_codes: "email_verification_codes",
    image_assets: "image_assets",
    rarities: "rarities",
    cards: "cards",
    packs: "packs",
    owned_cards: "owned_cards",
    ability_defs: "ability_defs",
    card_abilities: "card_abilities",
    card_gifts: "card_gifts",
    step_snapshots: "step_snapshots",
    daily_quests: "daily_quests",
    wordle_daily_attempts: "wordle_daily_attempts",
    speed_calculus_daily_runs: "speed_calculus_daily_runs",
    wordle_dictionary_words: "wordle_dictionary_words",
    pvp_matches: "pvp_matches",
    pvp_match_events: "pvp_match_events",
    pvp_match_snapshots: "pvp_match_snapshots",
    pvp_loadouts: "pvp_loadouts"
  ]

  def default_source_env_path, do: @default_source_env_path
  def default_target_env_path, do: @default_target_env_path
  def default_report_dir, do: @default_report_dir

  def audit(opts \\ []) do
    with_context(opts, fn context ->
      report = build_report(context, :audit)
      write_report!(report, context.report_dir, "audit")
      report
    end)
  end

  def apply(opts \\ []) do
    with_context(opts, fn context ->
      report = build_report(context, :apply)
      target_storage = target_storage_config(context.target_env)
      source_storage = source_storage_config(context.source_env)

      reset_target!(target_storage)
      upload_assets!(context.plan.image_uploads, source_storage, target_storage)
      import_plan!(context.plan)

      verification = verify_plan!(context.plan)
      final_report = Map.put(report, :verification, verification)
      write_report!(final_report, context.report_dir, "apply")
      final_report
    end)
  end

  def verify(opts \\ []) do
    with_context(opts, fn context ->
      verification = verify_plan!(context.plan)
      report = build_report(context, :verify) |> Map.put(:verification, verification)
      write_report!(report, context.report_dir, "verify")
      report
    end)
  end

  def reset(opts \\ []) do
    target_env = opts[:target_env] || @default_target_env_path
    target_storage = target_env |> parse_env_file!() |> target_storage_config()
    reset_target!(target_storage)
    %{status: :ok}
  end

  defp with_context(opts, fun) do
    source_env_path = opts[:source_env] || @default_source_env_path
    target_env_path = opts[:target_env] || @default_target_env_path
    report_dir = opts[:report_dir] || @default_report_dir

    source_env = parse_env_file!(source_env_path)
    target_env = parse_env_file!(target_env_path)
    source_config = source_db_config(source_env)

    {:ok, source_conn} = Postgrex.start_link(source_config)

    try do
      data = load_source_data!(source_conn)
      plan = build_plan(data)

      fun.(%{
        source_env: source_env,
        target_env: target_env,
        report_dir: report_dir,
        data: data,
        plan: plan
      })
    after
      GenServer.stop(source_conn)
    end
  end

  defp build_report(context, mode) do
    %{
      mode: mode,
      generated_at: DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601(),
      source_env_path: context.source_env["__path__"],
      target_env_path: context.target_env["__path__"],
      source_counts: source_counts(context.data),
      planned_counts: context.plan.counts,
      target_counts_before: load_target_counts(),
      warnings: context.plan.warnings,
      skipped_media: context.plan.skipped_media,
      synthetic_access_requests: context.plan.synthetic_access_requests,
      ignored_pvp_counts: context.plan.ignored_pvp_counts
    }
  end

  defp load_source_data!(conn) do
    %{
      allowed_emails: query_rows!(conn, allowed_emails_sql()),
      email_access_requests: query_rows!(conn, email_access_requests_sql()),
      email_verification_codes: query_rows!(conn, email_verification_codes_sql()),
      users: query_rows!(conn, users_sql()),
      user_settings: query_rows!(conn, user_settings_sql()),
      fitbit_accounts: query_rows!(conn, fitbit_accounts_sql()),
      email_credentials: query_rows!(conn, email_credentials_sql()),
      image_assets: query_rows!(conn, image_assets_sql()),
      rarities: query_rows!(conn, rarities_sql()),
      cards: query_rows!(conn, cards_sql()),
      packs: query_rows!(conn, packs_sql()),
      owned_cards: query_rows!(conn, owned_cards_sql()),
      abilities: query_rows!(conn, abilities_sql()),
      card_abilities: query_rows!(conn, card_abilities_sql()),
      card_gifts: query_rows!(conn, card_gifts_sql()),
      daily_quests: query_rows!(conn, daily_quests_sql()),
      wordle_attempts: query_rows!(conn, wordle_attempts_sql()),
      speed_runs: query_rows!(conn, speed_runs_sql()),
      wordle_dictionary_words: query_rows!(conn, wordle_dictionary_words_sql()),
      pvp_matches: query_rows!(conn, count_sql(@source_tables[:pvp_matches])),
      pvp_loadouts: query_rows!(conn, count_sql(@source_tables[:pvp_loadouts]))
    }
  end

  defp build_plan(data) do
    settings_by_user_id = Map.new(data.user_settings, &{&1.user_id, &1})
    fitbit_user_ids = MapSet.new(Enum.map(data.fitbit_accounts, & &1.user_id))
    allowed_by_email = Map.new(data.allowed_emails, &{normalize_email(&1.email), &1})
    source_image_assets = Map.new(data.image_assets, &{&1.id, &1})

    user_avatar_assets =
      build_user_avatar_assets(
        data.users,
        settings_by_user_id,
        source_image_assets
      )

    card_image_assets = build_card_image_assets(data.cards, source_image_assets)

    image_assets =
      (user_avatar_assets ++ card_image_assets)
      |> Enum.uniq_by(& &1.id)

    image_asset_map = Map.new(image_assets, &{&1.source_id, &1.id})

    avatar_asset_by_user_id =
      image_assets
      |> Enum.filter(&(&1.kind == :profile))
      |> Map.new(&{&1.owner_id, &1.id})

    rarity_map = Map.new(data.rarities, &{&1.id, map_id(:rarity, &1.id)})
    card_map = Map.new(data.cards, &{&1.id, map_id(:card, &1.id)})
    user_map = Map.new(data.users, &{&1.id, map_id(:user, &1.id)})
    pack_map = Map.new(data.packs, &{&1.id, map_id(:pack, &1.id)})
    ability_map = Map.new(data.abilities, &{&1.id, map_id(:ability, &1.id)})

    users =
      Enum.map(data.users, fn row ->
        settings = Map.get(settings_by_user_id, row.id)
        allowed = Map.get(allowed_by_email, normalize_email(row.email))

        display_name =
          present_string(settings && settings.display_name) || present_string(row.name)

        preferred_language = normalize_locale(settings && settings.language)
        avatar_asset_id = Map.get(avatar_asset_by_user_id, row.id)

        %{
          id: user_map[row.id],
          email: normalize_email(row.email),
          display_name: display_name,
          coins: row.coins || 0,
          dust: row.dust || 0,
          preferred_language: preferred_language,
          last_daily_claim: row.last_daily_claim,
          avatar_asset_id: avatar_asset_id,
          role: role_for_allowed_email(allowed),
          access_status: :approved,
          preferred_step_source: preferred_step_source(row.id, fitbit_user_ids),
          inserted_at: row.created_at,
          updated_at: row.updated_at
        }
      end)

    email_credentials =
      Enum.map(data.email_credentials, fn row ->
        %{
          id: map_id(:email_credential, row.id),
          user_id: user_map[row.user_id],
          password_hash: row.password_hash,
          email_verified_at: row.email_verified_at,
          inserted_at: row.created_at,
          updated_at: row.updated_at
        }
      end)

    email_access_requests = build_email_access_requests(data)

    email_verification_codes =
      Enum.flat_map(data.email_verification_codes, fn row ->
        case normalize_verification_purpose(row.purpose) do
          nil ->
            []

          purpose ->
            [
              %{
                id: map_id(:email_verification_code, row.id),
                email: normalize_email(row.email),
                code_hash: row.code_hash,
                purpose: purpose,
                expires_at: row.expires_at,
                used_at: row.used_at,
                attempt_count: 0,
                inserted_at: row.created_at,
                updated_at: row.created_at
              }
            ]
        end
      end)

    rarities =
      Enum.map(data.rarities, fn row ->
        %{
          id: rarity_map[row.id],
          name: row.name,
          drop_rate: row.drop_rate,
          color: row.color,
          inserted_at: row.created_at || DateTime.utc_now() |> DateTime.truncate(:second)
        }
      end)

    cards =
      Enum.map(data.cards, fn row ->
        %{
          id: card_map[row.id],
          name: row.name,
          character: row.character,
          description: row.description,
          hp: row.hp,
          attack: row.attack,
          defense: row.defense,
          speed: row.speed || 40,
          type: CardType.canonicalize!(row.type),
          rarity_id: rarity_map[row.rarity_id],
          image_asset_id: image_asset_id_for_card(row.image_url, image_asset_map),
          is_featured: row.is_featured,
          is_archived: row.is_archived,
          inserted_at: row.created_at,
          updated_at: row.updated_at
        }
      end)

    packs =
      Enum.map(data.packs, fn row ->
        %{
          id: pack_map[row.id],
          name: row.name,
          description: row.description,
          card_count: row.card_count,
          cost: row.cost,
          color: row.color,
          is_active: row.is_active,
          guaranteed_rarity: row.guaranteed_rarity,
          inserted_at: row.created_at || DateTime.utc_now() |> DateTime.truncate(:second)
        }
      end)

    abilities =
      Enum.map(data.abilities, fn row ->
        %{
          id: ability_map[row.id],
          key: row.key,
          name: row.name,
          name_fr: row.name_fr,
          description: row.description,
          description_fr: row.description_fr,
          type: row.type,
          cost: row.cost || 0,
          cooldown: row.cooldown,
          once_per_match: row.once_per_match,
          payload: decode_json_map(row.payload),
          inserted_at: datetime_to_naive(row.created_at),
          updated_at: datetime_to_naive(row.updated_at || row.created_at)
        }
      end)

    card_abilities =
      Enum.map(data.card_abilities, fn row ->
        %{
          id: map_id(:card_ability, row.id),
          card_id: card_map[row.card_id],
          passive_id: maybe_mapped_id(row.passive_id, ability_map),
          skill_id: maybe_mapped_id(row.skill_id, ability_map),
          ultimate_id: maybe_mapped_id(row.ultimate_id, ability_map),
          inserted_at: datetime_to_naive(row.created_at),
          updated_at: datetime_to_naive(row.created_at)
        }
      end)

    owned_cards =
      Enum.map(data.owned_cards, fn row ->
        %{
          id: map_id(:owned_card, row.id),
          user_id: user_map[row.user_id],
          card_id: card_map[row.card_id],
          quantity: row.quantity,
          obtained_at: row.obtained_at,
          inserted_at: row.obtained_at
        }
      end)

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    card_gifts =
      Enum.map(data.card_gifts, fn row ->
        expires_at =
          if row.status == "pending",
            do: DateTime.add(row.created_at, @gift_ttl_days * 86_400, :second),
            else: nil

        status = normalize_gift_status(row.status, expires_at, now)
        updated_at = row.responded_at || row.created_at

        %{
          id: map_id(:card_gift, row.id),
          card_id: card_map[row.card_id],
          from_user_id: user_map[row.from_user_id],
          to_user_id: user_map[row.to_user_id],
          quantity: row.quantity,
          message: row.message,
          status: status,
          expires_at: if(status in [:pending, :expired], do: expires_at, else: nil),
          inserted_at: row.created_at,
          updated_at: updated_at
        }
      end)

    daily_quests =
      Enum.map(data.daily_quests, fn row ->
        %{
          id: map_id(:daily_quest, row.id),
          user_id: user_map[row.user_id],
          date: parse_date!(row.date),
          quest_type: row.quest_type,
          target: row.target,
          reward: row.reward,
          progress: row.progress,
          completed: row.completed,
          claimed: row.claimed,
          completed_at: row.completed_at,
          claimed_at: row.claimed_at,
          reset_by_user_id: maybe_mapped_id(row.reset_by_user_id, user_map),
          inserted_at: row.created_at,
          updated_at: row.updated_at
        }
      end)

    wordle_attempts =
      Enum.map(data.wordle_attempts, fn row ->
        %{
          id: map_id(:wordle_attempt, row.id),
          user_id: user_map[row.user_id],
          date: parse_date!(row.date),
          attempt: row.attempt,
          guess: row.guess,
          evaluation: decode_json_list(row.evaluation),
          solved: row.solved,
          inserted_at: row.created_at
        }
      end)

    speed_runs =
      Enum.map(data.speed_runs, fn row ->
        %{
          id: map_id(:speed_run, row.id),
          user_id: user_map[row.user_id],
          date: parse_date!(row.date),
          run_number: row.run_number,
          seed: row.seed,
          answers: decode_json_int_list(row.answers_json),
          status: normalize_speed_status(row.status),
          score: row.score,
          reward: 0,
          started_at: row.started_at,
          finished_at: row.finished_at,
          pause_expires_at: row.pause_until,
          play_deadline_at: add_seconds(row.started_at, 35),
          manual_paused_at: nil,
          inserted_at: row.created_at
        }
      end)

    wordle_dictionary_words =
      Enum.map(data.wordle_dictionary_words, fn row ->
        %{
          id: map_id(:wordle_dictionary_word, row.id),
          locale: row.locale,
          word: row.word,
          is_allowed_guess: row.is_allowed_guess,
          is_solution_candidate: row.is_solution_candidate,
          inserted_at: DateTime.utc_now() |> DateTime.truncate(:second)
        }
      end)

    skipped_media =
      (Enum.flat_map(user_avatar_assets, &List.wrap(&1.skipped)) ++
         Enum.flat_map(card_image_assets, &List.wrap(&1.skipped)))
      |> Enum.reject(&is_nil/1)

    synthetic_access_requests =
      email_access_requests
      |> Enum.count(&(&1.synthetic == true))

    %{
      rows: %{
        users: users,
        email_credentials: email_credentials,
        email_access_requests: Enum.map(email_access_requests, &Map.delete(&1, :synthetic)),
        email_verification_codes: email_verification_codes,
        image_assets:
          Enum.map(
            image_assets,
            &Map.take(&1, [:id, :kind, :mime_type, :object_key, :placeholder_svg, :inserted_at])
          ),
        rarities: rarities,
        cards: cards,
        packs: packs,
        abilities: abilities,
        card_abilities: card_abilities,
        owned_cards: owned_cards,
        card_gifts: card_gifts,
        step_snapshots: [],
        daily_quests: daily_quests,
        wordle_attempts: wordle_attempts,
        speed_runs: speed_runs,
        wordle_dictionary_words: wordle_dictionary_words
      },
      image_uploads:
        Enum.map(image_assets, &Map.take(&1, [:id, :kind, :mime_type, :object_key, :source])),
      counts: %{
        users: length(users),
        email_auth_credentials: length(email_credentials),
        email_access_requests: length(email_access_requests),
        email_verification_codes: length(email_verification_codes),
        image_assets: length(image_assets),
        rarities: length(rarities),
        cards: length(cards),
        packs: length(packs),
        ability_defs: length(abilities),
        card_abilities: length(card_abilities),
        owned_cards: length(owned_cards),
        card_gifts: length(card_gifts),
        step_snapshots: 0,
        daily_quests: length(daily_quests),
        wordle_daily_attempts: length(wordle_attempts),
        speed_calculus_daily_runs: length(speed_runs),
        wordle_dictionary_words: length(wordle_dictionary_words),
        pvp_matches: 0,
        pvp_match_events: 0,
        pvp_match_snapshots: 0,
        pvp_loadouts: 0
      },
      warnings: build_warnings(data, image_assets),
      skipped_media: skipped_media,
      synthetic_access_requests: synthetic_access_requests,
      ignored_pvp_counts: %{
        pvp_matches: source_count(data.pvp_matches),
        pvp_loadouts: source_count(data.pvp_loadouts)
      }
    }
  end

  defp build_email_access_requests(data) do
    source_requests =
      Enum.map(data.email_access_requests, fn row ->
        %{
          id: map_id(:email_access_request, row.id),
          email: normalize_email(row.email),
          requested_locale: normalize_locale(row.requested_locale),
          status: normalize_request_status(row.status),
          reviewed_by: row.reviewed_by,
          reviewed_at: row.reviewed_at,
          inserted_at: row.created_at,
          updated_at: row.updated_at,
          synthetic: false
        }
      end)

    user_emails = MapSet.new(Enum.map(data.users, &normalize_email(&1.email)))
    existing_request_emails = MapSet.new(Enum.map(source_requests, & &1.email))

    synthetic_requests =
      data.allowed_emails
      |> Enum.reject(fn row ->
        email = normalize_email(row.email)
        MapSet.member?(user_emails, email) or MapSet.member?(existing_request_emails, email)
      end)
      |> Enum.map(fn row ->
        %{
          id: map_id(:synthetic_access_request, row.id),
          email: normalize_email(row.email),
          requested_locale: :en,
          status: :approved,
          reviewed_by: row.added_by,
          reviewed_at: row.created_at,
          inserted_at: row.created_at,
          updated_at: row.created_at,
          synthetic: true
        }
      end)

    source_requests ++ synthetic_requests
  end

  defp build_user_avatar_assets(users, settings_by_user_id, source_image_assets) do
    latest_profile_assets_by_user_id =
      source_image_assets
      |> Map.values()
      |> Enum.filter(
        &((&1.kind == "profile" and present_string(&1.user_id)) && ready_object_asset?(&1))
      )
      |> Enum.group_by(& &1.user_id)
      |> Map.new(fn {user_id, rows} ->
        latest = Enum.max_by(rows, & &1.created_at, DateTime)
        {user_id, latest}
      end)

    Enum.flat_map(users, fn user ->
      settings = Map.get(settings_by_user_id, user.id)

      case choose_avatar_source(
             user,
             settings,
             source_image_assets,
             latest_profile_assets_by_user_id
           ) do
        nil ->
          []

        source ->
          [build_image_asset_entry(:profile, user.id, source)]
      end
    end)
  end

  defp build_card_image_assets(cards, source_image_assets) do
    Enum.flat_map(cards, fn card ->
      case parse_managed_asset_id(card.image_url, @managed_card_prefix) do
        nil ->
          [
            %{
              id: map_id(:card_image_asset_missing, card.id),
              source_id: "missing-card-asset:" <> to_string(card.id),
              kind: :card,
              mime_type: "image/svg+xml",
              object_key: nil,
              placeholder_svg: nil,
              inserted_at: card.created_at,
              source: %{type: :missing},
              skipped: %{
                kind: "card",
                sourceId: card.id,
                reason: "unmanaged_image_url",
                imageUrl: card.image_url
              }
            }
          ]

        image_asset_id ->
          case Map.get(source_image_assets, image_asset_id) do
            nil ->
              [
                %{
                  id: map_id(:card_image_asset_missing, card.id),
                  source_id: image_asset_id,
                  kind: :card,
                  mime_type: "image/svg+xml",
                  object_key: nil,
                  placeholder_svg: nil,
                  inserted_at: card.created_at,
                  source: %{type: :missing},
                  skipped: %{
                    kind: "card",
                    sourceId: card.id,
                    reason: "source_image_asset_missing",
                    imageAssetId: image_asset_id
                  }
                }
              ]

            asset ->
              [
                build_image_asset_entry(:card, card.id, %{
                  type: :managed,
                  asset: asset,
                  inserted_at: card.created_at
                })
              ]
          end
      end
    end)
  end

  defp choose_avatar_source(user, settings, source_image_assets, latest_profile_assets_by_user_id)

  defp choose_avatar_source(
         user,
         settings,
         source_image_assets,
         latest_profile_assets_by_user_id
       ) do
    profile_picture = present_string(settings && settings.profile_picture)
    image = present_string(user.image)

    cond do
      managed_id = parse_managed_asset_id(profile_picture, @managed_profile_prefix) ->
        case Map.get(source_image_assets, managed_id) do
          nil -> nil
          asset -> %{type: :managed, asset: asset, inserted_at: asset.created_at}
        end

      managed_id = parse_managed_asset_id(image, @managed_profile_prefix) ->
        case Map.get(source_image_assets, managed_id) do
          nil -> nil
          asset -> %{type: :managed, asset: asset, inserted_at: asset.created_at}
        end

      is_binary(profile_picture) ->
        %{
          type: :external,
          url: profile_picture,
          mime_type: infer_mime_type(profile_picture),
          inserted_at: user.created_at
        }

      is_binary(image) ->
        %{
          type: :external,
          url: image,
          mime_type: infer_mime_type(image),
          inserted_at: user.created_at
        }

      profile_asset = Map.get(latest_profile_assets_by_user_id, user.id) ->
        %{type: :managed, asset: profile_asset, inserted_at: profile_asset.created_at}

      true ->
        nil
    end
  end

  defp build_image_asset_entry(kind, owner_id, source) do
    source_id = image_source_id(kind, owner_id, source)
    id = map_id({:image_asset, kind}, source_id)
    mime_type = image_source_mime_type(source)
    object_key = image_object_key(kind, owner_id, id, mime_type)
    inserted_at = source[:inserted_at] || DateTime.utc_now() |> DateTime.truncate(:second)

    %{
      id: id,
      source_id: source_id,
      owner_id: owner_id,
      kind: kind,
      mime_type: mime_type,
      object_key: object_key,
      placeholder_svg: nil,
      inserted_at: inserted_at,
      source: source,
      skipped: nil
    }
  end

  defp import_plan!(plan) do
    Repo.transaction(fn ->
      insert_all!(WordleDictionaryWord, plan.rows.wordle_dictionary_words, 500)
      insert_all!(Rarity, plan.rows.rarities)
      insert_all!(ImageAsset, plan.rows.image_assets)
      insert_all!(Pack, plan.rows.packs)
      insert_all!(Card, plan.rows.cards)
      insert_all!(AbilityDef, plan.rows.abilities)
      insert_all!(CardAbility, plan.rows.card_abilities)
      insert_all!(User, plan.rows.users)
      insert_all!(EmailCredential, plan.rows.email_credentials)
      insert_all!(EmailAccessRequest, plan.rows.email_access_requests)
      insert_all!(EmailVerificationCode, plan.rows.email_verification_codes)
      insert_all!(OwnedCard, plan.rows.owned_cards, 500)
      insert_all!(CardGift, plan.rows.card_gifts)
      insert_all!(DailyQuest, plan.rows.daily_quests, 500)
      insert_all!(WordleDailyAttempt, plan.rows.wordle_attempts, 500)
      insert_all!(SpeedCalculusDailyRun, plan.rows.speed_runs, 500)
      insert_all!(StepSnapshot, plan.rows.step_snapshots)
    end)
  end

  defp verify_plan!(plan) do
    target_counts = load_target_counts()

    expected = plan.counts

    mismatches =
      expected
      |> Enum.flat_map(fn {key, expected_count} ->
        actual_count = Map.get(target_counts, key)

        if actual_count == expected_count do
          []
        else
          [%{table: key, expected: expected_count, actual: actual_count}]
        end
      end)

    if mismatches == [] do
      %{status: :ok, target_counts: target_counts}
    else
      raise "verification failed: #{inspect(mismatches)}"
    end
  end

  defp reset_target!(target_storage) do
    reset_sql = """
    TRUNCATE TABLE
      oban_jobs,
      pvp_match_events,
      pvp_match_snapshots,
      pvp_matches,
      pvp_loadouts,
      speed_calculus_daily_runs,
      wordle_daily_attempts,
      daily_quests,
      step_snapshots,
      card_gifts,
      owned_cards,
      card_abilities,
      ability_defs,
      cards,
      packs,
      rarities,
      image_assets,
      email_verification_codes,
      email_access_requests,
      auth_sessions,
      email_auth_credentials,
      users,
      wordle_dictionary_words
    RESTART IDENTITY CASCADE
    """

    Repo.query!(reset_sql)
    delete_target_objects!(target_storage)
  end

  defp upload_assets!(image_uploads, source_storage, target_storage) do
    ensure_target_bucket!(target_storage)

    Enum.each(image_uploads, fn asset ->
      case asset.source do
        %{type: :managed, asset: source_asset} ->
          copy_managed_object_via_mc!(
            source_storage,
            source_asset.bucket,
            source_asset.object_key,
            target_storage,
            asset.object_key
          )

        %{type: :external, url: url} ->
          binary = fetch_external_object!(url)
          upload_external_object_via_mc!(target_storage, asset.object_key, binary)

        %{type: :missing} ->
          :ok
      end
    end)
  end

  defp ensure_target_bucket!(storage) do
    with_temp_mc_aliases(storage, storage, fn _src_alias, dst_alias, env ->
      run_mc!(["mb", "--ignore-existing", "#{dst_alias}/#{storage.bucket}"], env)
    end)
  end

  defp copy_managed_object_via_mc!(
         source_storage,
         source_bucket,
         source_key,
         target_storage,
         target_key
       ) do
    with_temp_mc_aliases(source_storage, target_storage, fn src_alias, dst_alias, env ->
      run_mc!(
        [
          "cp",
          "#{src_alias}/#{source_bucket}/#{source_key}",
          "#{dst_alias}/#{target_storage.bucket}/#{target_key}"
        ],
        env
      )
    end)
  end

  defp upload_external_object_via_mc!(target_storage, target_key, binary) do
    temp_dir =
      Path.join(System.tmp_dir!(), "at-pwa-import-upload-#{System.unique_integer([:positive])}")

    File.mkdir_p!(temp_dir)
    temp_path = Path.join(temp_dir, "upload.bin")
    File.write!(temp_path, binary)

    try do
      with_temp_mc_aliases(target_storage, target_storage, fn _src_alias, dst_alias, env ->
        run_mc!(["cp", temp_path, "#{dst_alias}/#{target_storage.bucket}/#{target_key}"], env)
      end)
    after
      File.rm_rf(temp_dir)
    end
  end

  defp with_temp_mc_aliases(source_storage, target_storage, fun) do
    temp_dir =
      Path.join(System.tmp_dir!(), "at-pwa-import-mc-#{System.unique_integer([:positive])}")

    File.mkdir_p!(temp_dir)

    env = [{"MC_CONFIG_DIR", temp_dir}]
    src_alias = "pwa-src"
    dst_alias = "phoenix-dst"

    try do
      run_mc!(
        [
          "alias",
          "set",
          src_alias,
          source_storage.base_url,
          source_storage.access_key,
          source_storage.secret_key
        ],
        env
      )

      run_mc!(
        [
          "alias",
          "set",
          dst_alias,
          target_storage.base_url,
          target_storage.access_key,
          target_storage.secret_key
        ],
        env
      )

      fun.(src_alias, dst_alias, env)
    after
      File.rm_rf(temp_dir)
    end
  end

  defp run_mc!(args, env) do
    case System.cmd("mc", args, env: env, stderr_to_stdout: true) do
      {_output, 0} -> :ok
      {output, status} -> raise "mc #{Enum.join(args, " ")} failed (#{status}): #{output}"
    end
  end

  defp fetch_external_object!(url) do
    case Req.get(url, headers: [{"user-agent", "Mozilla/5.0 AdventureTimeMigration"}]) do
      {:ok, %{status: 200, body: body}} when is_binary(body) -> body
      {:ok, %{status: status}} -> raise "failed to fetch external asset #{url}: #{status}"
      {:error, reason} -> raise "failed to fetch external asset #{url}: #{inspect(reason)}"
    end
  end

  defp delete_target_objects!(%{
         base_url: base_url,
         bucket: bucket,
         access_key: access_key,
         secret_key: secret_key
       }) do
    prefix = "migration/pwa/"
    auth = basic_auth_header(access_key, secret_key)

    listing_url =
      String.trim_trailing(base_url, "/") <> "/" <> bucket <> "/?prefix=" <> URI.encode(prefix)

    with {:ok, %{status: 200, body: body}} <-
           Req.get(listing_url, headers: [{"authorization", auth}]),
         keys when is_list(keys) <- extract_listed_keys(body) do
      Enum.each(keys, fn key ->
        delete_url = object_url(base_url, bucket, key)
        _ = Req.delete(delete_url, headers: [{"authorization", auth}])
      end)
    else
      _ -> :ok
    end
  end

  defp extract_listed_keys(body) when is_binary(body) do
    Regex.scan(~r/<Key>([^<]+)<\/Key>/, body, capture: :all_but_first)
    |> Enum.map(&List.first/1)
  end

  defp extract_listed_keys(_body), do: []

  defp insert_all!(schema, rows, chunk_size \\ 1000)
  defp insert_all!(_schema, [], _chunk_size), do: :ok

  defp insert_all!(schema, rows, chunk_size) do
    rows
    |> Enum.chunk_every(chunk_size)
    |> Enum.each(fn chunk ->
      Repo.insert_all(schema, Enum.map(chunk, &truncate_temporal_fields/1))
    end)
  end

  defp truncate_temporal_fields(row) do
    Map.new(row, fn {key, value} -> {key, truncate_temporal(value)} end)
  end

  defp truncate_temporal(%DateTime{} = value), do: DateTime.truncate(value, :second)
  defp truncate_temporal(%NaiveDateTime{} = value), do: NaiveDateTime.truncate(value, :second)
  defp truncate_temporal(value), do: value

  defp add_seconds(nil, _seconds), do: nil

  defp add_seconds(%NaiveDateTime{} = value, seconds),
    do: NaiveDateTime.add(value, seconds, :second)

  defp add_seconds(%DateTime{} = value, seconds), do: DateTime.add(value, seconds, :second)

  defp datetime_to_naive(nil), do: nil
  defp datetime_to_naive(%NaiveDateTime{} = value), do: NaiveDateTime.truncate(value, :second)

  defp datetime_to_naive(%DateTime{} = value),
    do: value |> DateTime.truncate(:second) |> DateTime.to_naive()

  defp load_target_counts do
    Map.new(@target_verify_tables, fn {key, table} ->
      %{rows: [[count]]} = Repo.query!("SELECT count(*) FROM #{table}")
      {key, count}
    end)
  end

  defp source_counts(data) do
    %{
      allowed_emails: length(data.allowed_emails),
      email_access_requests: length(data.email_access_requests),
      email_verification_codes: length(data.email_verification_codes),
      users: length(data.users),
      user_settings: length(data.user_settings),
      fitbit_accounts: length(data.fitbit_accounts),
      email_credentials: length(data.email_credentials),
      image_assets: length(data.image_assets),
      rarities: length(data.rarities),
      cards: length(data.cards),
      packs: length(data.packs),
      owned_cards: length(data.owned_cards),
      abilities: length(data.abilities),
      card_abilities: length(data.card_abilities),
      card_gifts: length(data.card_gifts),
      daily_quests: length(data.daily_quests),
      wordle_attempts: length(data.wordle_attempts),
      speed_runs: length(data.speed_runs),
      wordle_dictionary_words: length(data.wordle_dictionary_words),
      pvp_matches: source_count(data.pvp_matches),
      pvp_loadouts: source_count(data.pvp_loadouts)
    }
  end

  defp source_count([%{count: count}]), do: count
  defp source_count(_), do: 0

  defp build_warnings(data, image_assets) do
    orphan_allowed_emails =
      data.allowed_emails
      |> Enum.count(fn row ->
        email = normalize_email(row.email)
        Enum.all?(data.users, &(normalize_email(&1.email) != email))
      end)

    [
      %{kind: "orphan_allowed_emails", count: orphan_allowed_emails},
      %{kind: "source_step_snapshots_missing", count: 0},
      %{kind: "imported_media_assets", count: length(image_assets)}
    ]
  end

  defp ready_object_asset?(asset) do
    asset.upload_status == "ready" and is_binary(asset.object_key) and asset.object_key != ""
  end

  defp image_asset_id_for_card(image_url, image_asset_map) do
    case parse_managed_asset_id(image_url, @managed_card_prefix) do
      nil -> nil
      source_id -> Map.get(image_asset_map, source_id)
    end
  end

  defp parse_managed_asset_id(nil, _prefix), do: nil

  defp parse_managed_asset_id(value, prefix) when is_binary(value) do
    if String.starts_with?(value, prefix) do
      String.replace_prefix(value, prefix, "") |> String.trim()
    end
  end

  defp image_source_id(_kind, _owner_id, %{type: :managed, asset: asset}), do: asset.id

  defp image_source_id(kind, owner_id, %{type: :external, url: url}),
    do: "#{kind}:#{owner_id}:#{url}"

  defp image_source_id(kind, owner_id, %{type: :missing}), do: "#{kind}:#{owner_id}:missing"

  defp image_source_mime_type(%{type: :managed, asset: asset}),
    do: asset.mime_type || "application/octet-stream"

  defp image_source_mime_type(%{type: :external, mime_type: mime_type}),
    do: mime_type || "image/jpeg"

  defp image_source_mime_type(%{type: :missing}), do: "image/svg+xml"

  defp image_object_key(kind, owner_id, image_asset_id, mime_type) do
    extension = extension_for_mime_type(mime_type)
    "migration/pwa/#{kind}/#{owner_id}/#{image_asset_id}#{extension}"
  end

  defp extension_for_mime_type("image/webp"), do: ".webp"
  defp extension_for_mime_type("image/png"), do: ".png"
  defp extension_for_mime_type("image/jpeg"), do: ".jpg"
  defp extension_for_mime_type("image/jpg"), do: ".jpg"
  defp extension_for_mime_type("image/gif"), do: ".gif"
  defp extension_for_mime_type("image/svg+xml"), do: ".svg"
  defp extension_for_mime_type(_), do: ""

  defp infer_mime_type(url) when is_binary(url) do
    lower = String.downcase(url)

    cond do
      String.ends_with?(lower, ".png") -> "image/png"
      String.ends_with?(lower, ".jpg") -> "image/jpeg"
      String.ends_with?(lower, ".jpeg") -> "image/jpeg"
      String.ends_with?(lower, ".gif") -> "image/gif"
      String.ends_with?(lower, ".webp") -> "image/webp"
      true -> "image/jpeg"
    end
  end

  defp role_for_allowed_email(%{is_super_admin: true}), do: :super_admin
  defp role_for_allowed_email(%{is_admin: true}), do: :admin
  defp role_for_allowed_email(_), do: :user

  defp preferred_step_source(user_id, fitbit_user_ids) do
    if MapSet.member?(fitbit_user_ids, user_id), do: :fitbit, else: :device_health
  end

  defp normalize_locale("fr"), do: :fr
  defp normalize_locale(_), do: :en

  defp normalize_email(nil), do: nil

  defp normalize_email(value) when is_binary(value) do
    value |> String.trim() |> String.downcase()
  end

  defp normalize_request_status("approved"), do: :approved
  defp normalize_request_status("rejected"), do: :rejected
  defp normalize_request_status(_), do: :pending

  defp normalize_verification_purpose("signup"), do: :signup
  defp normalize_verification_purpose(_), do: nil

  defp normalize_gift_status("accepted", _expires_at, _now), do: :accepted
  defp normalize_gift_status("rejected", _expires_at, _now), do: :rejected

  defp normalize_gift_status(_status, %DateTime{} = expires_at, %DateTime{} = now) do
    if DateTime.compare(expires_at, now) == :gt, do: :pending, else: :expired
  end

  defp normalize_speed_status("submitted"), do: "completed"
  defp normalize_speed_status("completed"), do: "completed"
  defp normalize_speed_status("abandoned"), do: "abandoned"
  defp normalize_speed_status(_), do: "in_progress"

  defp decode_json_map(value) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} when is_map(decoded) -> decoded
      _ -> %{}
    end
  end

  defp decode_json_map(_), do: %{}

  defp decode_json_list(value) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} when is_list(decoded) -> Enum.map(decoded, &to_string/1)
      _ -> []
    end
  end

  defp decode_json_list(_), do: []

  defp decode_json_int_list(value) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} when is_list(decoded) -> Enum.map(decoded, &normalize_integer/1)
      _ -> []
    end
  end

  defp decode_json_int_list(_), do: []

  defp normalize_integer(value) when is_integer(value), do: value
  defp normalize_integer(value) when is_binary(value), do: String.to_integer(value)
  defp normalize_integer(value) when is_float(value), do: round(value)
  defp normalize_integer(_), do: 0

  defp parse_date!(%Date{} = value), do: value
  defp parse_date!(value) when is_binary(value), do: Date.from_iso8601!(value)

  defp maybe_mapped_id(nil, _map), do: nil
  defp maybe_mapped_id(value, map), do: Map.get(map, value)

  defp map_id(namespace, value) when is_tuple(namespace),
    do: stable_uuid(Enum.join(Tuple.to_list(namespace), ":"), value)

  defp map_id(namespace, value) when is_atom(namespace),
    do: map_id(Atom.to_string(namespace), value)

  defp map_id(namespace, value) when is_binary(namespace) and is_binary(value) do
    case Ecto.UUID.cast(value) do
      {:ok, uuid} -> uuid
      :error -> stable_uuid(namespace, value)
    end
  end

  defp stable_uuid(namespace, value) do
    <<a1::32, a2::16, a3::16, a4::16, a5::48, _::binary>> =
      :crypto.hash(:sha256, namespace <> ":" <> value)

    part3 = Bitwise.bor(Bitwise.band(a3, 0x0FFF), 0x5000)
    part4 = Bitwise.bor(Bitwise.band(a4, 0x3FFF), 0x8000)

    :io_lib.format(~c"~8.16.0b-~4.16.0b-~4.16.0b-~4.16.0b-~12.16.0b", [a1, a2, part3, part4, a5])
    |> IO.iodata_to_binary()
  end

  defp parse_env_file!(path) do
    path = Path.expand(path)

    entries =
      path
      |> File.read!()
      |> String.split("\n", trim: false)
      |> Enum.reduce(%{"__path__" => path}, fn line, acc ->
        line = String.trim(line)

        cond do
          line == "" or String.starts_with?(line, "#") or not String.contains?(line, "=") ->
            acc

          true ->
            [key, value] = String.split(line, "=", parts: 2)
            Map.put(acc, String.trim(key), String.trim(value))
        end
      end)

    entries
  end

  defp source_db_config(env) do
    url = URI.parse(Map.fetch!(env, "DATABASE_URL"))

    userinfo_parts =
      (url.userinfo || "")
      |> String.split(":", parts: 2)

    username = Enum.at(userinfo_parts, 0)
    password = Enum.at(userinfo_parts, 1)

    [
      hostname: url.host,
      port: url.port || 5432,
      username: username,
      password: password,
      database: String.trim_leading(url.path || "", "/"),
      ssl: url.scheme in ["postgresql+ssl", "ecto+ssl"],
      backoff_type: :stop,
      max_restarts: 0
    ]
  end

  defp source_storage_config(env) do
    %{
      base_url: String.trim_trailing(Map.fetch!(env, "S3_ENDPOINT"), "/"),
      access_key: Map.fetch!(env, "S3_ACCESS_KEY_ID"),
      secret_key: Map.fetch!(env, "S3_SECRET_ACCESS_KEY")
    }
  end

  defp target_storage_config(env) do
    scheme = if env["MINIO_USE_SSL"] in ["true", "1"], do: "https", else: "http"

    %{
      base_url: scheme <> "://" <> env["MINIO_ENDPOINT"] <> ":" <> env["MINIO_PORT"],
      bucket: env["MINIO_BUCKET"],
      access_key: env["MINIO_ACCESS_KEY"],
      secret_key: env["MINIO_SECRET_KEY"]
    }
  end

  defp object_url(base_url, bucket, object_key) do
    encoded_key =
      object_key
      |> String.split("/", trim: true)
      |> Enum.map(fn segment -> URI.encode(segment, &URI.char_unreserved?/1) end)
      |> Enum.join("/")

    String.trim_trailing(base_url, "/") <> "/" <> bucket <> "/" <> encoded_key
  end

  defp basic_auth_header(access_key, secret_key) do
    "Basic " <> Base.encode64(access_key <> ":" <> secret_key)
  end

  defp query_rows!(conn, sql) do
    result = Postgrex.query!(conn, sql, [])

    Enum.map(result.rows, fn row ->
      Enum.zip(result.columns, row)
      |> Map.new(fn {key, value} -> {String.to_atom(key), value} end)
    end)
  end

  defp count_sql(table_name), do: "SELECT count(*)::int AS count FROM #{table_name}"

  defp allowed_emails_sql do
    """
    SELECT
      id,
      lower(email) AS email,
      "isAdmin" AS is_admin,
      "isSuperAdmin" AS is_super_admin,
      "addedBy" AS added_by,
      "createdAt" AS created_at
    FROM "AllowedEmail"
    ORDER BY lower(email)
    """
  end

  defp email_access_requests_sql do
    """
    SELECT
      id,
      lower(email) AS email,
      name,
      message,
      "requestedLocale" AS requested_locale,
      status,
      "reviewedBy" AS reviewed_by,
      "reviewedAt" AS reviewed_at,
      "createdAt" AS created_at,
      "updatedAt" AS updated_at
    FROM "EmailAccessRequest"
    ORDER BY lower(email)
    """
  end

  defp email_verification_codes_sql do
    """
    SELECT
      id,
      lower(email) AS email,
      "codeHash" AS code_hash,
      purpose,
      "expiresAt" AS expires_at,
      "usedAt" AS used_at,
      "createdAt" AS created_at
    FROM "EmailVerificationCode"
    ORDER BY "createdAt"
    """
  end

  defp users_sql do
    """
    SELECT
      id,
      lower(email) AS email,
      name,
      image,
      coins,
      dust,
      "lastDailyClaim" AS last_daily_claim,
      "createdAt" AS created_at,
      "updatedAt" AS updated_at
    FROM "User"
    ORDER BY lower(email)
    """
  end

  defp user_settings_sql do
    """
    SELECT
      id,
      "userId" AS user_id,
      "displayName" AS display_name,
      "profilePicture" AS profile_picture,
      language
    FROM "UserSettings"
    """
  end

  defp fitbit_accounts_sql, do: "SELECT \"userId\" AS user_id FROM \"FitbitAccount\""

  defp email_credentials_sql do
    """
    SELECT
      id,
      "userId" AS user_id,
      "passwordHash" AS password_hash,
      "emailVerifiedAt" AS email_verified_at,
      "createdAt" AS created_at,
      "updatedAt" AS updated_at
    FROM "EmailAuthCredential"
    """
  end

  defp image_assets_sql do
    """
    SELECT
      id,
      kind,
      "userId" AS user_id,
      "cardId" AS card_id,
      bucket,
      "objectKey" AS object_key,
      "mimeType" AS mime_type,
      size,
      width,
      height,
      "uploadStatus" AS upload_status,
      hash,
      "createdAt" AS created_at,
      "updatedAt" AS updated_at
    FROM "ImageAsset"
    """
  end

  defp rarities_sql,
    do:
      "SELECT id, name, \"dropRate\" AS drop_rate, color, CURRENT_TIMESTAMP AS created_at FROM \"Rarity\" ORDER BY name"

  defp cards_sql do
    """
    SELECT
      id,
      name,
      character,
      description,
      hp,
      attack,
      defense,
      "imageUrl" AS image_url,
      "rarityId" AS rarity_id,
      type,
      "isArchived" AS is_archived,
      "isFeatured" AS is_featured,
      "createdAt" AS created_at,
      "updatedAt" AS updated_at,
      speed
    FROM "Card"
    ORDER BY "createdAt", id
    """
  end

  defp packs_sql,
    do:
      "SELECT id, name, description, \"cardCount\" AS card_count, cost, color, \"isActive\" AS is_active, \"guaranteedRarity\" AS guaranteed_rarity, CURRENT_TIMESTAMP AS created_at FROM \"Pack\" ORDER BY name"

  defp owned_cards_sql do
    """
    SELECT
      id,
      "cardId" AS card_id,
      "userId" AS user_id,
      quantity,
      "obtainedAt" AS obtained_at
    FROM "OwnedCard"
    ORDER BY "obtainedAt", id
    """
  end

  defp abilities_sql do
    """
    SELECT
      id,
      key,
      name,
      description,
      "descriptionFr" AS description_fr,
      "nameFr" AS name_fr,
      type,
      cost,
      cooldown,
      "oncePerMatch" AS once_per_match,
      payload,
      "createdAt" AS created_at,
      CURRENT_TIMESTAMP AS updated_at
    FROM "AbilityDef"
    ORDER BY key
    """
  end

  defp card_abilities_sql do
    """
    SELECT
      id,
      "cardId" AS card_id,
      "passiveId" AS passive_id,
      "skillId" AS skill_id,
      "ultimateId" AS ultimate_id,
      "createdAt" AS created_at
    FROM "CardAbility"
    ORDER BY "createdAt", id
    """
  end

  defp card_gifts_sql do
    """
    SELECT
      id,
      "cardId" AS card_id,
      "fromUserId" AS from_user_id,
      "toUserId" AS to_user_id,
      quantity,
      message,
      status,
      "createdAt" AS created_at,
      "respondedAt" AS responded_at
    FROM "CardGift"
    ORDER BY "createdAt", id
    """
  end

  defp daily_quests_sql do
    """
    SELECT
      id,
      "userId" AS user_id,
      date,
      "questType" AS quest_type,
      target,
      progress,
      completed,
      claimed,
      reward,
      "completedAt" AS completed_at,
      "claimedAt" AS claimed_at,
      "createdAt" AS created_at,
      "updatedAt" AS updated_at,
      NULL::text AS reset_by_user_id
    FROM "DailyQuest"
    ORDER BY date, "userId", "questType"
    """
  end

  defp wordle_attempts_sql do
    """
    SELECT
      id,
      "userId" AS user_id,
      date,
      attempt,
      guess,
      evaluation,
      solved,
      "createdAt" AS created_at
    FROM "WordleDailyAttempt"
    ORDER BY date, "userId", attempt
    """
  end

  defp speed_runs_sql do
    """
    SELECT
      id,
      "userId" AS user_id,
      date,
      "runNumber" AS run_number,
      status,
      seed,
      score,
      "answersJson" AS answers_json,
      "pauseUntil" AS pause_until,
      "startedAt" AS started_at,
      "finishedAt" AS finished_at,
      "createdAt" AS created_at
    FROM "SpeedCalculusDailyRun"
    ORDER BY date, "userId", "runNumber"
    """
  end

  defp wordle_dictionary_words_sql do
    """
    SELECT
      id,
      locale,
      word,
      "isAllowedGuess" AS is_allowed_guess,
      "isSolutionCandidate" AS is_solution_candidate
    FROM "WordleDictionaryWord"
    ORDER BY locale, word
    """
  end

  defp present_string(nil), do: nil

  defp present_string(value) when is_binary(value) do
    trimmed = String.trim(value)
    if trimmed == "", do: nil, else: trimmed
  end

  defp write_report!(report, report_dir, suffix) do
    File.mkdir_p!(report_dir)
    timestamp = DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_unix()
    path = Path.join(report_dir, "pwa-import-#{suffix}-#{timestamp}.json")
    File.write!(path, Jason.encode_to_iodata!(report, pretty: true))
    path
  end
end
