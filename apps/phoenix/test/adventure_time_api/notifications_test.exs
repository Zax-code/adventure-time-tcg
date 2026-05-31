defmodule AdventureTimeApi.NotificationsTest do
  use AdventureTimeApi.DataCase, async: true

  alias AdventureTimeApi.Notifications
  alias AdventureTimeApi.Notifications.Device
  alias AdventureTimeApi.Accounts.User

  setup do
    bypass = Bypass.open()
    original_config = Application.get_env(:adventure_time_api, AdventureTimeApi.Notifications, [])

    Application.put_env(
      :adventure_time_api,
      AdventureTimeApi.Notifications,
      Keyword.merge(original_config, push_api_url: endpoint_url(bypass))
    )

    on_exit(fn ->
      Application.put_env(
        :adventure_time_api,
        AdventureTimeApi.Notifications,
        original_config
      )
    end)

    %{bypass: bypass}
  end

  test "send_fitbit_widget_refresh sends a throttled silent push", %{bypass: bypass} do
    user = create_user("fitbit-push@example.com", preferred_step_source: :fitbit)

    device =
      Repo.insert!(
        Device.changeset(%Device{}, %{
          user_id: user.id,
          installation_id: "installation-1",
          platform: :ios,
          expo_push_token: "ExponentPushToken[fitbit-one]",
          last_registered_at: DateTime.utc_now() |> DateTime.truncate(:second)
        })
      )

    Bypass.expect_once(bypass, "POST", "/--/api/v2/push/send", fn conn ->
      {:ok, raw_body, conn} = Plug.Conn.read_body(conn)
      payload = Jason.decode!(raw_body)

      assert [
               %{
                 "_contentAvailable" => true,
                 "priority" => "high",
                 "data" => %{
                   "eventType" => "fitbit_widget_refresh",
                   "reason" => "fitbit_webhook",
                   "sentAt" => sent_at
                 },
                 "to" => "ExponentPushToken[fitbit-one]",
                 "ttl" => 900
               }
             ] = payload

      assert is_binary(sent_at)

      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{"data" => [%{"status" => "ok", "id" => "ticket-1"}]})
      )
    end)

    assert :ok = Notifications.send_fitbit_widget_refresh(user.id)

    refreshed = Repo.get!(Device, device.id)
    assert %DateTime{} = refreshed.last_widget_refresh_push_at

    assert :ok = Notifications.send_fitbit_widget_refresh(user.id)

    throttled = Repo.get!(Device, device.id)
    assert throttled.last_widget_refresh_push_at == refreshed.last_widget_refresh_push_at
  end

  test "send_fitbit_widget_refresh removes devices that Expo reports as unregistered", %{
    bypass: bypass
  } do
    user = create_user("fitbit-prune@example.com", preferred_step_source: :fitbit)

    Repo.insert!(
      Device.changeset(%Device{}, %{
        user_id: user.id,
        installation_id: "installation-2",
        platform: :android,
        expo_push_token: "ExponentPushToken[fitbit-two]",
        last_registered_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
    )

    Bypass.expect_once(bypass, "POST", "/--/api/v2/push/send", fn conn ->
      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{
          "data" => [
            %{
              "status" => "error",
              "message" => "Device not registered",
              "details" => %{"error" => "DeviceNotRegistered"}
            }
          ]
        })
      )
    end)

    assert :ok = Notifications.send_fitbit_widget_refresh(user.id)

    refute Repo.exists?(from(device in Device, where: device.installation_id == "installation-2"))
  end

  defp endpoint_url(bypass) do
    "http://127.0.0.1:#{bypass.port}/--/api/v2/push/send"
  end

  defp create_user(email, opts) do
    preferred_step_source = Keyword.get(opts, :preferred_step_source, :device_health)

    Repo.insert!(
      User.registration_changeset(%User{}, %{email: email, display_name: "Tester"})
      |> User.profile_changeset(%{preferred_step_source: preferred_step_source})
      |> User.access_changeset(%{role: :user, access_status: :approved})
    )
  end
end
