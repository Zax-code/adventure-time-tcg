defmodule AdventureTimeApi.AccessAssessment.PlayIntegrity do
  @moduledoc false

  @callback decode(String.t(), map(), keyword()) :: {:ok, map()} | {:error, atom()}

  def decode(token, expected) do
    started_at = System.monotonic_time()
    config = Application.get_env(:adventure_time_api, __MODULE__, [])
    adapter = Keyword.get(config, :adapter, AdventureTimeApi.AccessAssessment.GooglePlayIntegrity)
    result = adapter.decode(token, expected, runtime_options(config))

    :telemetry.execute(
      [:adventure_time_api, :access_assessment, :provider],
      %{count: 1, duration: System.monotonic_time() - started_at},
      %{provider: :play_integrity, result: result_class(result)}
    )

    result
  end

  defp result_class({:ok, _evidence}), do: :ok
  defp result_class({:error, reason}) when is_atom(reason), do: reason
  defp result_class(_result), do: :unknown_error

  defp runtime_options(config) do
    Keyword.put_new_lazy(config, :access_token_provider, fn ->
      fn -> AdventureTimeApi.AccessAssessment.ServiceAccountAccessToken.fetch(config) end
    end)
  end
end
