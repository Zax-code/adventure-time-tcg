defmodule AdventureTimeApiWeb.AuthControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  import Ecto.Query

  alias AdventureTimeApi.Accounts.{
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
      post(conn, ~p"/auth/register", %{
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
  end

  test "POST /auth/register updates preferred language for an existing pending account", %{
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

    assert json_response(conn, 201)["success"] == true

    user = Repo.get_by!(User, email: "bmo@example.com")
    request = Repo.get_by!(EmailAccessRequest, email: user.email)

    assert user.preferred_language == :fr
    assert request.requested_locale == :fr
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

    assert json_response(conn, 201)["accessRequestPending"] == true

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
      post(conn, ~p"/auth/login", %{
        email: "pb@example.com",
        password: "science-rules"
      })

    assert json_response(conn, 403) == %{
             "error" => "Email verification required.",
             "code" => "EMAIL_VERIFICATION_REQUIRED"
           }
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

  test "POST /auth/google creates pending request when email is unknown", %{conn: conn} do
    bypass = start_bypass_google_tokeninfo("marceline@example.com")

    Application.put_env(:adventure_time_api, GoogleAuth,
      id_token_info_url: bypass_url(bypass, "/tokeninfo"),
      access_token_info_url: bypass_url(bypass, "/access-token-info"),
      userinfo_url: bypass_url(bypass, "/userinfo")
    )

    on_exit(fn -> Application.delete_env(:adventure_time_api, GoogleAuth) end)

    conn =
      post(conn, ~p"/auth/google", %{"idToken" => "valid-token", "preferredLanguage" => "fr"})

    assert json_response(conn, 403) == %{
             "error" =>
               "This Google account is not approved yet. An access request has been submitted.",
             "code" => "ACCESS_REQUEST_PENDING"
           }

    request = Repo.get_by!(EmailAccessRequest, email: "marceline@example.com")
    assert request.status == :pending
    assert request.requested_locale == :fr
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

  defp start_bypass_google_tokeninfo(email) do
    bypass = Bypass.open()

    Bypass.expect_once(bypass, "GET", "/tokeninfo", fn conn ->
      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{
          "aud" => "test-google-client-id",
          "email" => email,
          "email_verified" => "true",
          "name" => "Marceline"
        })
      )
    end)

    bypass
  end

  defp bypass_url(bypass, path), do: "http://127.0.0.1:#{bypass.port}#{path}"
end
