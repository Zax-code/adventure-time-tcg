defmodule AdventureTimeApiWeb.ErrorHTMLTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  test "unknown browser route renders the custom 404 page", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> get("/this-route-does-not-exist")

    html = html_response(conn, 404)

    assert html =~ "This page is missing from the collection"
    assert html =~ "notFound.kicker"
    assert html =~ "No secret endpoint map here"
    assert html =~ "FR"
    refute html =~ "Available routes"
    refute html =~ "AdventureTimeApiWeb.Router"
    refute html =~ "&lt;!DOCTYPE html&gt;"
  end

  test "unknown JSON route returns a compact JSON 404", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "application/json")
      |> get("/definitely-not-an-api-route")

    assert json_response(conn, 404) == %{"error" => "Not Found"}
  end
end
