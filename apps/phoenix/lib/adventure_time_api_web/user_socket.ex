defmodule AdventureTimeApiWeb.UserSocket do
  use Phoenix.Socket

  alias AdventureTimeApi.Accounts

  channel("quests:*", AdventureTimeApiWeb.QuestsChannel)

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case Accounts.fetch_auth_user_from_access_token(token) do
      {:ok, auth_user} ->
        {:ok, assign(socket, :auth_user, auth_user)}

      _ ->
        :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  def id(socket), do: "users_socket:#{socket.assigns.auth_user.id}"
end
