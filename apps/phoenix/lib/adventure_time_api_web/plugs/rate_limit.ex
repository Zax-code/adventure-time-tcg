defmodule AdventureTimeApiWeb.Plugs.RateLimit do
  @moduledoc false

  import Plug.Conn

  alias AdventureTimeApiWeb.Plugs.RateLimit.Store

  def init(opts), do: opts

  def call(conn, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    key_strategy = Keyword.get(opts, :key_strategy, :ip)
    config = bucket_config(bucket, opts)
    key = build_key(conn, key_strategy)

    case Store.check_and_increment(bucket, key, config.limit, config.scale_ms) do
      {:allow, _count} -> conn
      {:deny, _count} -> rate_limited(conn)
    end
  end

  defp bucket_config(bucket, opts) do
    configured =
      :adventure_time_api
      |> Application.get_env(__MODULE__, [])
      |> Keyword.get(:buckets, %{})
      |> Map.get(bucket, %{})

    %{
      limit: Keyword.get(opts, :limit, Map.get(configured, :limit, 10)),
      scale_ms: Keyword.get(opts, :scale_ms, Map.get(configured, :scale_ms, 60_000))
    }
  end

  defp build_key(conn, :ip), do: ip_address(conn)

  defp build_key(conn, :ip_email) do
    email =
      conn
      |> param("email")
      |> to_string()
      |> String.trim()
      |> String.downcase()

    [ip_address(conn), email]
    |> Enum.reject(&(&1 == ""))
    |> Enum.join(":")
  end

  defp build_key(conn, :token_or_ip) do
    token =
      conn
      |> param("refreshToken")
      |> to_string()
      |> String.trim()

    if token == "" do
      ip_address(conn)
    else
      token_key(conn, token)
    end
  end

  defp build_key(conn, {:cookie_token_or_ip, cookie_name}) when is_binary(cookie_name) do
    token = conn |> fetch_cookies() |> Map.fetch!(:req_cookies) |> Map.get(cookie_name, "")

    if token == "" do
      ip_address(conn)
    else
      token_key(conn, token)
    end
  end

  defp build_key(conn, :auth_user_match) do
    user_id = get_in(conn.assigns, [:auth_user, :id]) || "anonymous"
    match_id = param(conn, "id") || "unknown"
    user_id <> ":" <> to_string(match_id)
  end

  defp build_key(conn, _strategy), do: ip_address(conn)

  defp token_key(conn, token) do
    digest = :crypto.hash(:sha256, token)
    ip_address(conn) <> ":" <> Base.encode16(digest, case: :lower)
  end

  defp ip_address(%Plug.Conn{remote_ip: nil}), do: "unknown"

  defp ip_address(%Plug.Conn{remote_ip: remote_ip}) when is_tuple(remote_ip),
    do: remote_ip |> Tuple.to_list() |> Enum.join(".")

  defp param(conn, key) do
    cond do
      is_map(conn.params) and Map.has_key?(conn.params, key) ->
        Map.get(conn.params, key)

      is_map(conn.body_params) and Map.has_key?(conn.body_params, key) ->
        Map.get(conn.body_params, key)

      true ->
        nil
    end
  end

  defp rate_limited(conn) do
    body = Jason.encode!(%{error: "Too many requests", code: "RATE_LIMITED"})

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(429, body)
    |> halt()
  end
end
