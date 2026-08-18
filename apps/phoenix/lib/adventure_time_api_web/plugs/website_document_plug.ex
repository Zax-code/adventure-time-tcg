defmodule AdventureTimeApiWeb.Plugs.WebsiteDocumentPlug do
  @moduledoc """
  Serves the compiled web application document for browser routes.

  The mobile API intentionally owns several of the same GET paths. This plug
  therefore runs before the Phoenix router and only handles an explicit HTML
  document navigation. Known routes receive the application document with a
  200 response; unknown browser routes receive the same document with a 404 so
  React can render the designed not-found page. JSON, wildcard, authenticated
  machine, static, probe, and callback requests continue through the existing
  router unchanged.
  """

  import Plug.Conn

  require Logger

  @behaviour Plug

  @default_index_path "priv/static/assets/web/index.html"

  @exact_routes MapSet.new([
                  "/",
                  "/status",
                  "/privacy",
                  "/account-deletion",
                  "/email/verify",
                  "/password/reset",
                  "/login",
                  "/register",
                  "/404",
                  "/home",
                  "/collection",
                  "/packs",
                  "/gifts",
                  "/quests",
                  "/quests/daily-numbers",
                  "/quests/daily-numbers/play",
                  "/quests/daily-numbers/history",
                  "/quests/speed-calculus",
                  "/quests/speed-calculus/training",
                  "/quests/wordle",
                  "/pvp",
                  "/pvp/loadouts",
                  "/pvp/history",
                  "/pvp/spectate",
                  "/pvp/mechanics",
                  "/pvp/reference",
                  "/settings",
                  "/admin",
                  "/admin/cards",
                  "/admin/packs",
                  "/admin/card-backs",
                  "/admin/image-assets",
                  "/admin/featured",
                  "/admin/abilities",
                  "/admin/users",
                  "/admin/email-requests",
                  "/admin/balance"
                ])

  @reserved_navigation_paths MapSet.new([
                               "/favicon.ico",
                               "/health",
                               "/ready",
                               "/ready/media",
                               "/robots.txt",
                               "/site.webmanifest",
                               "/theme-bootstrap.js"
                             ])

  @reserved_navigation_prefixes [
    "/.well-known/",
    "/assets/",
    "/auth/",
    "/fitbit/",
    "/fonts/",
    "/images/",
    "/media/",
    "/phoenix/",
    "/socket/",
    "/web/"
  ]

  @content_security_policy Enum.join(
                             [
                               "default-src 'self'",
                               "base-uri 'self'",
                               "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://appleid.apple.com",
                               "font-src 'self'",
                               "form-action 'self'",
                               "frame-src https://accounts.google.com https://appleid.apple.com",
                               "frame-ancestors 'none'",
                               "img-src 'self' data: blob:",
                               "manifest-src 'self'",
                               "media-src 'self'",
                               "object-src 'none'",
                               "script-src 'self' https://accounts.google.com https://appleid.cdn-apple.com",
                               "style-src 'self'",
                               "worker-src 'none'"
                             ],
                             "; "
                           )

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(%Plug.Conn{method: method} = conn, _opts) when method in ["GET", "HEAD"] do
    if document_request?(conn) do
      case navigation_status(conn.request_path, conn.path_info) do
        nil -> conn
        status -> serve_document(conn, status)
      end
    else
      conn
    end
  end

  def call(conn, _opts), do: conn

  defp navigation_status(request_path, path_info) do
    cond do
      reserved_navigation?(request_path) -> nil
      MapSet.member?(@exact_routes, request_path) or dynamic_route?(path_info) -> :ok
      true -> :not_found
    end
  end

  defp reserved_navigation?(request_path) do
    MapSet.member?(@reserved_navigation_paths, request_path) or
      Enum.any?(@reserved_navigation_prefixes, &String.starts_with?(request_path, &1))
  end

  defp dynamic_route?(["collection", id]), do: present_segment?(id)
  defp dynamic_route?(["pvp", "match", id]), do: present_segment?(id)
  defp dynamic_route?(["pvp", "history", id]), do: present_segment?(id)
  defp dynamic_route?(["pvp", "spectate", id]), do: present_segment?(id)
  defp dynamic_route?(["admin", "cards", id]), do: present_segment?(id)
  defp dynamic_route?(["admin", "packs", id]), do: present_segment?(id)
  defp dynamic_route?(["admin", "abilities", id]), do: present_segment?(id)
  defp dynamic_route?(["admin", "users", id]), do: present_segment?(id)
  defp dynamic_route?(_path_info), do: false

  defp present_segment?(segment), do: is_binary(segment) and segment != ""

  defp document_request?(conn) do
    accepts_html?(conn) and
      request_header_allowed?(conn, "sec-fetch-dest", "document") and
      request_header_allowed?(conn, "sec-fetch-mode", "navigate") and
      get_req_header(conn, "authorization") == []
  end

  defp accepts_html?(conn) do
    conn
    |> get_req_header("accept")
    |> Enum.flat_map(&String.split(&1, ","))
    |> Enum.any?(fn media_range ->
      media_range
      |> String.split(";", parts: 2)
      |> List.first()
      |> String.trim()
      |> String.downcase()
      |> Kernel.==("text/html")
    end)
  end

  defp request_header_allowed?(conn, header, allowed_value) do
    case get_req_header(conn, header) do
      [] -> true
      [value] -> String.downcase(String.trim(value)) == allowed_value
      _multiple -> false
    end
  end

  defp serve_document(conn, status) do
    case File.read(index_path()) do
      {:ok, document} ->
        body = if conn.method == "HEAD", do: "", else: document

        conn
        |> put_document_headers()
        |> put_resp_header("content-length", Integer.to_string(byte_size(document)))
        |> send_resp(status, body)
        |> halt()

      {:error, reason} ->
        Logger.error("Website document is unavailable: #{inspect(reason)}")

        conn
        |> put_document_headers()
        |> put_resp_content_type("text/plain")
        |> send_resp(:service_unavailable, "Website is temporarily unavailable")
        |> halt()
    end
  end

  defp put_document_headers(conn) do
    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "no-store")
    |> put_resp_header("content-security-policy", @content_security_policy)
    |> put_resp_header("cross-origin-opener-policy", "same-origin-allow-popups")
    |> put_resp_header("cross-origin-resource-policy", "same-origin")
    |> put_resp_header(
      "permissions-policy",
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()"
    )
    |> put_resp_header("pragma", "no-cache")
    |> put_resp_header("referrer-policy", "strict-origin-when-cross-origin")
    |> put_resp_header("vary", "Accept, Sec-Fetch-Dest, Sec-Fetch-Mode")
    |> put_resp_header("x-content-type-options", "nosniff")
    |> put_resp_header("x-frame-options", "DENY")
  end

  defp index_path do
    configured_path =
      :adventure_time_api
      |> Application.get_env(__MODULE__, [])
      |> Keyword.get(:index_path, @default_index_path)

    case Path.type(configured_path) do
      :absolute -> configured_path
      :relative -> Application.app_dir(:adventure_time_api, configured_path)
      :volumerelative -> Application.app_dir(:adventure_time_api, configured_path)
    end
  end
end
