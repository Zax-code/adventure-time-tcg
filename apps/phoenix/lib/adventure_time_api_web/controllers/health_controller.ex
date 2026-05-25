defmodule AdventureTimeApiWeb.HealthController do
  use AdventureTimeApiWeb, :controller

  def show(conn, _params) do
    json(conn, %{status: "ok", service: "phoenix"})
  end

  def ready(conn, _params) do
    json(conn, %{status: "ready", service: "phoenix"})
  end
end
