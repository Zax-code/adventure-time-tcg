defmodule AdventureTimeApiWeb.RequestMetadata do
  @moduledoc false

  import Plug.Conn

  def from_conn(conn) do
    %{
      request_id: response_header(conn, "x-request-id") || request_header(conn, "x-request-id"),
      user_agent: List.first(get_req_header(conn, "user-agent")),
      ip_address: forwarded_ip(conn) || ip_to_string(conn.remote_ip),
      accept_language: request_header(conn, "accept-language"),
      client_platform: request_header(conn, "x-adventure-time-platform"),
      client_app_version: request_header(conn, "x-adventure-time-app-version"),
      client_build_number: request_header(conn, "x-adventure-time-build-number"),
      installation_id: request_header(conn, "x-adventure-time-installation-id"),
      attestation_status: request_header(conn, "x-adventure-time-attestation") || "not_provided"
    }
  end

  defp forwarded_ip(conn) do
    conn
    |> request_header("x-forwarded-for")
    |> case do
      nil -> request_header(conn, "x-real-ip")
      value -> value |> String.split(",") |> List.first() |> String.trim()
    end
  end

  defp request_header(conn, name), do: conn |> get_req_header(name) |> List.first()
  defp response_header(conn, name), do: conn |> get_resp_header(name) |> List.first()

  defp ip_to_string(nil), do: nil
  defp ip_to_string(tuple) when is_tuple(tuple), do: tuple |> Tuple.to_list() |> Enum.join(".")
end
