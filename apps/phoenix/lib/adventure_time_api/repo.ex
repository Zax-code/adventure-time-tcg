defmodule AdventureTimeApi.Repo do
  use Ecto.Repo,
    otp_app: :adventure_time_api,
    adapter: Ecto.Adapters.Postgres
end
