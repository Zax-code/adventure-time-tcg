defmodule AdventureTimeApiWeb.WebSessionControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Repo
  alias AdventureTimeApiWeb.Plugs.RateLimit
  alias AdventureTimeApiWeb.WebSessionController

  @cookie_name "adventure_time_refresh"

  test "web session endpoints require the custom web header and JSON content type" do
    missing_header =
      build_conn()
      |> put_req_header("accept", "application/json")
      |> put_req_header("content-type", "application/json")
      |> post("/web/session", Jason.encode!(%{email: "finn@example.com", password: "secret123"}))

    assert json_response(missing_header, 403) == %{
             "code" => "WEB_REQUEST_REQUIRED",
             "error" => "Web session request required"
           }

    wrong_content_type =
      build_conn()
      |> put_req_header("accept", "application/json")
      |> put_req_header("content-type", "application/x-www-form-urlencoded")
      |> put_req_header("x-adventure-time-web", "1")
      |> post("/web/session", "email=finn%40example.com&password=secret123")

    assert json_response(wrong_content_type, 415) == %{
             "code" => "JSON_REQUIRED",
             "error" => "Application JSON content type required"
           }
  end

  test "login returns a short-lived access token and keeps refresh token only in the cookie" do
    user = create_user_with_password("web-login@example.com", "secret123")

    conn =
      web_json_conn()
      |> post(
        "/web/session",
        Jason.encode!(%{email: user.email, password: "secret123"})
      )

    body = json_response(conn, 200)

    assert body["user"]["id"] == user.id
    assert is_binary(body["accessToken"])
    refute Map.has_key?(body, "tokens")
    refute inspect(body) =~ "refreshToken"
    assert get_resp_header(conn, "cache-control") == ["no-store"]
    assert get_resp_header(conn, "pragma") == ["no-cache"]

    assert [cookie] = get_resp_header(conn, "set-cookie")
    assert cookie =~ "#{@cookie_name}="
    assert cookie =~ "HttpOnly"
    assert cookie =~ "SameSite=Strict"
    assert String.downcase(cookie) =~ "path=/"
    refute String.downcase(cookie) =~ "secure"

    me_conn =
      build_conn()
      |> put_req_header("accept", "application/json")
      |> put_req_header("authorization", "Bearer #{body["accessToken"]}")
      |> get("/me")

    assert json_response(me_conn, 200)["id"] == user.id
  end

  test "refresh uses the HttpOnly cookie, returns no refresh token, and renews the cookie" do
    user = create_user_with_password("web-refresh@example.com", "secret123")
    login_conn = login_web_user(user.email, "secret123")

    refresh_conn =
      login_conn
      |> recycle()
      |> web_json_conn()
      |> post("/web/session/refresh", Jason.encode!(%{}))

    body = json_response(refresh_conn, 200)

    assert body["user"]["id"] == user.id
    assert is_binary(body["accessToken"])
    refute inspect(body) =~ "refreshToken"
    assert [cookie] = get_resp_header(refresh_conn, "set-cookie")
    assert cookie =~ "#{@cookie_name}="
    assert cookie =~ "HttpOnly"
    assert cookie =~ "SameSite=Strict"
  end

  test "logout revokes the refresh session, clears its cookie, and is idempotent" do
    user = create_user_with_password("web-logout@example.com", "secret123")
    login_conn = login_web_user(user.email, "secret123")
    refresh_token = login_conn.resp_cookies[@cookie_name].value

    logout_conn =
      login_conn
      |> recycle()
      |> web_json_conn()
      |> delete("/web/session", Jason.encode!(%{}))

    assert response(logout_conn, 204) == ""
    assert [cookie] = get_resp_header(logout_conn, "set-cookie")
    assert cookie =~ "#{@cookie_name}="
    assert String.downcase(cookie) =~ "max-age=0"
    assert cookie =~ "SameSite=Strict"

    revoked_refresh =
      build_conn()
      |> put_req_header("accept", "application/json")
      |> post("/auth/refresh", %{"refreshToken" => refresh_token})

    assert json_response(revoked_refresh, 401)["error"] == "Session not found."

    refresh_conn =
      logout_conn
      |> recycle()
      |> web_json_conn()
      |> post("/web/session/refresh", Jason.encode!(%{}))

    assert json_response(refresh_conn, 401) == %{
             "code" => "WEB_SESSION_MISSING",
             "error" => "Web session is missing"
           }

    second_logout =
      refresh_conn
      |> recycle()
      |> web_json_conn()
      |> delete("/web/session", Jason.encode!(%{}))

    assert response(second_logout, 204) == ""
  end

  test "production cookie configuration uses the __Host prefix and Secure attribute" do
    original = Application.fetch_env!(:adventure_time_api, WebSessionController)

    Application.put_env(
      :adventure_time_api,
      WebSessionController,
      Keyword.merge(original,
        refresh_cookie_name: "__Host-adventure_time_refresh",
        refresh_cookie_secure: true
      )
    )

    on_exit(fn ->
      Application.put_env(:adventure_time_api, WebSessionController, original)
    end)

    user = create_user_with_password("web-secure-cookie@example.com", "secret123")
    conn = login_web_user(user.email, "secret123")

    assert [cookie] = get_resp_header(conn, "set-cookie")
    assert cookie =~ "__Host-adventure_time_refresh="
    assert String.downcase(cookie) =~ "secure"
    assert cookie =~ "HttpOnly"
    assert cookie =~ "SameSite=Strict"
    assert String.downcase(cookie) =~ "path=/"
  end

  test "web login shares the configured authentication rate limit" do
    original = Application.fetch_env!(:adventure_time_api, RateLimit)
    buckets = Keyword.fetch!(original, :buckets)

    Application.put_env(
      :adventure_time_api,
      RateLimit,
      Keyword.put(
        original,
        :buckets,
        Map.put(buckets, :auth_login, %{limit: 1, scale_ms: 60_000})
      )
    )

    on_exit(fn -> Application.put_env(:adventure_time_api, RateLimit, original) end)

    first =
      web_json_conn()
      |> post(
        "/web/session",
        Jason.encode!(%{email: "missing@example.com", password: "secret123"})
      )

    assert json_response(first, 401)["error"] == "Invalid email or password."

    second =
      web_json_conn()
      |> post(
        "/web/session",
        Jason.encode!(%{email: "missing@example.com", password: "secret123"})
      )

    assert json_response(second, 429) == %{
             "code" => "RATE_LIMITED",
             "error" => "Too many requests"
           }
  end

  test "the existing mobile login contract remains bearer-token based" do
    user = create_user_with_password("mobile-contract@example.com", "secret123")

    conn =
      build_conn()
      |> put_req_header("accept", "application/json")
      |> post("/auth/login", %{email: user.email, password: "secret123"})

    body = json_response(conn, 200)

    assert is_binary(get_in(body, ["tokens", "accessToken"]))
    assert is_binary(get_in(body, ["tokens", "refreshToken"]))
    assert get_resp_header(conn, "set-cookie") == []
  end

  defp web_json_conn(conn \\ build_conn()) do
    conn
    |> put_req_header("accept", "application/json")
    |> put_req_header("content-type", "application/json")
    |> put_req_header("x-adventure-time-web", "1")
  end

  defp login_web_user(email, password) do
    web_json_conn()
    |> post("/web/session", Jason.encode!(%{email: email, password: password}))
  end

  defp create_user_with_password(email, password) do
    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: "Web Tester"})
        |> User.access_changeset(%{role: :user, access_status: :approved})
      )

    Repo.insert!(
      EmailCredential.changeset(%EmailCredential{}, %{
        password_hash: Bcrypt.hash_pwd_salt(password),
        email_verified_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    user
  end
end
