defmodule AdventureTimeApiWeb.WebSessionControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{
    AppleAuth,
    AuthProviderIdentity,
    EmailCredential,
    GoogleAuth,
    User
  }

  alias AdventureTimeApi.Repo
  alias AdventureTimeApiWeb.Plugs.RateLimit
  alias AdventureTimeApiWeb.WebSessionController

  @cookie_name "adventure_time_refresh"

  test "provider configuration exposes only usable public browser identifiers" do
    unavailable_conn =
      web_json_conn()
      |> get("/web/auth/config")

    assert json_response(unavailable_conn, 200) == %{
             "apple" => nil,
             "googleClientId" => nil
           }

    original = Application.fetch_env!(:adventure_time_api, WebSessionController)

    Application.put_env(
      :adventure_time_api,
      WebSessionController,
      Keyword.merge(original,
        google_client_id: " google-browser-client ",
        apple_client_id: "apple.web.service",
        apple_redirect_uri: "https://app.example.com/auth/apple/callback"
      )
    )

    on_exit(fn ->
      Application.put_env(:adventure_time_api, WebSessionController, original)
    end)

    configured_conn =
      web_json_conn()
      |> get("/web/auth/config")

    assert json_response(configured_conn, 200) == %{
             "apple" => %{
               "clientId" => "apple.web.service",
               "redirectUri" => "https://app.example.com/auth/apple/callback"
             },
             "googleClientId" => "google-browser-client"
           }

    assert get_resp_header(configured_conn, "cache-control") == ["no-store"]

    Application.put_env(
      :adventure_time_api,
      WebSessionController,
      Keyword.put(
        Application.fetch_env!(:adventure_time_api, WebSessionController),
        :apple_redirect_uri,
        "http://app.example.com/auth/apple/callback"
      )
    )

    insecure_conn =
      web_json_conn()
      |> get("/web/auth/config")

    assert json_response(insecure_conn, 200)["apple"] == nil
  end

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

  test "Google provider login creates the same cookie-backed web session" do
    user = create_user_without_password("web-google@example.com")
    bypass = Bypass.open()

    Bypass.expect_once(bypass, "GET", "/tokeninfo", fn conn ->
      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{
          "aud" => "test-google-client-id",
          "sub" => "web-google-subject",
          "email" => user.email,
          "email_verified" => "true",
          "name" => "Web Google"
        })
      )
    end)

    original_google_config = Application.get_env(:adventure_time_api, GoogleAuth)

    Application.put_env(:adventure_time_api, GoogleAuth,
      id_token_info_url: "http://127.0.0.1:#{bypass.port}/tokeninfo"
    )

    on_exit(fn ->
      if original_google_config do
        Application.put_env(:adventure_time_api, GoogleAuth, original_google_config)
      else
        Application.delete_env(:adventure_time_api, GoogleAuth)
      end
    end)

    conn =
      web_json_conn()
      |> post(
        "/web/session/google",
        Jason.encode!(%{idToken: "provider-token", preferredLanguage: "en"})
      )

    body = json_response(conn, 200)

    assert body["user"]["id"] == user.id

    assert body["user"]["authMethods"] == %{
             "apple" => false,
             "google" => true,
             "password" => false
           }

    assert is_binary(body["accessToken"])
    refute Map.has_key?(body, "tokens")
    refute inspect(body) =~ "refreshToken"

    assert [cookie] = get_resp_header(conn, "set-cookie")
    assert cookie =~ "#{@cookie_name}="
    assert cookie =~ "HttpOnly"
    assert cookie =~ "SameSite=Strict"

    identity = Repo.get_by!(AuthProviderIdentity, provider: "google")
    assert identity.user_id == user.id
  end

  test "Apple provider login creates the same cookie-backed web session" do
    user = create_user_without_password("web-apple@example.com")
    bypass = Bypass.open()
    jwk = JOSE.JWK.generate_key({:rsa, 2048})
    kid = "web-apple-key"

    public_jwk =
      jwk
      |> JOSE.JWK.to_public()
      |> JOSE.JWK.to_map()
      |> elem(1)
      |> Map.merge(%{"kid" => kid, "alg" => "RS256", "use" => "sig"})

    Bypass.stub(bypass, "GET", "/auth/keys", fn conn ->
      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(200, Jason.encode!(%{"keys" => [public_jwk]}))
    end)

    original_apple_config = Application.get_env(:adventure_time_api, AppleAuth)

    Application.put_env(:adventure_time_api, AppleAuth,
      keys_url: "http://127.0.0.1:#{bypass.port}/auth/keys"
    )

    on_exit(fn ->
      if original_apple_config do
        Application.put_env(:adventure_time_api, AppleAuth, original_apple_config)
      else
        Application.delete_env(:adventure_time_api, AppleAuth)
      end
    end)

    nonce = "web-apple-nonce"
    now = DateTime.utc_now() |> DateTime.to_unix()

    identity_token =
      jwk
      |> JOSE.JWT.sign(
        %{"alg" => "RS256", "kid" => kid},
        %{
          "iss" => "https://appleid.apple.com",
          "aud" => "love.leaetzak.adventuretime",
          "sub" => "web-apple-subject",
          "email" => user.email,
          "email_verified" => true,
          "nonce" => sha256_hex(nonce),
          "iat" => now,
          "exp" => now + 300
        }
      )
      |> JOSE.JWS.compact()
      |> elem(1)

    conn =
      web_json_conn()
      |> post(
        "/web/session/apple",
        Jason.encode!(%{
          identityToken: identity_token,
          nonce: nonce,
          preferredLanguage: "en"
        })
      )

    body = json_response(conn, 200)

    assert body["user"]["id"] == user.id

    assert body["user"]["authMethods"] == %{
             "apple" => true,
             "google" => false,
             "password" => false
           }

    assert is_binary(body["accessToken"])
    refute inspect(body) =~ "refreshToken"
    assert [cookie] = get_resp_header(conn, "set-cookie")
    assert cookie =~ "#{@cookie_name}="
    assert cookie =~ "HttpOnly"

    identity = Repo.get_by!(AuthProviderIdentity, provider: "apple")
    assert identity.user_id == user.id
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

  defp create_user_without_password(email) do
    Repo.insert!(
      User.registration_changeset(%User{}, %{email: email, display_name: "Web Provider"})
      |> User.access_changeset(%{role: :user, access_status: :approved})
    )
  end

  defp sha256_hex(value) do
    :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)
  end
end
