defmodule AdventureTimeApiWeb.HealthController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Health

  def show(conn, _params) do
    json(conn, %{status: "ok", service: "phoenix"})
  end

  def ready(conn, _params) do
    case Health.ready?() do
      :ok ->
        json(conn, %{status: "ready", service: "phoenix"})

      {:error, _reason} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{status: "not_ready", service: "phoenix"})
    end
  end
end
