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
end
