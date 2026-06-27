defmodule AdventureTimeApi.Notifications do
  @moduledoc """
  Device registration, widget refresh pushes, and visible game notifications.
  """

  import Ecto.Query
  require Logger

  alias AdventureTimeApi.Accounts.User
  alias AdventureTimeApi.Notifications.Device
  alias AdventureTimeApi.Repo

  @default_push_api_url "https://exp.host/--/api/v2/push/send"
  @widget_refresh_event "fitbit_widget_refresh"
  @widget_refresh_throttle_minutes 20
  @widget_refresh_ttl_seconds 900
  @visible_push_ttl_seconds 86_400
  @general_channel_id "game-updates"

  def register_device(user_id, attrs) when is_binary(user_id) and is_map(attrs) do
    now = now_utc()
    installation_id = Map.get(attrs, "installationId") || Map.get(attrs, :installation_id)
    expo_push_token = Map.get(attrs, "expoPushToken") || Map.get(attrs, :expo_push_token)
    platform = Map.get(attrs, "platform") || Map.get(attrs, :platform)

    if is_binary(installation_id) and is_binary(expo_push_token) do
      Repo.transaction(fn ->
        Repo.delete_all(
          from(device in Device,
            where:
              device.expo_push_token == ^expo_push_token and
                device.installation_id != ^installation_id
          )
        )

        Repo.insert(
          Device.changeset(%Device{}, %{
            user_id: user_id,
            installation_id: installation_id,
            expo_push_token: expo_push_token,
            platform: platform,
            last_registered_at: now
          }),
          on_conflict: [
            set: [
              user_id: user_id,
              platform: platform,
              expo_push_token: expo_push_token,
              last_registered_at: now,
              updated_at: now
            ]
          ],
          conflict_target: :installation_id,
          returning: true
        )
      end)
      |> case do
        {:ok, {:ok, %Device{} = device}} -> {:ok, device}
        {:ok, {:error, %Ecto.Changeset{} = changeset}} -> {:error, changeset}
        {:error, _step, {:error, %Ecto.Changeset{} = changeset}, _changes} -> {:error, changeset}
        {:error, _step, reason, _changes} -> {:error, reason}
      end
    else
      {:error, :invalid_attributes}
    end
  end

  def unregister_device(user_id, installation_id)
      when is_binary(user_id) and is_binary(installation_id) do
    Repo.delete_all(
      from(device in Device,
        where: device.user_id == ^user_id and device.installation_id == ^installation_id
      )
    )

    :ok
  end

  def send_gift_received(user_id, sender_name)
      when is_binary(user_id) and is_binary(sender_name) do
    with {:ok, user} <- fetch_push_user(user_id, :notify_gift_received) do
      send_visible_notification(user, %{
        title: notification_title(user.preferred_language, :gift_received),
        body: notification_body(user.preferred_language, :gift_received, %{name: sender_name}),
        data: %{"eventType" => "gift_received"}
      })
    end
  end

  def send_pvp_invite(user_id, inviter_name)
      when is_binary(user_id) and is_binary(inviter_name) do
    with {:ok, user} <- fetch_push_user(user_id, :notify_pvp_invite) do
      send_visible_notification(user, %{
        title: notification_title(user.preferred_language, :pvp_invite),
        body: notification_body(user.preferred_language, :pvp_invite, %{name: inviter_name}),
        data: %{"eventType" => "pvp_invite"}
      })
    end
  end

  def send_pvp_turn(user_id, opponent_name, match_id \\ nil)
      when is_binary(user_id) and is_binary(opponent_name) and
             (is_binary(match_id) or is_nil(match_id)) do
    with {:ok, user} <- fetch_push_user(user_id, :notify_pvp_turn) do
      send_visible_notification(user, %{
        title: notification_title(user.preferred_language, :pvp_turn),
        body: notification_body(user.preferred_language, :pvp_turn, %{name: opponent_name}),
        data: pvp_turn_notification_data(match_id)
      })
    end
  end

  def send_access_request_created(email) when is_binary(email) do
    User
    |> where([user], user.role == :super_admin and user.access_status == :approved)
    |> order_by([user], asc: user.inserted_at)
    |> Repo.all()
    |> Enum.each(fn user ->
      send_visible_notification(user, %{
        title: notification_title(user.preferred_language, :access_request_created),
        body:
          notification_body(user.preferred_language, :access_request_created, %{email: email}),
        data: %{"eventType" => "access_request_created", "email" => email}
      })
    end)

    :ok
  end

  def send_fitbit_widget_refresh(user_id) when is_binary(user_id) do
    if fitbit_push_enabled_for_user?(user_id) do
      now = now_utc()
      cutoff = DateTime.add(now, -@widget_refresh_throttle_minutes * 60, :second)

      devices =
        Device
        |> where([device], device.user_id == ^user_id)
        |> where(
          [device],
          is_nil(device.last_widget_refresh_push_at) or
            device.last_widget_refresh_push_at <= ^cutoff
        )
        |> order_by([device], asc: device.inserted_at)
        |> Repo.all()

      case devices do
        [] ->
          :ok

        _ ->
          push_silent_widget_refresh(devices, now)
      end
    else
      :ok
    end
  end

  defp fitbit_push_enabled_for_user?(user_id) do
    Repo.exists?(
      from(user in User,
        where:
          user.id == ^user_id and user.preferred_step_source == :fitbit and
            user.access_status == :approved
      )
    )
  end

  defp fetch_push_user(user_id, preference_field) do
    case Repo.get(User, user_id) do
      %User{access_status: :approved} = user ->
        if Map.get(user, preference_field) do
          {:ok, user}
        else
          :ok
        end

      _ ->
        :ok
    end
  end

  defp push_silent_widget_refresh(devices, now) do
    payloads =
      Enum.map(devices, fn device ->
        %{
          "to" => device.expo_push_token,
          "_contentAvailable" => true,
          "priority" => "high",
          "ttl" => @widget_refresh_ttl_seconds,
          "data" => %{
            "eventType" => @widget_refresh_event,
            "reason" => "fitbit_webhook",
            "sentAt" => DateTime.to_iso8601(now)
          }
        }
      end)

    case Req.post(push_api_url(),
           headers: push_headers(),
           json: payloads
         ) do
      {:ok, %Req.Response{status: status, body: %{"data" => results}}}
      when status in 200..299 and is_list(results) ->
        handle_push_results(devices, results, now)
        :ok

      {:ok, %Req.Response{status: status, body: body}} ->
        Logger.warning("Expo widget refresh push failed with status #{status}: #{inspect(body)}")

        :ok

      {:error, reason} ->
        Logger.warning("Expo widget refresh push request failed: #{inspect(reason)}")
        :ok
    end
  end

  defp send_visible_notification(%User{} = user, attrs) do
    devices =
      Device
      |> where([device], device.user_id == ^user.id)
      |> order_by([device], asc: device.inserted_at)
      |> Repo.all()

    case devices do
      [] ->
        :ok

      _ ->
        payloads =
          Enum.map(devices, fn device ->
            %{
              "to" => device.expo_push_token,
              "title" => attrs.title,
              "body" => attrs.body,
              "sound" => "default",
              "priority" => "high",
              "ttl" => @visible_push_ttl_seconds,
              "channelId" => @general_channel_id,
              "data" => Map.get(attrs, :data, %{})
            }
          end)

        case Req.post(push_api_url(), headers: push_headers(), json: payloads) do
          {:ok, %Req.Response{status: status, body: %{"data" => results}}}
          when status in 200..299 and is_list(results) ->
            prune_failed_devices(devices, results)
            :ok

          {:ok, %Req.Response{status: status, body: body}} ->
            Logger.warning("Expo visible push failed with status #{status}: #{inspect(body)}")
            :ok

          {:error, reason} ->
            Logger.warning("Expo visible push request failed: #{inspect(reason)}")
            :ok
        end
    end
  end

  defp handle_push_results(devices, results, now) do
    devices
    |> Enum.zip(results)
    |> Enum.each(fn {device, result} ->
      case result do
        %{"status" => "ok"} ->
          _ =
            Device
            |> where([entry], entry.id == ^device.id)
            |> Repo.update_all(set: [last_widget_refresh_push_at: now, updated_at: now])

        %{"status" => "error", "details" => %{"error" => "DeviceNotRegistered"}} ->
          _ =
            Device
            |> where([entry], entry.id == ^device.id)
            |> Repo.delete_all()

        %{"status" => "error"} = error ->
          Logger.warning(
            "Expo widget refresh push rejected for installation #{device.installation_id}: #{inspect(error)}"
          )

        _ ->
          Logger.warning(
            "Expo widget refresh push returned an unexpected response for installation #{device.installation_id}: #{inspect(result)}"
          )
      end
    end)
  end

  defp prune_failed_devices(devices, results) do
    devices
    |> Enum.zip(results)
    |> Enum.each(fn {device, result} ->
      case result do
        %{"status" => "error", "details" => %{"error" => "DeviceNotRegistered"}} ->
          _ =
            Device
            |> where([entry], entry.id == ^device.id)
            |> Repo.delete_all()

        _ ->
          :ok
      end
    end)
  end

  defp notification_title(:fr, :gift_received), do: "Nouveau cadeau"
  defp notification_title(:fr, :pvp_invite), do: "Invitation au combat"
  defp notification_title(:fr, :pvp_turn), do: "A vous de jouer"
  defp notification_title(:fr, :access_request_created), do: "Nouvelle demande d'accès"
  defp notification_title(_locale, :gift_received), do: "New gift"
  defp notification_title(_locale, :pvp_invite), do: "Combat invitation"
  defp notification_title(_locale, :pvp_turn), do: "Your turn to play"
  defp notification_title(_locale, :access_request_created), do: "New access request"

  defp notification_body(:fr, :gift_received, %{name: name}),
    do: "#{name} vous a envoyé un cadeau."

  defp notification_body(:fr, :pvp_invite, %{name: name}),
    do: "#{name} vous a invité à un combat."

  defp notification_body(:fr, :pvp_turn, %{name: name}),
    do: "À vous de jouer contre #{name}."

  defp notification_body(:fr, :access_request_created, %{email: email}),
    do: "#{email} attend votre approbation."

  defp notification_body(_locale, :gift_received, %{name: name}),
    do: "#{name} sent you a gift."

  defp notification_body(_locale, :pvp_invite, %{name: name}),
    do: "#{name} invited you to a combat match."

  defp notification_body(_locale, :pvp_turn, %{name: name}),
    do: "It's your turn against #{name}."

  defp notification_body(_locale, :access_request_created, %{email: email}),
    do: "#{email} is waiting for approval."

  defp pvp_turn_notification_data(match_id) when is_binary(match_id) do
    %{"eventType" => "pvp_turn", "matchId" => match_id}
  end

  defp pvp_turn_notification_data(_match_id), do: %{"eventType" => "pvp_turn"}

  defp push_headers do
    access_token = config(:access_token)

    base_headers = [{"accept", "application/json"}]

    if is_binary(access_token) and access_token != "" do
      [{"authorization", "Bearer #{access_token}"} | base_headers]
    else
      base_headers
    end
  end

  defp push_api_url do
    config(:push_api_url) || @default_push_api_url
  end

  defp config(key) do
    Application.get_env(:adventure_time_api, __MODULE__, []) |> Keyword.get(key)
  end

  defp now_utc do
    DateTime.utc_now() |> DateTime.truncate(:second)
  end
end
