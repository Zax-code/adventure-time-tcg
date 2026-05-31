defmodule AdventureTimeApiWeb.NotificationControllerTest do
  use AdventureTimeApiWeb.ConnCase, async: true

  alias AdventureTimeApi.Accounts.{EmailCredential, User}
  alias AdventureTimeApi.Notifications.Device
  alias AdventureTimeApi.Repo

  test "POST and DELETE /notifications/device manage the current installation", _context do
    user = create_user_with_password("notify@example.com", "password123")
    access_token = login_access_token(user.email, "password123")

    register_conn =
      access_token
      |> auth_conn()
      |> post(~p"/notifications/device", %{
        "installationId" => "installation-a",
        "platform" => "ios",
        "expoPushToken" => "ExponentPushToken[token-a]"
      })

    assert json_response(register_conn, 200) == %{"success" => true}

    device =
      Repo.get_by!(Device,
        installation_id: "installation-a",
        user_id: user.id
      )

    assert device.platform == :ios
    assert device.expo_push_token == "ExponentPushToken[token-a]"

    delete_conn =
      access_token
      |> auth_conn()
      |> delete(~p"/notifications/device/installation-a")

    assert json_response(delete_conn, 200) == %{"success" => true}
    refute Repo.get(Device, device.id)
  end

  defp create_user_with_password(email, password) do
    user =
      Repo.insert!(
        User.registration_changeset(%User{}, %{email: email, display_name: "Tester"})
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

  defp login_access_token(email, password) do
    build_conn()
    |> post(~p"/auth/login", %{email: email, password: password})
    |> json_response(200)
    |> get_in(["tokens", "accessToken"])
  end

  defp auth_conn(access_token) do
    build_conn()
    |> put_req_header("authorization", "Bearer #{access_token}")
  end
end
