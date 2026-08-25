defmodule AdventureTimeApiWeb.Router do
  use AdventureTimeApiWeb, :router

  alias AdventureTimeApiWeb.Plugs.RequireAuth
  alias AdventureTimeApiWeb.Plugs.RequireWebSessionRequest

  pipeline :api do
    plug(:accepts, ["json"])
  end

  pipeline :browser_html do
    plug(:accepts, ["html"])
  end

  pipeline :fitbit_public do
    plug(:accepts, ["html", "json"])
  end

  pipeline :not_found do
    plug(:accepts, ["html", "json"])
  end

  pipeline :api_auth do
    plug(:accepts, ["json"])
    plug(RequireAuth)
  end

  pipeline :web_session do
    plug(:accepts, ["json"])
    plug(RequireWebSessionRequest)
  end

  scope "/", AdventureTimeApiWeb do
    pipe_through(:browser_html)

    get("/", LandingController, :index)
    get("/status", HealthController, :page)
    get("/privacy", LandingController, :privacy)
    get("/account-deletion", LandingController, :account_deletion)
    get("/email/verify", EmailVerificationController, :show)
    post("/email/verify", EmailVerificationController, :confirm)
    get("/password/reset", PasswordResetController, :show)
    post("/password/reset", PasswordResetController, :confirm)
  end

  scope "/api", AdventureTimeApiWeb do
    pipe_through(:fitbit_public)

    get("/fitbit/callback", FitbitController, :callback)
    get("/fitbit/webhook", FitbitController, :webhook_verify)
    post("/fitbit/webhook", FitbitController, :webhook)
  end

  # Temporary provider-transition aliases. Fitbit's canonical public endpoints
  # are under /api and do not require a legacy-host proxy.
  scope "/", AdventureTimeApiWeb do
    pipe_through(:fitbit_public)

    get("/fitbit/callback", FitbitController, :callback)
    get("/fitbit/webhook", FitbitController, :webhook_verify)
    post("/fitbit/webhook", FitbitController, :webhook)
  end

  scope "/", AdventureTimeApiWeb do
    pipe_through(:api)

    get("/health", HealthController, :show)
    get("/ready", HealthController, :ready)
    get("/ready/media", HealthController, :media_ready)
    get("/media/card/:id", MediaController, :card)
    get("/media/catalog/:id", MediaController, :catalog)

    post("/auth/register", AuthController, :register)
    post("/auth/verify-email", AuthController, :verify_email)
    post("/auth/resend-verification", AuthController, :resend_verification)
    post("/auth/request-password-reset", AuthController, :request_password_reset)
    post("/auth/reset-password", AuthController, :reset_password)
    post("/auth/login", AuthController, :login)
    post("/auth/google", AuthController, :google)
    post("/auth/apple", AuthController, :apple)

    post(
      "/auth/access-request-assessment/play-integrity",
      PlayIntegrityController,
      :create
    )

    post("/auth/refresh", AuthController, :refresh)
    post("/auth/logout", AuthController, :logout)
  end

  scope "/web", AdventureTimeApiWeb do
    pipe_through(:web_session)

    get("/auth/config", WebSessionController, :auth_config)
    post("/session", WebSessionController, :create)
    post("/session/google", WebSessionController, :google)
    post("/session/apple", WebSessionController, :apple)
    post("/session/refresh", WebSessionController, :refresh)
    delete("/session", WebSessionController, :delete)
  end

  scope "/", AdventureTimeApiWeb do
    pipe_through(:api_auth)

    get("/me", AppController, :me)
    get("/media/profile/:id", MediaController, :profile)
    get("/home", AppController, :home)
    get("/collection", AppController, :collection)
    get("/users", SocialController, :users)
    get("/gifts", SocialController, :gifts)
    post("/gifts", SocialController, :send_gift)
    patch("/gifts", SocialController, :process_gift)
    get("/packs", AppController, :packs)
    post("/packs/open", AppController, :open_pack)
    get("/daily-claim", AppController, :daily_claim_status)
    post("/daily-claim", AppController, :daily_claim)
    get("/rarities", AppController, :rarities)
    get("/featured-cards", AppController, :featured_cards)

    post("/collection/craft", AppController, :craft_card)
    post("/collection/recycle", AppController, :recycle_card)

    patch("/settings/display-name", AppController, :update_display_name)
    patch("/settings/language", AppController, :update_language)
    patch("/settings/step-source", AppController, :update_step_source)
    patch("/settings/timezone", AppController, :update_timezone)
    patch("/settings/notification-preferences", AppController, :update_notification_preferences)
    patch("/settings/password", AppController, :update_password)
    delete("/settings/account", AppController, :delete_account)
    post("/settings/upload", MediaController, :upload_profile)
    post("/notifications/device", NotificationController, :register_device)
    delete("/notifications/device/:installation_id", NotificationController, :unregister_device)
    post("/fitbit/authorize", FitbitController, :authorize)
    get("/fitbit/status", FitbitController, :status)
    post("/fitbit/disconnect", FitbitController, :disconnect)

    get("/health/steps", AppController, :health_steps)
    post("/health/steps", AppController, :sync_steps)

    get("/leaderboards/boards", LeaderboardsController, :boards)

    get(
      "/leaderboards/:quest/:mode/history/:period_start/days",
      LeaderboardsController,
      :history_days
    )

    get("/leaderboards/:quest/:mode", LeaderboardsController, :show)
    get("/public-profiles/:public_profile_id", LeaderboardsController, :public_profile)

    get("/quests", QuestsController, :list_quests)
    post("/quests/claim", QuestsController, :claim_quest)
    get("/quests/daily-numbers", QuestsController, :daily_numbers_state)
    post("/quests/daily-numbers/ranked-start", QuestsController, :start_daily_numbers_ranked)
    post("/quests/daily-numbers/submit", QuestsController, :submit_daily_numbers)

    post(
      "/quests/daily-numbers/solution-hunt/submit",
      QuestsController,
      :submit_daily_numbers_solution_hunt
    )

    get("/quests/daily-numbers/history", QuestsController, :daily_numbers_archive_history)
    get("/quests/daily-numbers/archive", QuestsController, :daily_numbers_archive_state)

    post(
      "/quests/daily-numbers/archive/submit",
      QuestsController,
      :submit_daily_numbers_archive
    )

    get("/quests/speed-calculus", QuestsController, :speed_calculus_state)
    get("/quests/perfect-timing", QuestsController, :perfect_timing_state)
    post("/quests/perfect-timing/start", QuestsController, :start_perfect_timing)
    post("/quests/perfect-timing/stop", QuestsController, :stop_perfect_timing)
    post("/quests/perfect-timing/continue", QuestsController, :continue_perfect_timing)
    post("/quests/perfect-timing/keep", QuestsController, :keep_perfect_timing)

    post(
      "/quests/perfect-timing/training/target",
      QuestsController,
      :perfect_timing_training_target
    )

    post("/quests/speed-calculus/start", QuestsController, :start_speed_calculus_run)

    post(
      "/quests/speed-calculus/training/start",
      QuestsController,
      :start_speed_calculus_training
    )

    post("/quests/speed-calculus/answer", QuestsController, :answer_speed_calculus)
    post("/quests/speed-calculus/pause", QuestsController, :pause_speed_calculus)
    post("/quests/speed-calculus/resume", QuestsController, :resume_speed_calculus)
    post("/quests/speed-calculus/finish", QuestsController, :finish_speed_calculus)
    post("/quests/speed-calculus/cashout", QuestsController, :cashout_speed_calculus)
    get("/wordle/definition", QuestsController, :wordle_definition)
    get("/wordle", QuestsController, :wordle_state)
    post("/wordle", QuestsController, :submit_wordle_guess)

    get("/pvp/loadouts", PvpController, :list_loadouts)
    post("/pvp/loadouts", PvpController, :create_loadout)
    put("/pvp/loadouts/:id", PvpController, :update_loadout)
    delete("/pvp/loadouts/:id", PvpController, :delete_loadout)

    get("/pvp/invites", PvpController, :list_invites)
    post("/pvp/invites", PvpController, :create_invite)
    delete("/pvp/invites", PvpController, :delete_invite)

    get("/pvp/matches", PvpController, :list_matches)
    get("/pvp/matches/:id", PvpController, :get_match)
    get("/pvp/history", PvpController, :list_history)
    get("/pvp/history/:id", PvpController, :get_history_detail)

    post("/pvp/matches/:id/accept", PvpController, :accept_match)
    post("/pvp/matches/:id/decline", PvpController, :decline_match)
    post("/pvp/matches/:id/concede", PvpController, :concede_match)
    post("/pvp/matches/:id/action", PvpController, :perform_action)
    post("/pvp/matches/:id/end-turn", PvpController, :end_turn)

    get("/pvp/spectate", PvpController, :list_spectatable)
    get("/pvp/spectate/:id", PvpController, :get_spectate)

    get("/admin/users", AdminController, :users)
    get("/admin/users/:id", AdminController, :user_detail)
    patch("/admin/users/:id/coins", AdminController, :adjust_user_coins)
    patch("/admin/users/:id/role", AdminController, :update_user_role)
    post("/admin/users/:id/reset-daily-quests", AdminController, :reset_user_daily_quests)
    delete("/admin/users/:id", AdminController, :delete_user)
    get("/admin/email-requests", AdminController, :email_requests)
    patch("/admin/email-requests/:id", AdminController, :review_email_request)

    post(
      "/admin/email-requests/:id/reveal-ip",
      AdminController,
      :reveal_email_request_ip
    )

    post("/admin/leaderboards/results/:id/exclude", AdminController, :exclude_leaderboard_result)

    post(
      "/admin/leaderboards/snapshots/:id/correction-preview",
      AdminController,
      :preview_leaderboard_correction
    )

    post(
      "/admin/leaderboards/snapshots/:id/corrections",
      AdminController,
      :confirm_leaderboard_correction
    )

    get("/admin/packs", AdminController, :list_packs)
    post("/admin/packs", AdminController, :create_pack)
    patch("/admin/packs/:id", AdminController, :patch_pack)

    get("/admin/image-assets", AdminController, :list_image_assets)
    post("/admin/image-assets", AdminController, :create_image_asset)
    get("/admin/card-back-visuals", AdminController, :list_card_back_visuals)
    put("/admin/card-back-visuals", AdminController, :upsert_card_back_visual)

    get("/admin/abilities", AdminController, :list_abilities)
    post("/admin/abilities", AdminController, :create_ability)
    patch("/admin/abilities/:id", AdminController, :update_ability)
    delete("/admin/abilities/:id", AdminController, :delete_ability)
    post("/admin/abilities/assign", AdminController, :assign_card_ability)
    delete("/admin/abilities/assign/:card_id", AdminController, :remove_card_ability)

    get("/admin/cards", AdminController, :list_cards)
    get("/admin/cards/:id", AdminController, :get_card)
    post("/admin/cards", AdminController, :create_card)
    put("/admin/cards/:id", AdminController, :update_card)
    patch("/admin/cards/:id", AdminController, :patch_card)
    post("/admin/cards/:id/image", AdminController, :upload_card_image)
  end

  scope "/", AdventureTimeApiWeb do
    pipe_through(:not_found)

    match(:*, "/*path", NotFoundController, :show)
  end
end
