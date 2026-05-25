defmodule AdventureTimeApiWeb.Plugs.RequireAuth do
  import Plug.Conn

  alias AdventureTimeApi.Accounts

  def init(opts), do: opts

  def call(conn, _opts) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {:ok, auth_user} <- Accounts.fetch_auth_user_from_access_token(token) do
      assign(conn, :auth_user, auth_user)
    else
      _ ->
        conn
        |> put_status(:unauthorized)
        |> Phoenix.Controller.json(%{error: "Unauthorized"})
        |> halt()
    end
  end
end
