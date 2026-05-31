defmodule AdventureTimeApiWeb.PasswordResetControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: false

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Repo

  test "GET /password/reset renders the reset form", %{conn: conn} do
    conn =
      get(conn, ~p"/password/reset?email=finn@example.com&code=482913&locale=en")

    body = html_response(conn, 200)

    assert body =~ "Choose a new password"
    assert body =~ "name=\"password\""
    assert body =~ "Update password"
  end

  test "POST /password/reset updates the password and shows the success page", %{conn: conn} do
    user =
      create_user_with_password("browser-reset@example.com", "old-password", "Browser Reset")

    request_response =
      build_conn()
      |> post(~p"/auth/request-password-reset", %{email: user.email})
      |> json_response(200)

    conn =
      post(conn, ~p"/password/reset", %{
        email: user.email,
        code: request_response["devCode"],
        password: "new-password",
        locale: "en"
      })

    body = html_response(conn, 200)

    assert body =~ "Your password is ready"
    assert body =~ "Open the app to sign in"

    credential = Repo.get_by!(EmailCredential, user_id: user.id)
    assert Bcrypt.verify_pass("new-password", credential.password_hash)
  end

  defp create_user_with_password(email, password, display_name) do
    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{
          email: email,
          display_name: display_name
        })
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
