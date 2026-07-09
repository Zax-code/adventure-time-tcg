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

  test "POST /notifications/device transfers an installation to the current user", _context do
    first_user = create_user_with_password("notify-first@example.com", "password123")
    second_user = create_user_with_password("notify-second@example.com", "password123")
    first_token = login_access_token(first_user.email, "password123")
    second_token = login_access_token(second_user.email, "password123")

    first_token
    |> auth_conn()
    |> post(~p"/notifications/device", %{
      "installationId" => "shared-installation",
      "platform" => "ios",
      "expoPushToken" => "ExponentPushToken[shared-first]"
    })
    |> json_response(200)

    second_token
    |> auth_conn()
    |> post(~p"/notifications/device", %{
      "installationId" => "shared-installation",
      "platform" => "ios",
      "expoPushToken" => "ExponentPushToken[shared-second]"
    })
    |> json_response(200)

    device = Repo.get_by!(Device, installation_id: "shared-installation")
    assert device.user_id == second_user.id
    assert device.expo_push_token == "ExponentPushToken[shared-second]"
    refute Repo.get_by(Device, user_id: first_user.id, installation_id: "shared-installation")
  end

  test "DELETE /notifications/device does not remove another user's installation", _context do
    first_user = create_user_with_password("notify-owned@example.com", "password123")
    second_user = create_user_with_password("notify-other@example.com", "password123")
    second_token = login_access_token(second_user.email, "password123")

    device =
      Repo.insert!(
        Device.changeset(%Device{}, %{
          user_id: first_user.id,
          installation_id: "owned-installation",
          platform: :ios,
          expo_push_token: "ExponentPushToken[owned]",
          last_registered_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
      )

    second_token
    |> auth_conn()
    |> delete(~p"/notifications/device/owned-installation")
    |> json_response(200)

    assert Repo.get(Device, device.id)
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
