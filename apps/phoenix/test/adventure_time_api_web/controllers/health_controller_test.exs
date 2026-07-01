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
    assert body =~ "Service components"
    assert body =~ "All systems operational"
    assert body =~ "data-status-page"
    assert body =~ ~s(href="/ready")
  end
end
