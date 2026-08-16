defmodule AdventureTimeApi.AccessAssessment.PlayIntegrity do
  @moduledoc false

  @callback decode(String.t(), map(), keyword()) :: {:ok, map()} | {:error, atom()}

  def decode(token, expected) do
    config = Application.get_env(:adventure_time_api, __MODULE__, [])
    adapter = Keyword.get(config, :adapter, AdventureTimeApi.AccessAssessment.GooglePlayIntegrity)
    adapter.decode(token, expected, runtime_options(config))
  end

  defp runtime_options(config) do
    Keyword.put_new_lazy(config, :access_token_provider, fn ->
      fn -> AdventureTimeApi.AccessAssessment.ServiceAccountAccessToken.fetch(config) end
    end)
  end
end
