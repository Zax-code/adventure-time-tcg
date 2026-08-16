defmodule AdventureTimeApiWeb.Plugs.CanonicalClientIpTest do
  use ExUnit.Case, async: true

  import Plug.Conn
  import Plug.Test

  alias AdventureTimeApiWeb.Plugs.CanonicalClientIp

  @trusted_proxies ["127.0.0.0/8", "10.0.0.0/8", "::1/128"]

  test "an untrusted peer cannot spoof its address with forwarding headers" do
    conn =
      :get
      |> conn("/")
      |> Map.put(:remote_ip, {198, 51, 100, 20})
      |> put_req_header("x-forwarded-for", "203.0.113.99")
      |> resolve()

    assert CanonicalClientIp.fetch(conn) == {:ok, {198, 51, 100, 20}}
    assert CanonicalClientIp.to_string(conn) == "198.51.100.20"
  end

  test "a trusted peer resolves the first untrusted hop from the right" do
    conn =
      :get
      |> conn("/")
      |> Map.put(:remote_ip, {127, 0, 0, 1})
      |> put_req_header("x-forwarded-for", "203.0.113.99, 198.51.100.44, 10.0.0.8")
      |> resolve()

    assert CanonicalClientIp.fetch(conn) == {:ok, {198, 51, 100, 44}}
  end

  test "a trusted peer supports IPv6 forwarding chains" do
    conn =
      :get
      |> conn("/")
      |> Map.put(:remote_ip, {0, 0, 0, 0, 0, 0, 0, 1})
      |> put_req_header("x-forwarded-for", "2001:db8::7")
      |> resolve()

    assert CanonicalClientIp.to_string(conn) == "2001:db8::7"
  end

  test "IPv4-mapped IPv6 addresses are normalized to IPv4" do
    conn =
      :get
      |> conn("/")
      |> Map.put(:remote_ip, {0, 0, 0, 0, 0, 65_535, 50_739, 11_264})
      |> resolve()

    assert CanonicalClientIp.fetch(conn) == {:ok, {198, 51, 44, 0}}
    assert CanonicalClientIp.to_string(conn) == "198.51.44.0"
  end

  test "malformed forwarded input from a trusted peer becomes unknown" do
    conn =
      :get
      |> conn("/")
      |> Map.put(:remote_ip, {127, 0, 0, 1})
      |> put_req_header("x-forwarded-for", "198.51.100.44, definitely-not-an-ip")
      |> resolve()

    assert CanonicalClientIp.fetch(conn) == :unknown
    assert CanonicalClientIp.to_string(conn) == nil
  end

  test "multiple forwarded header lines from a trusted peer become unknown" do
    conn =
      :get
      |> conn("/")
      |> Map.put(:remote_ip, {127, 0, 0, 1})
      |> prepend_req_headers([
        {"x-forwarded-for", "198.51.100.44"},
        {"x-forwarded-for", "203.0.113.7"}
      ])
      |> resolve()

    assert CanonicalClientIp.fetch(conn) == :unknown
  end

  test "oversized forwarded chains from a trusted peer become unknown" do
    conn =
      :get
      |> conn("/")
      |> Map.put(:remote_ip, {127, 0, 0, 1})
      |> put_req_header("x-forwarded-for", "198.51.100.1, 198.51.100.2, 198.51.100.3")
      |> CanonicalClientIp.call(
        CanonicalClientIp.init(trusted_proxy_cidrs: @trusted_proxies, max_forwarded_hops: 2)
      )

    assert CanonicalClientIp.fetch(conn) == :unknown
  end

  test "a trusted peer with no forwarding header falls back to its peer address" do
    conn =
      :get
      |> conn("/")
      |> Map.put(:remote_ip, {127, 0, 0, 1})
      |> resolve()

    assert CanonicalClientIp.fetch(conn) == {:ok, {127, 0, 0, 1}}
  end

  defp resolve(conn) do
    CanonicalClientIp.call(
      conn,
      CanonicalClientIp.init(trusted_proxy_cidrs: @trusted_proxies)
    )
  end
end
