defmodule AdventureTimeApiWeb.LandingControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  test "GET / keeps the branded HTML fallback for non-document requests", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> put_req_header("sec-fetch-dest", "empty")
      |> get(~p"/")

    assert html_response(conn, 200) =~ "Adventure Time TCG"
    assert get_resp_header(conn, "content-type") == ["text/html; charset=utf-8"]
  end

  test "GET /privacy keeps the public privacy fallback for non-document requests", %{conn: conn} do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> put_req_header("sec-fetch-dest", "empty")
      |> get(~p"/privacy")

    body = html_response(conn, 200)
    assert body =~ "Privacy Policy"
    assert body =~ "Optional step-sync data"
  end

  test "GET /account-deletion keeps public deletion fallback for non-document requests", %{
    conn: conn
  } do
    conn =
      conn
      |> put_req_header("accept", "text/html")
      |> put_req_header("sec-fetch-dest", "empty")
      |> get(~p"/account-deletion")

    body = html_response(conn, 200)
    assert body =~ "Account Deletion"
    assert body =~ "Delete from settings"
  end
end
