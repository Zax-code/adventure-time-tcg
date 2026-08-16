defmodule AdventureTimeApiWeb.RequestMetadata do
  @moduledoc false

  import Plug.Conn

  alias AdventureTimeApiWeb.Plugs.CanonicalClientIp

  def from_conn(conn) do
    %{
      request_id: response_header(conn, "x-request-id") || request_header(conn, "x-request-id"),
      user_agent: List.first(get_req_header(conn, "user-agent")),
      ip_address: CanonicalClientIp.to_string(conn),
      accept_language: request_header(conn, "accept-language"),
      client_platform: request_header(conn, "x-adventure-time-platform"),
      client_app_version: request_header(conn, "x-adventure-time-app-version"),
      client_build_number: request_header(conn, "x-adventure-time-build-number"),
      installation_id: request_header(conn, "x-adventure-time-installation-id"),
      installation_id_well_formed:
        well_formed_installation_id?(request_header(conn, "x-adventure-time-installation-id")),
      origin_host_consistent: origin_host_consistent?(conn),
      browser_request_shape: browser_request_shape?(conn),
      attestation_status: request_header(conn, "x-adventure-time-attestation") || "not_provided"
    }
  end

  defp request_header(conn, name), do: conn |> get_req_header(name) |> List.first()
  defp response_header(conn, name), do: conn |> get_resp_header(name) |> List.first()

  defp well_formed_installation_id?(nil), do: false

  defp well_formed_installation_id?(value) do
    match?({:ok, _uuid}, Ecto.UUID.cast(value))
  end

  defp origin_host_consistent?(conn) do
    case request_header(conn, "origin") do
      nil -> nil
      origin -> URI.parse(origin).host == conn.host
    end
  end

  defp browser_request_shape?(conn) do
    user_agent = request_header(conn, "user-agent") || ""
    platform = request_header(conn, "x-adventure-time-platform")

    platform == "web" and String.contains?(user_agent, "Mozilla/") and
      is_nil(request_header(conn, "x-adventure-time-installation-id"))
  end
end
