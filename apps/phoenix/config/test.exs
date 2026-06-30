import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :adventure_time_api, AdventureTimeApi.Repo,
  username: "postgres",
  password:
    System.get_env("PHX_TEST_DB_PASSWORD") || System.get_env("POSTGRES_PASSWORD") || "postgres",
  hostname: "127.0.0.1",
  port: String.to_integer(System.get_env("PHX_TEST_DB_PORT") || "5434"),
  database:
    (System.get_env("PHX_TEST_DB_NAME") || "adventure_time_tcg_test") <>
      (System.get_env("MIX_TEST_PARTITION") || ""),
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :adventure_time_api, AdventureTimeApiWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "NqBr4+7AYxsv3qEp8xD26T2w+Y1LYZvcgYcnioPNV/ZYHCpcttODgfBu9DBzHrC0",
  server: false

config :adventure_time_api, AdventureTimeApi.Auth,
  access_token_secret: "test-access-token-secret-please-change-1234567890",
  refresh_token_secret: "test-refresh-token-secret-please-change-1234567890",
  google_client_ids: ["test-google-client-id"],
  apple_client_ids: ["love.leaetzak.adventuretime"]

config :adventure_time_api, AdventureTimeApi.Accounts,
  verification_secret: "test-email-verification-secret-please-change-1234567890",
  expose_dev_code: true

config :adventure_time_api, AdventureTimeApi.Accounts.EmailDelivery,
  adapter: AdventureTimeApi.Accounts.EmailDelivery.NoopAdapter

config :adventure_time_api, Oban,
  repo: AdventureTimeApi.Repo,
  testing: :manual,
  queues: false,
  plugins: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime
