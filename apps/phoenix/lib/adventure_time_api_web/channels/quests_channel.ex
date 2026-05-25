defmodule AdventureTimeApiWeb.QuestsChannel do
  use Phoenix.Channel

  alias AdventureTimeApi.PubSub

  @impl true
  def join("quests:" <> user_id, _params, %{assigns: %{auth_user: auth_user}} = socket) do
    if auth_user.id == user_id do
      Phoenix.PubSub.subscribe(PubSub, "quests:#{user_id}")
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  def join(_topic, _params, _socket), do: {:error, %{reason: "unauthorized"}}

  @impl true
  def handle_info({:quest_reset, payload}, socket) do
    push(socket, "quest_reset", payload)
    {:noreply, socket}
  end
end
