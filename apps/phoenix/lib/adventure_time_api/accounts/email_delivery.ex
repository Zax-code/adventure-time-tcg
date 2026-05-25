defmodule AdventureTimeApi.Accounts.EmailDelivery do
  @moduledoc false

  @callback send_verification_code(String.t(), String.t()) :: :ok | {:error, String.t()}

  def send_verification_code(email, code) do
    adapter().send_verification_code(email, code)
  end

  defp adapter do
    Application.get_env(
      :adventure_time_api,
      __MODULE__,
      adapter: AdventureTimeApi.Accounts.EmailDelivery.SendmailAdapter
    )[:adapter]
  end
end
