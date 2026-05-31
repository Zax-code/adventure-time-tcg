defmodule AdventureTimeApiWeb.EmailVerificationControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Repo

  test "GET /email/verify renders the confirmation page", %{conn: conn} do
    conn =
      get(conn, ~p"/email/verify", %{
        email: "finn@example.com",
        code: "123456",
        locale: "en"
      })

    html = html_response(conn, 200)

    assert html =~ "Confirm your email"
    assert html =~ "finn@example.com"
    assert html =~ "123456"
    assert html =~ "Confirm in browser"
  end

  test "GET /email/verify without a valid code shows the missing page", %{conn: conn} do
    conn = get(conn, ~p"/email/verify", %{email: "finn@example.com", locale: "en"})

    html = html_response(conn, 200)

    assert html =~ "No verification is waiting"
    assert html =~ "request a fresh code"
  end

  test "POST /email/verify confirms the code and shows waiting approval copy", %{conn: conn} do
    register_response =
      conn
      |> post(~p"/auth/register", %{
        email: "jake@example.com",
        password: "correct-horse",
        displayName: "Jake",
        preferredLanguage: "en"
      })
      |> json_response(201)

    conn =
      post(build_conn(), ~p"/email/verify", %{
        email: "jake@example.com",
        code: register_response["devCode"],
        locale: "en"
      })

    html = html_response(conn, 200)
    user = Repo.get_by!(User, email: "jake@example.com")
    credential = Repo.get_by!(EmailCredential, user_id: user.id)

    assert html =~ "Your email is confirmed"
    assert html =~ "super admin still needs to approve access"
    assert %DateTime{} = credential.email_verified_at
  end

  test "POST /email/verify with a missing code request shows the missing page", %{conn: conn} do
    conn =
      post(conn, ~p"/email/verify", %{
        email: "nobody@example.com",
        code: "123456",
        locale: "en"
      })

    html = html_response(conn, 200)

    assert html =~ "No verification is waiting"
  end
end
