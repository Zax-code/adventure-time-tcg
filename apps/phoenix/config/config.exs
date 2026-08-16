# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :adventure_time_api,
  ecto_repos: [AdventureTimeApi.Repo],
  generators: [timestamp_type: :utc_datetime, binary_id: true]

config :adventure_time_api, AdventureTimeApiWeb.Endpoint,
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: AdventureTimeApiWeb.ErrorHTML, json: AdventureTimeApiWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: AdventureTimeApi.PubSub,
  url: [host: "127.0.0.1"]

# Configures Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

config :phoenix, :filter_parameters, ~w(
    accessToken
    access_token
    authorization
    clientSecret
    client_secret
    code
    challengeToken
    challenge_token
    idToken
    id_token
    integrityToken
    integrity_token
    password
    refreshToken
    refresh_token
    secret
    token
  )

config :req, user_agent: "adventure-time-phoenix"

config :elixir, :time_zone_database, Tzdata.TimeZoneDatabase

config :adventure_time_api, AdventureTimeApi.Auth,
  access_token_ttl_seconds: 15 * 60,
  refresh_token_ttl_days: 180,
  google_client_ids: [],
  apple_client_ids: ["love.leaetzak.adventuretime"]

config :adventure_time_api, AdventureTimeApi.Accounts,
  verification_secret: "dev-email-verification-secret-please-change-1234567890",
  expose_dev_code: false

config :adventure_time_api, AdventureTimeApi.AccessAssessment,
  collection_enabled: false,
  admin_display_enabled: false,
  scoring_model_version: "access-request-v1",
  expected_range_versions: %{
    test_lab: "firebase-test-lab-2026-08-13",
    google: "google-ip-ranges-1786889149345"
  }

config :adventure_time_api, AdventureTimeApi.AccessAssessment.IpIntelligence,
  adapter: AdventureTimeApi.AccessAssessment.IpQualityScore,
  endpoint: "https://ipqualityscore.com/api/json/ip",
  api_key: nil,
  settings_version: "v1",
  timeout_ms: 3_000

config :adventure_time_api, AdventureTimeApi.AccessAssessment.Pseudonym,
  secret: nil,
  version: "v1"

config :adventure_time_api, AdventureTimeApi.AccessAssessment.PlayIntegrity,
  adapter: AdventureTimeApi.AccessAssessment.GooglePlayIntegrity,
  endpoint: "https://playintegrity.googleapis.com",
  package_name: "love.leaetzak.adventuretime",
  cloud_project_number: nil,
  certificate_digests: [],
  released_version_codes: [],
  credentials_path: nil,
  timeout_ms: 3_000

config :adventure_time_api, AdventureTimeApi.Accounts.EmailDelivery,
  adapter: AdventureTimeApi.Accounts.EmailDelivery.SendmailAdapter

config :adventure_time_api, AdventureTimeApi.Media,
  base_url: nil,
  bucket: nil,
  access_key: nil,
  secret_key: nil

config :adventure_time_api, Oban,
  repo: AdventureTimeApi.Repo,
  queues: [default: 10, assessments: 5, maintenance: 5],
  plugins: [
    Oban.Plugins.Pruner,
    {Oban.Plugins.Cron,
     crontab: [
       {"*/5 * * * *", AdventureTimeApi.Workers.LeaderboardLifecycleWorker},
       {"15 3 * * *", AdventureTimeApi.Workers.PruneAccessAssessmentDataWorker}
     ]}
  ]

config :adventure_time_api, AdventureTimeApi.Pvp, invite_ttl_hours: 24

config :adventure_time_api, AdventureTimeApi.Social, gift_ttl_days: 7

config :adventure_time_api, AdventureTimeApiWeb.Plugs.RateLimit,
  buckets: %{
    auth_register: %{limit: 10, scale_ms: 60_000},
    auth_login: %{limit: 12, scale_ms: 60_000},
    auth_verify_email: %{limit: 10, scale_ms: 60_000},
    auth_resend_verification: %{limit: 10, scale_ms: 60_000},
    auth_request_password_reset: %{limit: 6, scale_ms: 60_000},
    auth_reset_password: %{limit: 10, scale_ms: 60_000},
    auth_google: %{limit: 10, scale_ms: 60_000},
    auth_apple: %{limit: 10, scale_ms: 60_000},
    auth_play_integrity: %{limit: 10, scale_ms: 60_000},
    auth_refresh: %{limit: 20, scale_ms: 60_000},
    auth_logout: %{limit: 20, scale_ms: 60_000},
    pvp_match_write: %{limit: 30, scale_ms: 60_000}
  }

config :adventure_time_api, AdventureTimeApiWeb.Plugs.CanonicalClientIp, trusted_proxy_cidrs: []

config :adventure_time_api, AdventureTimeApiWeb.Plugs.WebsiteDocumentPlug,
  index_path: "priv/static/assets/web/index.html"

config :adventure_time_api, AdventureTimeApiWeb.WebSessionController,
  refresh_cookie_name: "adventure_time_refresh",
  refresh_cookie_secure: false,
  google_client_id: nil,
  apple_client_id: nil,
  apple_redirect_uri: nil

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
