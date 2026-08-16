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
    config = Application.get_env(:adventure_time_api, __MODULE__, [])

    case {Keyword.get(config, :adapter), Keyword.get(config, :api_key)} do
      {adapter, api_key} when is_atom(adapter) and is_binary(api_key) and api_key != "" ->
        adapter.lookup(input, config)

      _missing_configuration ->
        {:error, :provider_unavailable}
    end
  end
end
