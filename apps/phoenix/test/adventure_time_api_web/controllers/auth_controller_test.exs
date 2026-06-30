defmodule AdventureTimeApiWeb.AuthControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  import Ecto.Query

  alias AdventureTimeApi.Auth

  alias AdventureTimeApi.Accounts.{
    AppleAuth,
    AuthAttempt,
    AuthProviderIdentity,
    EmailAccessRequest,
    EmailCredential,
    EmailVerificationCode,
    Session,
    User
  }

  alias AdventureTimeApi.Accounts.GoogleAuth
  alias AdventureTimeApi.Notifications.Device
  alias AdventureTimeApi.Repo

  setup do
    rate_limit_config =
      Application.get_env(:adventure_time_api, AdventureTimeApiWeb.Plugs.RateLimit)

    on_exit(fn ->
      Application.put_env(
        :adventure_time_api,
        AdventureTimeApiWeb.Plugs.RateLimit,
        rate_limit_config
      )
    end)

    :ok
  end

  test "POST /auth/register creates a pending user and returns verification payload", %{
    conn: conn
  } do
    conn =
      conn
      |> put_req_header("x-forwarded-for", "203.0.113.10")
      |> put_req_header("user-agent", "AdventureTimeNative/99")
      |> put_req_header("accept-language", "fr-FR")
      |> put_req_header("x-adventure-time-platform", "ios")
      |> put_req_header("x-adventure-time-app-version", "1.2.3")
      |> put_req_header("x-adventure-time-build-number", "456")
      |> put_req_header("x-adventure-time-installation-id", "install-register")
      |> post(~p"/auth/register", %{
        email: "finn@example.com",
        password: "supersecure",
        displayName: "Finn",
        preferredLanguage: "fr"
      })

    body = json_response(conn, 201)

    assert %{
             "success" => true,
             "message" => "Verification code sent",
             "authorized" => false,
             "accessRequestPending" => true,
             "devCode" => dev_code
           } = body

    assert dev_code =~ ~r/^\d{6}$/

    user = Repo.get_by!(User, email: "finn@example.com")
    credential = Repo.get_by!(EmailCredential, user_id: user.id)
    request = Repo.get_by!(EmailAccessRequest, email: user.email)

    assert user.access_status == :pending
    assert user.role == :user
    assert user.preferred_language == :fr
    assert credential.email_verified_at == nil
    assert request.status == :pending
    assert request.requested_locale == :fr
    assert request.provider == "email"
    assert request.last_ip_address == "203.0.113.10"
    assert request.last_user_agent == "AdventureTimeNative/99"
    assert request.last_accept_language == "fr-FR"
    assert request.last_client_platform == "ios"
    assert request.last_client_app_version == "1.2.3"
    assert request.last_client_build_number == "456"
    assert byte_size(request.last_installation_id_hash) == 64
    assert request.last_installation_id_hash != "install-register"
    assert request.last_attestation_status == "not_provided"
    assert request.attempt_count == 1

    attempt = Repo.get_by!(AuthAttempt, email: "finn@example.com")
    assert attempt.event_type == "email_register_access_request"
    assert attempt.provider == "email"
    assert attempt.status_code == 201
    assert attempt.ip_address == "203.0.113.10"
    assert attempt.client_platform == "ios"
    assert attempt.installation_id_hash == request.last_installation_id_hash
    assert attempt.metadata == %{}
  end

  test "POST /auth/register rejects an existing pending account", %{
    conn: conn
  } do
    post(conn, ~p"/auth/register", %{
      email: "bmo@example.com",
      password: "supersecure",
      displayName: "BMO",
      preferredLanguage: "en"
    })

    conn =
      post(build_conn(), ~p"/auth/register", %{
        email: "bmo@example.com",
        password: "supersecure",
        displayName: "BMO",
        preferredLanguage: "fr"
      })

    assert json_response(conn, 409) == %{
             "error" =>
               "An account or access request already exists for this email. Sign in with the original method or wait for approval."
           }

    user = Repo.get_by!(User, email: "bmo@example.com")
    request = Repo.get_by!(EmailAccessRequest, email: user.email)

    assert user.preferred_language == :en
    assert request.requested_locale == :en
  end

  test "POST /auth/register rejects an existing provider access request", %{conn: conn} do
    Repo.insert!(
      EmailAccessRequest.changeset(%EmailAccessRequest{}, %{
        email: "provider-pending@example.com",
        status: :pending,
        provider: "google"
      })
    )

    conn =
      post(conn, ~p"/auth/register", %{
        email: "provider-pending@example.com",
        password: "supersecure",
        displayName: "Provider Pending",
        preferredLanguage: "fr"
      })

    assert json_response(conn, 409) == %{
             "error" =>
               "An account or access request already exists for this email. Sign in with the original method or wait for approval."
           }
  end

  test "POST /auth/register rejects an approved provider-only account", %{conn: conn} do
    create_user_without_password("provider-approved@example.com", "Provider Approved",
      access_status: :approved
    )

    conn =
      post(conn, ~p"/auth/register", %{
        email: "provider-approved@example.com",
        password: "supersecure",
        displayName: "Provider Approved",
        preferredLanguage: "fr"
      })

    assert json_response(conn, 409) == %{
             "error" =>
               "An account or access request already exists for this email. Sign in with the original method or wait for approval."
           }
  end

  test "POST /auth/register notifies super admins only for the first pending access request", %{
    conn: conn
  } do
    bypass = Bypass.open()
    original_config = Application.get_env(:adventure_time_api, AdventureTimeApi.Notifications, [])

    Application.put_env(
      :adventure_time_api,
      AdventureTimeApi.Notifications,
      Keyword.merge(original_config, push_api_url: bypass_url(bypass, "/--/api/v2/push/send"))
    )

    on_exit(fn ->
      Application.put_env(
        :adventure_time_api,
        AdventureTimeApi.Notifications,
        original_config
      )
    end)

    {:ok, requests} = Agent.start_link(fn -> [] end)

    Bypass.stub(bypass, "POST", "/--/api/v2/push/send", fn request_conn ->
      {:ok, raw_body, request_conn} = Plug.Conn.read_body(request_conn)
      payload = Jason.decode!(raw_body)
      Agent.update(requests, &[payload | &1])

      request_conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{
          "data" => Enum.map(payload, fn _ -> %{"status" => "ok", "id" => "ticket"} end)
        })
      )
    end)

    super_admin =
      create_user_with_password("access-boss@example.com", "password123", "Access Boss",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    Repo.insert!(
      Device.changeset(%Device{}, %{
        user_id: super_admin.id,
        installation_id: "access-boss-installation",
        platform: :ios,
        expo_push_token: "ExponentPushToken[access-boss]",
        last_registered_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
    )

    conn =
      post(conn, ~p"/auth/register", %{
        email: "notify-register@example.com",
        password: "supersecure",
        displayName: "Notify Me",
        preferredLanguage: "en"
      })

    assert json_response(conn, 201)["accessRequestPending"] == true

    conn =
      post(build_conn(), ~p"/auth/register", %{
        email: "notify-register@example.com",
        password: "supersecure",
        displayName: "Notify Me",
        preferredLanguage: "fr"
      })

    assert json_response(conn, 409) == %{
             "error" =>
               "An account or access request already exists for this email. Sign in with the original method or wait for approval."
           }

    assert [
             [
               %{
                 "body" => "notify-register@example.com is waiting for approval.",
                 "data" => %{
                   "email" => "notify-register@example.com",
                   "eventType" => "access_request_created"
                 },
                 "title" => "New access request",
                 "to" => "ExponentPushToken[access-boss]"
               }
             ]
           ] = Agent.get(requests, &Enum.reverse/1)
  end

  test "POST /auth/verify-email marks the credential verified and keeps approval pending", %{
    conn: conn
  } do
    register_response =
      conn
      |> post(~p"/auth/register", %{
        email: "jake@example.com",
        password: "correct-horse",
        displayName: "Jake"
      })
      |> json_response(201)

    dev_code = register_response["devCode"]

    conn =
      post(build_conn(), ~p"/auth/verify-email", %{
        email: "jake@example.com",
        code: dev_code
      })

    assert json_response(conn, 200) == %{
             "success" => true,
             "message" => "Email verified",
             "authorized" => false,
             "accessRequestPending" => true
           }

    user = Repo.get_by!(User, email: "jake@example.com")
    credential = Repo.get_by!(EmailCredential, user_id: user.id)
    assert %DateTime{} = credential.email_verified_at
    assert user.access_status == :pending
  end

  test "POST /auth/login blocks unverified email accounts", %{conn: conn} do
    create_user_with_password("pb@example.com", "science-rules", "PB")

    conn =
      conn
      |> put_req_header("x-forwarded-for", "198.51.100.22")
      |> put_req_header("user-agent", "AdventureTimeNative/100")
      |> post(~p"/auth/login", %{
        email: "pb@example.com",
        password: "science-rules"
      })

    assert json_response(conn, 403) == %{
             "error" => "Email verification required.",
             "code" => "EMAIL_VERIFICATION_REQUIRED"
           }

    attempt = Repo.get_by!(AuthAttempt, email: "pb@example.com")
    assert attempt.event_type == "email_login_failed"
    assert attempt.provider == "email"
    assert attempt.status_code == 403
    assert attempt.error_code == "EMAIL_VERIFICATION_REQUIRED"
    assert attempt.ip_address == "198.51.100.22"
    assert attempt.user_agent == "AdventureTimeNative/100"
  end

  test "POST /auth/login blocks verified but unapproved email accounts", %{conn: conn} do
    create_user_with_password("marcy@example.com", "bassbass", "Marcy", verified?: true)

    conn =
      post(conn, ~p"/auth/login", %{
        email: "marcy@example.com",
        password: "bassbass"
      })

    assert json_response(conn, 403) == %{
             "error" => "This account is not approved yet. An access request has been submitted.",
             "code" => "ACCESS_REQUEST_PENDING"
           }
  end

  test "POST /auth/request-password-reset returns a generic success and creates a reset code", %{
    conn: conn
  } do
    user =
      create_user_with_password("resetme@example.com", "science-rules", "PB",
        verified?: true,
        access_status: :approved
      )

    conn = post(conn, ~p"/auth/request-password-reset", %{email: user.email})

    assert %{
             "success" => true,
             "message" =>
               "If an account matches this email, a password reset code has been sent.",
             "devCode" => dev_code
           } = json_response(conn, 200)

    assert dev_code =~ ~r/^\d{6}$/

    assert %EmailVerificationCode{purpose: :password_reset, used_at: nil} =
             Repo.one!(
               from(code in EmailVerificationCode,
                 where: code.email == ^user.email and code.purpose == :password_reset,
                 order_by: [desc: code.inserted_at],
                 limit: 1
               )
             )
  end

  test "POST /auth/request-password-reset validates email format without leaking account state",
       %{
         conn: conn
       } do
    conn = post(conn, ~p"/auth/request-password-reset", %{email: "not-an-email"})

    assert json_response(conn, 400) == %{
             "error" => "Invalid email format"
           }
  end

  test "POST /auth/reset-password updates the password and revokes active sessions", %{
    conn: conn
  } do
    user =
      create_user_with_password("reset-later@example.com", "old-password", "Reset User",
        verified?: true,
        access_status: :approved
      )

    login_response =
      build_conn()
      |> post(~p"/auth/login", %{email: user.email, password: "old-password"})
      |> json_response(200)

    old_refresh_token = get_in(login_response, ["tokens", "refreshToken"])

    request_response =
      build_conn()
      |> post(~p"/auth/request-password-reset", %{email: user.email})
      |> json_response(200)

    conn =
      post(conn, ~p"/auth/reset-password", %{
        email: user.email,
        code: request_response["devCode"],
        password: "new-password"
      })

    assert json_response(conn, 200) == %{
             "success" => true,
             "message" => "Password updated."
           }

    assert json_response(
             post(build_conn(), ~p"/auth/login", %{
               email: user.email,
               password: "old-password"
             }),
             401
           ) == %{"error" => "Invalid email or password."}

    assert get_in(
             post(build_conn(), ~p"/auth/login", %{
               email: user.email,
               password: "new-password"
             })
             |> json_response(200),
             ["tokens", "accessToken"]
           )

    assert json_response(
             post(build_conn(), ~p"/auth/refresh", %{"refreshToken" => old_refresh_token}),
             401
           ) == %{"error" => "Session not found."}
  end

  test "POST /auth/refresh rotates session for approved verified users", _context do
    user =
      create_user_with_password("bubblegum@example.com", "science-rules", "PB",
        verified?: true,
        access_status: :approved
      )

    response =
      build_conn()
      |> put_req_header("x-forwarded-for", "198.51.100.33")
      |> put_req_header("x-adventure-time-platform", "ios")
      |> post(~p"/auth/login", %{
        email: user.email,
        password: "science-rules"
      })
      |> json_response(200)

    refresh_token = get_in(response, ["tokens", "refreshToken"])

    conn = post(build_conn(), ~p"/auth/refresh", %{"refreshToken" => refresh_token})
    body = json_response(conn, 200)

    assert get_in(body, ["tokens", "refreshToken"]) != refresh_token
    assert Repo.aggregate(Session, :count, :id) == 2

    assert Repo.aggregate(
             from(session in Session, where: not is_nil(session.revoked_at)),
             :count,
             :id
           ) == 1
  end

  test "POST /auth/login issues a long-lived refresh session", %{conn: conn} do
    user =
      create_user_with_password("long-session@example.com", "science-rules", "Long Session",
        verified?: true,
        access_status: :approved
      )

    issued_after = DateTime.utc_now() |> DateTime.truncate(:second)

    response =
      conn
      |> put_req_header("x-adventure-time-platform", "ios")
      |> post(~p"/auth/login", %{
        email: user.email,
        password: "science-rules"
      })
      |> json_response(200)

    assert get_in(response, ["tokens", "refreshToken"])
    assert Auth.refresh_ttl_days() >= 180

    session = Repo.one!(from(session in Session, where: session.user_id == ^user.id))

    assert DateTime.diff(session.expires_at, issued_after, :day) >= 179

    attempt = Repo.get_by!(AuthAttempt, email: user.email)
    assert attempt.event_type == "email_login_success"
    assert attempt.status_code == 200
    assert attempt.client_platform == "ios"
  end

  test "POST /auth/refresh accepts an old signed refresh token while its database session is active",
       _context do
    auth_config = Application.get_env(:adventure_time_api, Auth)

    Application.put_env(
      :adventure_time_api,
      Auth,
      Keyword.put(auth_config, :refresh_token_ttl_days, -1)
    )

    on_exit(fn -> Application.put_env(:adventure_time_api, Auth, auth_config) end)

    user =
      create_user_with_password("legacy-session@example.com", "science-rules", "Legacy Session",
        verified?: true,
        access_status: :approved
      )

    session_id = Ecto.UUID.generate()
    {:ok, refresh_token} = Auth.sign_refresh_token(session_id, user.id)

    Repo.insert!(
      Session.changeset(%Session{}, %{
        id: session_id,
        refresh_token_hash: Bcrypt.hash_pwd_salt(refresh_token),
        expires_at: DateTime.utc_now() |> DateTime.add(180 * 24 * 60 * 60, :second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    conn = post(build_conn(), ~p"/auth/refresh", %{"refreshToken" => refresh_token})

    assert get_in(json_response(conn, 200), ["tokens", "refreshToken"])
  end

  test "POST /auth/refresh rejects refresh tokens whose database session expired", _context do
    user =
      create_user_with_password("expired-session@example.com", "science-rules", "Expired Session",
        verified?: true,
        access_status: :approved
      )

    session_id = Ecto.UUID.generate()
    {:ok, refresh_token} = Auth.sign_refresh_token(session_id, user.id)

    Repo.insert!(
      Session.changeset(%Session{}, %{
        id: session_id,
        refresh_token_hash: Bcrypt.hash_pwd_salt(refresh_token),
        expires_at: DateTime.utc_now() |> DateTime.add(-60, :second)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    conn = post(build_conn(), ~p"/auth/refresh", %{"refreshToken" => refresh_token})

    assert json_response(conn, 401) == %{"error" => "Session not found."}
  end

  test "POST /auth/google creates pending request when email is unknown", %{conn: conn} do
    bypass = start_bypass_google_tokeninfo("marceline@example.com")

    Application.put_env(:adventure_time_api, GoogleAuth,
      id_token_info_url: bypass_url(bypass, "/tokeninfo"),
      access_token_info_url: bypass_url(bypass, "/access-token-info"),
      userinfo_url: bypass_url(bypass, "/userinfo")
    )

    on_exit(fn -> Application.delete_env(:adventure_time_api, GoogleAuth) end)

    conn =
      conn
      |> put_req_header("x-forwarded-for", "74.125.210.168")
      |> put_req_header("user-agent", "okhttp/4.9.2")
      |> put_req_header("x-adventure-time-platform", "android")
      |> put_req_header("x-adventure-time-app-version", "0.3.10")
      |> put_req_header("x-adventure-time-build-number", "31")
      |> put_req_header("x-adventure-time-installation-id", "android-install")
      |> post(~p"/auth/google", %{"idToken" => "valid-token", "preferredLanguage" => "fr"})

    assert json_response(conn, 403) == %{
             "error" =>
               "This Google account is not approved yet. An access request has been submitted.",
             "code" => "ACCESS_REQUEST_PENDING"
           }

    request = Repo.get_by!(EmailAccessRequest, email: "marceline@example.com")
    assert request.status == :pending
    assert request.requested_locale == :fr
    assert request.provider == "google"
    assert request.google_name == "Marceline"
    assert request.google_picture_url == "https://example.com/marceline.png"
    assert request.last_ip_address == "74.125.210.168"
    assert request.last_user_agent == "okhttp/4.9.2"
    assert request.last_client_platform == "android"
    assert request.last_client_app_version == "0.3.10"
    assert request.last_client_build_number == "31"
    assert byte_size(request.provider_subject_hash) == 64
    assert request.provider_subject_hash != "google-subject-1"
    assert byte_size(request.last_installation_id_hash) == 64
    assert request.last_installation_id_hash != "android-install"

    attempt = Repo.get_by!(AuthAttempt, email: "marceline@example.com")
    assert attempt.event_type == "google_access_request"
    assert attempt.provider == "google"
    assert attempt.status_code == 403
    assert attempt.error_code == "ACCESS_REQUEST_PENDING"
    assert attempt.google_email_verified == true
    assert attempt.google_name == "Marceline"
    assert attempt.provider_subject_hash == request.provider_subject_hash
    assert attempt.installation_id_hash == request.last_installation_id_hash
  end

  test "POST /auth/google links an approved email account", %{conn: conn} do
    user =
      create_user_with_password("google-approved@example.com", "password123", "Google Approved",
        verified?: true,
        access_status: :approved
      )

    bypass = start_bypass_google_tokeninfo(user.email)

    Application.put_env(:adventure_time_api, GoogleAuth,
      id_token_info_url: bypass_url(bypass, "/tokeninfo"),
      access_token_info_url: bypass_url(bypass, "/access-token-info"),
      userinfo_url: bypass_url(bypass, "/userinfo")
    )

    on_exit(fn -> Application.delete_env(:adventure_time_api, GoogleAuth) end)

    response =
      conn
      |> post(~p"/auth/google", %{"idToken" => "valid-token", "preferredLanguage" => "en"})
      |> json_response(200)

    assert get_in(response, ["user", "id"]) == user.id

    assert get_in(response, ["user", "authMethods"]) == %{
             "password" => true,
             "google" => true,
             "apple" => false
           }

    identity = Repo.get_by!(AuthProviderIdentity, provider: "google")
    assert identity.user_id == user.id
    assert identity.email == user.email
    assert byte_size(identity.provider_subject_hash) == 64
    assert identity.provider_subject_hash != "google-subject-1"
  end

  test "POST /auth/google falls back to access token profile when userinfo fails", %{conn: conn} do
    bypass = Bypass.open()

    Bypass.expect_once(bypass, "GET", "/access-token-info", fn conn ->
      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{
          "aud" => "test-google-client-id",
          "sub" => "google-access-subject",
          "email" => "fallback-marcy@example.com",
          "email_verified" => "true",
          "name" => "Fallback Marceline",
          "picture" => "https://example.com/fallback-marceline.png"
        })
      )
    end)

    Bypass.expect_once(bypass, "GET", "/userinfo", fn conn ->
      Plug.Conn.resp(conn, 401, "temporarily unavailable")
    end)

    Application.put_env(:adventure_time_api, GoogleAuth,
      access_token_info_url: bypass_url(bypass, "/access-token-info"),
      userinfo_url: bypass_url(bypass, "/userinfo")
    )

    on_exit(fn -> Application.delete_env(:adventure_time_api, GoogleAuth) end)

    conn =
      post(conn, ~p"/auth/google", %{
        "accessToken" => "valid-access-token",
        "preferredLanguage" => "en"
      })

    assert json_response(conn, 403)["code"] == "ACCESS_REQUEST_PENDING"

    request = Repo.get_by!(EmailAccessRequest, email: "fallback-marcy@example.com")
    assert request.provider == "google"
    assert request.google_name == "Fallback Marceline"
    assert request.google_picture_url == "https://example.com/fallback-marceline.png"
    assert byte_size(request.provider_subject_hash) == 64
    assert request.provider_subject_hash != "google-access-subject"

    attempt = Repo.get_by!(AuthAttempt, email: "fallback-marcy@example.com")
    assert attempt.provider_subject_hash == request.provider_subject_hash
    assert attempt.google_email_verified == true
  end

  test "POST /auth/apple creates pending request when email is unknown", %{conn: conn} do
    %{bypass: bypass, jwk: jwk, kid: kid} = start_bypass_apple_keys()

    Application.put_env(:adventure_time_api, AppleAuth,
      keys_url: bypass_url(bypass, "/auth/keys")
    )

    on_exit(fn -> Application.delete_env(:adventure_time_api, AppleAuth) end)

    raw_nonce = "nonce-1"

    identity_token =
      apple_identity_token(jwk, kid, %{
        "sub" => "apple-subject-1",
        "email" => "fionna@example.com",
        "email_verified" => "true",
        "nonce" => sha256_hex(raw_nonce)
      })

    conn =
      conn
      |> put_req_header("x-forwarded-for", "17.0.0.1")
      |> put_req_header("user-agent", "AdventureTimeNative/34")
      |> put_req_header("x-adventure-time-platform", "ios")
      |> put_req_header("x-adventure-time-installation-id", "ios-install")
      |> post(~p"/auth/apple", %{
        "identityToken" => identity_token,
        "nonce" => raw_nonce,
        "preferredLanguage" => "fr",
        "fullName" => %{"givenName" => "Fionna", "familyName" => "Campbell"}
      })

    assert json_response(conn, 403) == %{
             "error" =>
               "This Apple account is not approved yet. An access request has been submitted.",
             "code" => "ACCESS_REQUEST_PENDING"
           }

    request = Repo.get_by!(EmailAccessRequest, email: "fionna@example.com")
    assert request.status == :pending
    assert request.requested_locale == :fr
    assert request.provider == "apple"
    assert request.google_name == "Fionna Campbell"
    assert request.last_ip_address == "17.0.0.1"
    assert request.last_user_agent == "AdventureTimeNative/34"
    assert request.last_client_platform == "ios"
    assert byte_size(request.provider_subject_hash) == 64
    assert request.provider_subject_hash != "apple-subject-1"
    assert byte_size(request.last_installation_id_hash) == 64
    assert request.last_installation_id_hash != "ios-install"

    attempt = Repo.get_by!(AuthAttempt, email: "fionna@example.com")
    assert attempt.event_type == "apple_access_request"
    assert attempt.provider == "apple"
    assert attempt.status_code == 403
    assert attempt.error_code == "ACCESS_REQUEST_PENDING"
    assert attempt.google_email_verified == true
    assert attempt.google_name == "Fionna Campbell"
    assert attempt.provider_subject_hash == request.provider_subject_hash
  end

  test "POST /auth/apple accepts Apple SHA-256 nonce claims", %{conn: conn} do
    %{bypass: bypass, jwk: jwk, kid: kid} = start_bypass_apple_keys()

    Application.put_env(:adventure_time_api, AppleAuth,
      keys_url: bypass_url(bypass, "/auth/keys")
    )

    on_exit(fn -> Application.delete_env(:adventure_time_api, AppleAuth) end)

    raw_nonce = "raw-apple-nonce"

    identity_token =
      apple_identity_token(jwk, kid, %{
        "sub" => "apple-hashed-nonce-subject",
        "email" => "hashed-nonce-fionna@example.com",
        "email_verified" => "true",
        "nonce" => sha256_hex(raw_nonce)
      })

    conn =
      conn
      |> post(~p"/auth/apple", %{
        "identityToken" => identity_token,
        "nonce" => raw_nonce,
        "preferredLanguage" => "fr"
      })

    assert json_response(conn, 403)["code"] == "ACCESS_REQUEST_PENDING"

    request = Repo.get_by!(EmailAccessRequest, email: "hashed-nonce-fionna@example.com")
    assert request.provider == "apple"
  end

  test "POST /auth/apple rejects raw nonce claims", %{conn: conn} do
    %{bypass: bypass, jwk: jwk, kid: kid} = start_bypass_apple_keys()

    Application.put_env(:adventure_time_api, AppleAuth,
      keys_url: bypass_url(bypass, "/auth/keys")
    )

    on_exit(fn -> Application.delete_env(:adventure_time_api, AppleAuth) end)

    raw_nonce = "raw-apple-nonce"

    identity_token =
      apple_identity_token(jwk, kid, %{
        "sub" => "apple-raw-nonce-subject",
        "email" => "raw-nonce-fionna@example.com",
        "email_verified" => "true",
        "nonce" => raw_nonce
      })

    conn =
      conn
      |> post(~p"/auth/apple", %{
        "identityToken" => identity_token,
        "nonce" => raw_nonce,
        "preferredLanguage" => "fr"
      })

    assert json_response(conn, 401) == %{
             "error" => "Apple authentication failed.",
             "code" => "APPLE_AUTH_FAILED"
           }

    refute Repo.get_by(EmailAccessRequest, email: "raw-nonce-fionna@example.com")
  end

  test "POST /auth/apple links approved user and later signs in without email", %{conn: conn} do
    %{bypass: bypass, jwk: jwk, kid: kid} = start_bypass_apple_keys()

    Application.put_env(:adventure_time_api, AppleAuth,
      keys_url: bypass_url(bypass, "/auth/keys")
    )

    on_exit(fn -> Application.delete_env(:adventure_time_api, AppleAuth) end)

    user =
      create_user_with_password("apple-approved@example.com", "science-rules", "Old Name",
        verified?: true,
        access_status: :approved
      )

    first_raw_nonce = "nonce-2"

    first_token =
      apple_identity_token(jwk, kid, %{
        "sub" => "apple-approved-subject",
        "email" => user.email,
        "email_verified" => "true",
        "nonce" => sha256_hex(first_raw_nonce)
      })

    first_response =
      conn
      |> post(~p"/auth/apple", %{
        "identityToken" => first_token,
        "nonce" => first_raw_nonce,
        "preferredLanguage" => "en",
        "fullName" => %{"givenName" => "Cake", "familyName" => "Cat"}
      })
      |> json_response(200)

    assert get_in(first_response, ["tokens", "accessToken"])
    assert get_in(first_response, ["user", "displayName"]) == "Cake Cat"

    assert get_in(first_response, ["user", "authMethods"]) == %{
             "password" => true,
             "google" => false,
             "apple" => true
           }

    identity = Repo.get_by!(AuthProviderIdentity, provider: "apple")
    assert identity.user_id == user.id
    assert identity.email == user.email
    assert byte_size(identity.provider_subject_hash) == 64

    second_raw_nonce = "nonce-3"

    second_token =
      apple_identity_token(jwk, kid, %{
        "sub" => "apple-approved-subject",
        "nonce" => sha256_hex(second_raw_nonce)
      })

    second_response =
      build_conn()
      |> post(~p"/auth/apple", %{
        "identityToken" => second_token,
        "nonce" => second_raw_nonce,
        "preferredLanguage" => "en"
      })
      |> json_response(200)

    assert get_in(second_response, ["user", "id"]) == user.id
    assert Repo.aggregate(AuthProviderIdentity, :count, :id) == 1
  end

  test "POST /auth/apple rejects unknown subject when Apple omits email", %{conn: conn} do
    %{bypass: bypass, jwk: jwk, kid: kid} = start_bypass_apple_keys()

    Application.put_env(:adventure_time_api, AppleAuth,
      keys_url: bypass_url(bypass, "/auth/keys")
    )

    on_exit(fn -> Application.delete_env(:adventure_time_api, AppleAuth) end)

    raw_nonce = "nonce-4"

    identity_token =
      apple_identity_token(jwk, kid, %{
        "sub" => "apple-no-email-subject",
        "nonce" => sha256_hex(raw_nonce)
      })

    conn =
      post(conn, ~p"/auth/apple", %{
        "identityToken" => identity_token,
        "nonce" => raw_nonce,
        "preferredLanguage" => "en"
      })

    assert json_response(conn, 400) == %{
             "error" =>
               "Apple did not return a verified email. Try again and share your email with the app.",
             "code" => "APPLE_EMAIL_MISSING"
           }

    attempt = Repo.get_by!(AuthAttempt, provider: "apple")
    assert attempt.event_type == "apple_login_failed"
    assert attempt.error_code == "APPLE_EMAIL_MISSING"
    assert attempt.email == nil
    assert byte_size(attempt.provider_subject_hash) == 64
  end

  test "GET /me returns authenticated user", %{conn: conn} do
    user =
      create_user_with_password("iceking@example.com", "penguin123", "Ice King",
        verified?: true,
        access_status: :approved,
        role: :super_admin
      )

    login_response =
      build_conn()
      |> post(~p"/auth/login", %{email: user.email, password: "penguin123"})
      |> json_response(200)

    access_token = get_in(login_response, ["tokens", "accessToken"])

    conn =
      conn
      |> put_req_header("authorization", "Bearer #{access_token}")
      |> get(~p"/me")

    assert json_response(conn, 200) == %{
             "id" => user.id,
             "email" => "iceking@example.com",
             "displayName" => "Ice King",
             "avatarAssetId" => nil,
             "coins" => 100,
             "dust" => 0,
             "authMethods" => %{
               "password" => true,
               "google" => false,
               "apple" => false
             },
             "isAdmin" => true,
             "isSuperAdmin" => true,
             "notificationPreferences" => %{
               "dailyReset" => true,
               "stepGoal" => true,
               "pvpInvite" => true,
               "pvpTurn" => true,
               "giftReceived" => true
             },
             "preferredStepSource" => "device_health",
             "preferredLanguage" => "en",
             "timezone" => "Europe/Paris"
           }
  end

  test "POST /auth/login is rate limited per email bucket", %{conn: conn} do
    Application.put_env(:adventure_time_api, AdventureTimeApiWeb.Plugs.RateLimit,
      buckets: %{
        auth_register: %{limit: 10, scale_ms: 60_000},
        auth_login: %{limit: 2, scale_ms: 60_000},
        auth_verify_email: %{limit: 10, scale_ms: 60_000},
        auth_resend_verification: %{limit: 10, scale_ms: 60_000},
        auth_request_password_reset: %{limit: 10, scale_ms: 60_000},
        auth_reset_password: %{limit: 10, scale_ms: 60_000},
        auth_google: %{limit: 10, scale_ms: 60_000},
        auth_apple: %{limit: 10, scale_ms: 60_000},
        auth_refresh: %{limit: 20, scale_ms: 60_000},
        pvp_match_write: %{limit: 30, scale_ms: 60_000}
      }
    )

    create_user_with_password("limit@example.com", "password123", "Limiter",
      verified?: true,
      access_status: :approved
    )

    assert json_response(
             post(conn, ~p"/auth/login", %{email: "limit@example.com", password: "password123"}),
             200
           )["tokens"]["accessToken"]

    assert json_response(
             post(build_conn(), ~p"/auth/login", %{
               email: "limit@example.com",
               password: "password123"
             }),
             200
           )["tokens"]["accessToken"]

    limited_conn =
      post(build_conn(), ~p"/auth/login", %{email: "limit@example.com", password: "password123"})

    assert json_response(limited_conn, 429) == %{
             "error" => "Too many requests",
             "code" => "RATE_LIMITED"
           }
  end

  defp create_user_with_password(email, password, display_name, opts \\ []) do
    role = Keyword.get(opts, :role, :user)
    access_status = Keyword.get(opts, :access_status, :pending)
    verified? = Keyword.get(opts, :verified?, false)

    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{
          email: email,
          display_name: display_name
        })
        |> User.access_changeset(%{role: role, access_status: access_status})
      )

    Repo.insert!(
      EmailCredential.changeset(%EmailCredential{}, %{
        password_hash: Bcrypt.hash_pwd_salt(password),
        email_verified_at:
          if(verified?, do: DateTime.utc_now() |> DateTime.truncate(:second), else: nil)
      })
      |> Ecto.Changeset.put_change(:user_id, user.id)
    )

    user
  end

  defp create_user_without_password(email, display_name, opts) do
    role = Keyword.get(opts, :role, :user)
    access_status = Keyword.get(opts, :access_status, :pending)

    Repo.insert!(
      User.registration_changeset(%User{}, %{
        email: email,
        display_name: display_name
      })
      |> User.access_changeset(%{role: role, access_status: access_status})
    )
  end

  defp start_bypass_google_tokeninfo(email) do
    bypass = Bypass.open()

    Bypass.expect_once(bypass, "GET", "/tokeninfo", fn conn ->
      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{
          "aud" => "test-google-client-id",
          "sub" => "google-subject-1",
          "email" => email,
          "email_verified" => "true",
          "name" => "Marceline",
          "picture" => "https://example.com/marceline.png"
        })
      )
    end)

    bypass
  end

  defp start_bypass_apple_keys do
    bypass = Bypass.open()
    jwk = JOSE.JWK.generate_key({:rsa, 2048})
    kid = "apple-test-key"

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

    %{bypass: bypass, jwk: jwk, kid: kid}
  end

  defp apple_identity_token(jwk, kid, claim_overrides) do
    now = DateTime.utc_now() |> DateTime.to_unix()

    claims =
      %{
        "iss" => "https://appleid.apple.com",
        "aud" => "love.leaetzak.adventuretime",
        "sub" => "apple-subject",
        "exp" => now + 300,
        "iat" => now
      }
      |> Map.merge(claim_overrides)

    jwk
    |> JOSE.JWT.sign(%{"alg" => "RS256", "kid" => kid}, claims)
    |> JOSE.JWS.compact()
    |> elem(1)
  end

  defp sha256_hex(value) do
    :crypto.hash(:sha256, value) |> Base.encode16(case: :lower)
  end

  defp bypass_url(bypass, path), do: "http://127.0.0.1:#{bypass.port}#{path}"
end
