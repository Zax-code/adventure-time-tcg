defmodule AdventureTimeApi.Notifications do
  @moduledoc """
  Device registration and silent widget refresh pushes.
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
