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

  test "GET /status renders the human-facing status page", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> get(~p"/status")

    body = html_response(conn, 200)
    assert get_resp_header(conn, "content-type") == ["text/html; charset=utf-8"]
    assert body =~ "What this status covers"
    assert body =~ "Checking Adventure Time TCG"
    assert body =~ "data-status-page"
    assert body =~ "Contact support"
  end
end
