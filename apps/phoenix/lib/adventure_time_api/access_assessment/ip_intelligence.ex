defmodule AdventureTimeApi.AccessAssessment.IpIntelligence do
  @moduledoc """
  Provider-neutral seam for external IP intelligence.
  """

  @type input :: %{
          required(:ip_address) => String.t(),
          optional(:user_agent) => String.t() | nil,
          optional(:accept_language) => String.t() | nil,
          optional(:identity_pseudonym) => String.t() | nil,
          optional(:installation_pseudonym) => String.t() | nil
        }

  @callback lookup(input(), keyword()) :: {:ok, map()} | {:error, atom()}

  def lookup(input) do
    started_at = System.monotonic_time()
    config = Application.get_env(:adventure_time_api, __MODULE__, [])

    result =
      case {Keyword.get(config, :adapter), Keyword.get(config, :api_key)} do
        {adapter, api_key} when is_atom(adapter) and is_binary(api_key) and api_key != "" ->
          adapter.lookup(input, config)

        _missing_configuration ->
          {:error, :provider_unavailable}
      end

    :telemetry.execute(
      [:adventure_time_api, :access_assessment, :provider],
      %{count: 1, duration: System.monotonic_time() - started_at},
      %{provider: :ipqs, result: result_class(result)}
    )

    result
  end

  defp result_class({:ok, _evidence}), do: :ok
  defp result_class({:error, reason}) when is_atom(reason), do: reason
  defp result_class(_result), do: :unknown_error
end
