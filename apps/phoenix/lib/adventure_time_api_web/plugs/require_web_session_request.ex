defmodule AdventureTimeApiWeb.Plugs.RequireWebSessionRequest do
  @moduledoc false

  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    cond do
      get_req_header(conn, "x-adventure-time-web") != ["1"] ->
        reject(conn, :forbidden, "Web session request required", "WEB_REQUEST_REQUIRED")

      not json_content_type?(conn) ->
        reject(
          conn,
          :unsupported_media_type,
          "Application JSON content type required",
          "JSON_REQUIRED"
        )

      true ->
        conn
    end
  end

  defp json_content_type?(conn) do
    case get_req_header(conn, "content-type") do
      [content_type] ->
        content_type
        |> String.split(";", parts: 2)
        |> List.first()
        |> String.trim()
        |> String.downcase()
        |> Kernel.==("application/json")

      _ ->
        false
    end
  end

  defp reject(conn, status, message, code) do
    body = Jason.encode!(%{error: message, code: code})

    conn
    |> put_resp_content_type("application/json")
    |> put_resp_header("cache-control", "no-store")
    |> put_resp_header("pragma", "no-cache")
    |> send_resp(status, body)
    |> halt()
  end
end
