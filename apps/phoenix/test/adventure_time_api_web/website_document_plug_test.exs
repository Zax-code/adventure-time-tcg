defmodule AdventureTimeApiWeb.WebsiteDocumentPlugTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  @website_routes [
    "/",
    "/status",
    "/privacy",
    "/account-deletion",
    "/email/verify?email=finn%40example.com&code=123456",
    "/password/reset?email=finn%40example.com&code=123456",
    "/login",
    "/register",
    "/404",
    "/home",
    "/collection",
    "/collection/finn-the-human",
    "/packs",
    "/gifts",
    "/quests",
    "/quests/daily-numbers",
    "/quests/daily-numbers/play",
    "/quests/daily-numbers/history",
    "/quests/speed-calculus",
    "/quests/speed-calculus/training",
    "/quests/wordle",
    "/pvp",
    "/pvp/loadouts",
    "/pvp/match/9f23",
    "/pvp/history",
    "/pvp/history/9f22",
    "/pvp/spectate",
    "/pvp/spectate/9f21",
    "/pvp/mechanics",
    "/pvp/reference",
    "/settings",
    "/admin",
    "/admin/cards",
    "/admin/cards/finn-the-human",
    "/admin/packs",
    "/admin/packs/hero-pack",
    "/admin/card-backs",
    "/admin/image-assets",
    "/admin/featured",
    "/admin/abilities",
    "/admin/abilities/heroic-guard",
    "/admin/users",
    "/admin/users/rowan",
    "/admin/email-requests",
    "/admin/balance"
  ]

  test "all 45 website route patterns serve the Vite document for browser navigation" do
    assert length(@website_routes) == 45

    for path <- @website_routes do
      conn =
        build_conn()
        |> put_req_header("accept", "text/html,application/xhtml+xml")
        |> put_req_header("sec-fetch-dest", "document")
        |> put_req_header("sec-fetch-mode", "navigate")
        |> get(path)

      assert html_response(conn, 200) =~ "data-website-test-index", path
      assert get_resp_header(conn, "cache-control") == ["no-store"]
      assert get_resp_header(conn, "x-content-type-options") == ["nosniff"]
      assert get_resp_header(conn, "x-frame-options") == ["DENY"]

      assert [csp] = get_resp_header(conn, "content-security-policy")
      assert csp =~ "default-src 'self'"
      assert csp =~ "frame-ancestors 'none'"
      refute csp =~ "unsafe-inline"
      refute csp =~ "unsafe-eval"
    end
  end

  test "HEAD website navigation is served without a response body" do
    conn =
      build_conn()
      |> put_req_header("accept", "text/html")
      |> put_req_header("sec-fetch-dest", "document")
      |> head("/home")

    assert response(conn, 200) == ""
    assert get_resp_header(conn, "content-type") == ["text/html; charset=utf-8"]
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  test "JSON and wildcard API requests fall through to the existing router" do
    json_conn =
      build_conn()
      |> put_req_header("accept", "application/json")
      |> get("/home")

    assert json_response(json_conn, 401) == %{"error" => "Unauthorized"}

    wildcard_conn =
      build_conn()
      |> put_req_header("accept", "*/*")
      |> get("/home")

    assert json_response(wildcard_conn, 401) == %{"error" => "Unauthorized"}
  end

  test "non-document fetches, static files, callbacks, and probes fall through" do
    fetch_conn =
      build_conn()
      |> put_req_header("accept", "text/html")
      |> put_req_header("sec-fetch-dest", "empty")
      |> put_req_header("sec-fetch-mode", "cors")
      |> get("/")

    refute html_response(fetch_conn, 200) =~ "data-website-test-index"

    static_conn =
      build_conn()
      |> put_req_header("accept", "text/html")
      |> put_req_header("sec-fetch-dest", "document")
      |> get("/assets/landing.css")

    assert response(static_conn, 200) =~ ":root"
    refute response(static_conn, 200) =~ "data-website-test-index"

    for path <- ["/api/fitbit/callback", "/fitbit/callback"] do
      callback_conn =
        build_conn()
        |> put_req_header("accept", "text/html")
        |> put_req_header("sec-fetch-dest", "document")
        |> get(path)

      assert callback_conn.status == 302
    end

    probe_conn =
      build_conn()
      |> put_req_header("accept", "*/*")
      |> get("/health")

    assert json_response(probe_conn, 200) == %{"service" => "phoenix", "status" => "ok"}
  end

  test "unknown browser navigation serves the application 404 without stealing JSON requests" do
    unknown_conn =
      build_conn()
      |> put_req_header("accept", "text/html,application/xhtml+xml")
      |> put_req_header("sec-fetch-dest", "document")
      |> put_req_header("sec-fetch-mode", "navigate")
      |> get("/not-a-website-route")

    assert html_response(unknown_conn, 404) =~ "data-website-test-index"
    assert get_resp_header(unknown_conn, "cache-control") == ["no-store"]

    unknown_json_conn =
      build_conn()
      |> put_req_header("accept", "application/json")
      |> get("/not-a-website-route")

    assert json_response(unknown_json_conn, 404) == %{"error" => "Not Found"}
  end

  test "provider scripts are narrowly allowed for popup authentication" do
    conn =
      build_conn()
      |> put_req_header("accept", "text/html")
      |> put_req_header("sec-fetch-dest", "document")
      |> get("/login")

    assert [csp] = get_resp_header(conn, "content-security-policy")
    assert csp =~ "script-src 'self' https://accounts.google.com https://appleid.cdn-apple.com"
    assert csp =~ "frame-src https://accounts.google.com https://appleid.apple.com"

    assert get_resp_header(conn, "cross-origin-opener-policy") == [
             "same-origin-allow-popups"
           ]
  end

  test "authorized machine requests do not receive the website document" do
    conn =
      build_conn()
      |> put_req_header("accept", "text/html")
      |> put_req_header("authorization", "Bearer machine-token")
      |> get("/")

    refute html_response(conn, 200) =~ "data-website-test-index"
  end
end
