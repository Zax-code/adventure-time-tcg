defmodule AdventureTimeApiWeb.ErrorHTMLTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  test "unknown browser route renders the redesigned website 404 shell", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html,application/xhtml+xml")
      |> put_req_header("sec-fetch-dest", "document")
      |> put_req_header("sec-fetch-mode", "navigate")
      |> get("/this-route-does-not-exist")

    html = html_response(conn, 404)

    assert html =~ "data-website-test-index"
    assert get_resp_header(conn, "cache-control") == ["no-store"]
    assert get_resp_header(conn, "content-security-policy") != []
    refute html =~ "AdventureTimeApiWeb.Router"
  end

  test "unknown JSON route returns a compact JSON 404", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> get("/definitely-not-an-api-route")

    assert json_response(conn, 404) == %{"error" => "Not Found"}
  end
end
