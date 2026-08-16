defmodule AdventureTimeApiWeb.Plugs.CanonicalClientIp do
  @moduledoc """
  Establishes the one client address used by request attribution and controls.

  Forwarding headers are considered only when the transport peer belongs to a
  configured trusted-proxy network.
  """

  import Plug.Conn

  alias AdventureTimeApi.NetworkAddress

  @private_key :canonical_client_ip
  @peer_private_key :transport_peer_ip
  @trusted_proxies_cache_key {__MODULE__, :trusted_proxies}
  @default_max_forwarded_bytes 2_048
  @default_max_forwarded_hops 10

  def init(opts), do: opts

  @spec validate_configuration!() :: :ok
  def validate_configuration! do
    parsed =
      :adventure_time_api
      |> Application.get_env(__MODULE__, [])
      |> Keyword.get(:trusted_proxy_cidrs, [])
      |> parse_trusted_proxies()

    :persistent_term.put(@trusted_proxies_cache_key, parsed)
    :ok
  end

  def call(conn, opts) do
    peer = normalize(conn.remote_ip)
    trusted_proxies = trusted_proxies(opts)

    canonical =
      if trusted?(peer, trusted_proxies) do
        resolve_forwarded(conn, trusted_proxies, opts)
      else
        peer
      end

    conn
    |> put_private(@peer_private_key, peer)
    |> put_private(@private_key, canonical)
  end

  @spec fetch(Plug.Conn.t()) :: {:ok, :inet.ip_address()} | :unknown
  def fetch(%Plug.Conn{private: %{@private_key => {:ok, address}}}), do: {:ok, address}
  def fetch(_conn), do: :unknown

  @spec to_string(Plug.Conn.t()) :: String.t() | nil
  def to_string(conn) do
    case fetch(conn) do
      {:ok, address} -> NetworkAddress.to_string(address)
      :unknown -> nil
    end
  end

  defp resolve_forwarded(conn, trusted_proxies, opts) do
    case get_req_header(conn, "x-forwarded-for") do
      [] ->
        invalid(:missing_forwarded_header)

      [header] ->
        parse_forwarded(header, trusted_proxies, opts)

      _multiple_headers ->
        invalid(:multiple_forwarded_headers)
    end
  end

  defp parse_forwarded(header, trusted_proxies, opts) do
    max_bytes = Keyword.get(opts, :max_forwarded_bytes, @default_max_forwarded_bytes)
    max_hops = Keyword.get(opts, :max_forwarded_hops, @default_max_forwarded_hops)
    hops = String.split(header, ",", trim: false)

    cond do
      byte_size(header) > max_bytes ->
        invalid(:forwarded_header_too_large)

      length(hops) > max_hops ->
        invalid(:too_many_forwarded_hops)

      true ->
        with {:ok, addresses} <- parse_hops(hops),
             {:ok, address} <- first_untrusted(addresses, trusted_proxies) do
          {:ok, address}
        else
          :error -> invalid(:malformed_forwarded_header)
          :all_trusted -> invalid(:no_untrusted_forwarded_hop)
        end
    end
  end

  defp parse_hops(hops) do
    hops
    |> Enum.reduce_while({:ok, []}, fn hop, {:ok, addresses} ->
      case NetworkAddress.parse(hop) do
        {:ok, address} -> {:cont, {:ok, [address | addresses]}}
        :error -> {:halt, :error}
      end
    end)
    |> case do
      {:ok, addresses} -> {:ok, Enum.reverse(addresses)}
      :error -> :error
    end
  end

  defp first_untrusted(addresses, trusted_proxies) do
    addresses
    |> Enum.reverse()
    |> Enum.find(&(not trusted?({:ok, &1}, trusted_proxies)))
    |> case do
      nil -> :all_trusted
      address -> {:ok, address}
    end
  end

  defp trusted?({:ok, address}, trusted_proxies) do
    Enum.any?(trusted_proxies, &NetworkAddress.contains?(&1, address))
  end

  defp trusted?(_unknown, _trusted_proxies), do: false

  defp normalize(address) do
    case NetworkAddress.parse(address) do
      {:ok, normalized} -> {:ok, normalized}
      :error -> :unknown
    end
  end

  defp trusted_proxies(opts) do
    case Keyword.fetch(opts, :trusted_proxy_cidrs) do
      {:ok, configured} ->
        parse_trusted_proxies(configured)

      :error ->
        :persistent_term.get(@trusted_proxies_cache_key, [])
    end
  end

  defp parse_trusted_proxies(configured) do
    configured
    |> Enum.map(fn
      %{network: _network, prefix: _prefix, bits: _bits} = cidr -> cidr
      source -> NetworkAddress.parse_cidr!(source)
    end)
  end

  defp invalid(reason) do
    :telemetry.execute(
      [:adventure_time_api, :canonical_client_ip, :invalid],
      %{count: 1},
      %{reason: reason}
    )

    :unknown
  end
end
