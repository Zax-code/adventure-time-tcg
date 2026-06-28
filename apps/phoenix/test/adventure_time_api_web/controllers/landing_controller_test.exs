defmodule AdventureTimeApiWeb.LandingControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  test "GET / returns a branded HTML landing page", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> get(~p"/")

    assert html_response(conn, 200) =~ "Adventure Time TCG"
    assert get_resp_header(conn, "content-type") == ["text/html; charset=utf-8"]
  end

  test "GET /privacy returns the public privacy policy", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> get(~p"/privacy")

    body = html_response(conn, 200)
    assert body =~ "Privacy Policy"
    assert body =~ "Optional step-sync data"
  end

  test "GET /account-deletion returns public deletion instructions", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> get(~p"/account-deletion")

    body = html_response(conn, 200)
    assert body =~ "Account Deletion"
    assert body =~ "Delete from settings"
  end
end
