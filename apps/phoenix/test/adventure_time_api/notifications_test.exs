defmodule AdventureTimeApi.NotificationsTest do
  use AdventureTimeApi.DataCase, async: false

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

  test "send_gift_received sends a visible localized push when enabled", %{bypass: bypass} do
    user =
      create_user("gift-fr@example.com",
        preferred_language: :fr,
        notify_gift_received: true
      )

    insert_device(user.id, "gift-installation", :ios, "ExponentPushToken[gift-one]")

    Bypass.expect_once(bypass, "POST", "/--/api/v2/push/send", fn conn ->
      {:ok, raw_body, conn} = Plug.Conn.read_body(conn)
      payload = Jason.decode!(raw_body)

      assert [
               %{
                 "body" => "Marceline vous a envoyé un cadeau.",
                 "channelId" => "game-updates",
                 "data" => %{"eventType" => "gift_received"},
                 "priority" => "high",
                 "sound" => "default",
                 "title" => "Nouveau cadeau",
                 "to" => "ExponentPushToken[gift-one]",
                 "ttl" => 86_400
               }
             ] = payload

      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{"data" => [%{"status" => "ok", "id" => "ticket-visible-1"}]})
      )
    end)

    assert :ok = Notifications.send_gift_received(user.id, "Marceline")
  end

  test "send_pvp_invite sends a visible push when enabled", %{bypass: bypass} do
    user =
      create_user("invite-live@example.com",
        notify_pvp_invite: true
      )

    insert_device(user.id, "invite-live-installation", :android, "ExponentPushToken[invite-live]")

    Bypass.expect_once(bypass, "POST", "/--/api/v2/push/send", fn conn ->
      {:ok, raw_body, conn} = Plug.Conn.read_body(conn)
      payload = Jason.decode!(raw_body)

      assert [
               %{
                 "body" => "Finn invited you to a combat match.",
                 "channelId" => "game-updates",
                 "data" => %{"eventType" => "pvp_invite"},
                 "priority" => "high",
                 "sound" => "default",
                 "title" => "Combat invitation",
                 "to" => "ExponentPushToken[invite-live]",
                 "ttl" => 86_400
               }
             ] = payload

      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{"data" => [%{"status" => "ok", "id" => "ticket-visible-2"}]})
      )
    end)

    assert :ok = Notifications.send_pvp_invite(user.id, "Finn")
  end

  test "send_pvp_invite respects the notification preference", %{bypass: _bypass} do
    user =
      create_user("invite-muted@example.com",
        notify_pvp_invite: false
      )

    insert_device(user.id, "invite-installation", :android, "ExponentPushToken[invite-one]")

    assert :ok = Notifications.send_pvp_invite(user.id, "Finn")

    assert Repo.exists?(
             from(device in Device, where: device.installation_id == "invite-installation")
           )
  end

  test "send_pvp_turn removes devices that Expo reports as unregistered", %{bypass: bypass} do
    user =
      create_user("turn-en@example.com",
        notify_pvp_turn: true
      )

    insert_device(user.id, "turn-installation", :android, "ExponentPushToken[turn-one]")

    Bypass.expect_once(bypass, "POST", "/--/api/v2/push/send", fn conn ->
      {:ok, raw_body, conn} = Plug.Conn.read_body(conn)
      payload = Jason.decode!(raw_body)

      assert [
               %{
                 "body" => "It's your turn against Jake.",
                 "channelId" => "game-updates",
                 "data" => %{"eventType" => "pvp_turn", "matchId" => "match-turn-1"},
                 "priority" => "high",
                 "sound" => "default",
                 "title" => "Your turn to play",
                 "to" => "ExponentPushToken[turn-one]",
                 "ttl" => 86_400
               }
             ] = payload

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

    assert :ok = Notifications.send_pvp_turn(user.id, "Jake", "match-turn-1")

    refute Repo.exists?(
             from(device in Device, where: device.installation_id == "turn-installation")
           )
  end

  test "send_access_request_created only pushes approved super admins", %{bypass: bypass} do
    super_admin =
      create_user("request-boss@example.com",
        role: :super_admin,
        access_status: :approved,
        preferred_language: :fr
      )

    admin =
      create_user("request-admin@example.com",
        role: :admin,
        access_status: :approved
      )

    pending_super_admin =
      create_user("request-pending-boss@example.com",
        role: :super_admin,
        access_status: :pending
      )

    insert_device(
      super_admin.id,
      "request-boss-installation",
      :ios,
      "ExponentPushToken[request-boss]"
    )

    insert_device(admin.id, "request-admin-installation", :ios, "ExponentPushToken[admin]")

    insert_device(
      pending_super_admin.id,
      "request-pending-boss-installation",
      :ios,
      "ExponentPushToken[pending-boss]"
    )

    Bypass.expect_once(bypass, "POST", "/--/api/v2/push/send", fn conn ->
      {:ok, raw_body, conn} = Plug.Conn.read_body(conn)
      payload = Jason.decode!(raw_body)

      assert [
               %{
                 "body" => "new-user@example.com attend votre approbation.",
                 "channelId" => "game-updates",
                 "data" => %{
                   "email" => "new-user@example.com",
                   "eventType" => "access_request_created"
                 },
                 "priority" => "high",
                 "sound" => "default",
                 "title" => "Nouvelle demande d'accès",
                 "to" => "ExponentPushToken[request-boss]",
                 "ttl" => 86_400
               }
             ] = payload

      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(
        200,
        Jason.encode!(%{"data" => [%{"status" => "ok", "id" => "ticket-access-request"}]})
      )
    end)

    assert :ok = Notifications.send_access_request_created("new-user@example.com")
  end

  defp endpoint_url(bypass) do
    "http://127.0.0.1:#{bypass.port}/--/api/v2/push/send"
  end

  defp create_user(email, opts) do
    preferred_step_source = Keyword.get(opts, :preferred_step_source, :device_health)
    role = Keyword.get(opts, :role, :user)
    access_status = Keyword.get(opts, :access_status, :approved)

    Repo.insert!(
      User.registration_changeset(%User{}, %{email: email, display_name: "Tester"})
      |> User.profile_changeset(%{preferred_step_source: preferred_step_source})
      |> User.profile_changeset(%{
        preferred_language: Keyword.get(opts, :preferred_language, :en),
        notify_daily_reset: Keyword.get(opts, :notify_daily_reset, true),
        notify_step_goal: Keyword.get(opts, :notify_step_goal, true),
        notify_pvp_invite: Keyword.get(opts, :notify_pvp_invite, true),
        notify_pvp_turn: Keyword.get(opts, :notify_pvp_turn, true),
        notify_gift_received: Keyword.get(opts, :notify_gift_received, true)
      })
      |> User.access_changeset(%{role: role, access_status: access_status})
    )
  end

  defp insert_device(user_id, installation_id, platform, expo_push_token) do
    Repo.insert!(
      Device.changeset(%Device{}, %{
        user_id: user_id,
        installation_id: installation_id,
        platform: platform,
        expo_push_token: expo_push_token,
        last_registered_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })
    )
  end
end
