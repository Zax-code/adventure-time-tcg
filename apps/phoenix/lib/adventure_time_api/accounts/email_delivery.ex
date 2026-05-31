defmodule AdventureTimeApi.Accounts.EmailDelivery do
  @moduledoc false

  @callback send_verification_code(String.t(), String.t(), keyword()) ::
              :ok | {:error, String.t()}

  @callback send_password_reset_code(String.t(), String.t(), keyword()) ::
              :ok | {:error, String.t()}

  def send_verification_code(email, code, opts \\ []) do
    adapter().send_verification_code(email, code, opts)
  end

  def send_password_reset_code(email, code, opts \\ []) do
    adapter().send_password_reset_code(email, code, opts)
  end

  defp adapter do
    Application.get_env(
      :adventure_time_api,
      __MODULE__,
      adapter: AdventureTimeApi.Accounts.EmailDelivery.SendmailAdapter
    )[:adapter]
  end
end
