defmodule AdventureTimeApi.Accounts.AuthError do
  defexception [:message, :status_code, :code, :details]
end
