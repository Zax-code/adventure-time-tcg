import Config

# Do not print debug messages in production
config :logger, level: :info

config :adventure_time_api, AdventureTimeApiWeb.WebSessionController,
  refresh_cookie_name: "__Host-adventure_time_refresh",
  refresh_cookie_secure: true

# Runtime production configuration, including reading
# of environment variables, is done on config/runtime.exs.
