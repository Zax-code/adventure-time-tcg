defmodule AdventureTimeApiWeb.ErrorHTMLTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  test "unknown browser route renders the custom 404 page", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> get("/this-route-does-not-exist")

    html = html_response(conn, 404)

    assert html =~ "This page wandered off"
    assert html =~ "Go to homepage"
    refute html =~ "&lt;!DOCTYPE html&gt;"
  end
end
