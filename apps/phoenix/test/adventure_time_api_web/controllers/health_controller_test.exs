defmodule AdventureTimeApiWeb.HealthControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  test "GET /health", %{conn: conn} do
    conn = get(conn, ~p"/health")

    assert json_response(conn, 200) == %{
             "service" => "phoenix",
             "status" => "ok"
           }
  end

  test "GET /ready", %{conn: conn} do
    conn = get(conn, ~p"/ready")

    assert json_response(conn, 200) == %{
             "service" => "phoenix",
             "status" => "ready"
           }
  end
end
