defmodule AdventureTimeApi.Accounts.EmailDelivery.NoopAdapter do
  @moduledoc false

  @behaviour AdventureTimeApi.Accounts.EmailDelivery

  def send_verification_code(_email, _code, _opts), do: :ok
  def send_password_reset_code(_email, _code, _opts), do: :ok
end
