defmodule AdventureTimeApi.NetworkAddress do
  @moduledoc """
  Parses, normalizes, formats, and matches IPv4 and IPv6 network addresses.
  """

  import Bitwise

  @type address :: :inet.ip_address()
  @type cidr :: %{
          network: non_neg_integer(),
          prefix: non_neg_integer(),
          bits: 32 | 128,
          source: String.t()
        }

  @spec parse(address() | String.t()) :: {:ok, address()} | :error
  def parse({0, 0, 0, 0, 0, 65_535, high, low})
      when high in 0..65_535 and low in 0..65_535 do
    {:ok,
     {
       high >>> 8,
       high &&& 255,
       low >>> 8,
       low &&& 255
     }}
  end

  def parse(address) when is_tuple(address) do
    case :inet.ntoa(address) do
      {:error, _reason} -> :error
      _formatted -> {:ok, address}
    end
  end

  def parse(address) when is_binary(address) do
    address
    |> String.trim()
    |> String.to_charlist()
    |> :inet.parse_address()
    |> case do
      {:ok, parsed} -> parse(parsed)
      {:error, _reason} -> :error
    end
  end

  def parse(_address), do: :error

  @spec parse_cidr!(String.t()) :: cidr()
  def parse_cidr!(source) when is_binary(source) do
    with [address_text, prefix_text] <- String.split(source, "/", parts: 2),
         {:ok, address} <- parse(address_text),
         {prefix, ""} <- Integer.parse(prefix_text),
         {integer, bits} <- to_integer(address),
         true <- prefix in 0..bits do
      shift = bits - prefix

      %{
        network: (integer >>> shift) <<< shift,
        prefix: prefix,
        bits: bits,
        source: source
      }
    else
      _invalid -> raise ArgumentError, "invalid IP network: #{inspect(source)}"
    end
  end

  @spec contains?(cidr(), address()) :: boolean()
  def contains?(%{network: network, prefix: prefix, bits: bits}, address) do
    with {:ok, normalized} <- parse(address),
         {integer, ^bits} <- to_integer(normalized) do
      shift = bits - prefix
      (integer >>> shift) <<< shift == network
    else
      _different_family_or_invalid -> false
    end
  end

  @spec overlaps?(cidr(), cidr()) :: boolean()
  def overlaps?(%{bits: bits} = left, %{bits: bits} = right) do
    prefix = min(left.prefix, right.prefix)
    shift = bits - prefix
    left.network >>> shift == right.network >>> shift
  end

  def overlaps?(_left, _right), do: false

  @spec covers?(cidr(), cidr()) :: boolean()
  def covers?(%{bits: bits} = outer, %{bits: bits} = inner) do
    outer.prefix <= inner.prefix and overlaps?(outer, inner)
  end

  def covers?(_outer, _inner), do: false

  @spec to_string(address()) :: String.t() | nil
  def to_string(address) do
    with {:ok, normalized} <- parse(address),
         formatted when is_list(formatted) <- :inet.ntoa(normalized) do
      List.to_string(formatted)
    else
      _invalid -> nil
    end
  end

  defp to_integer({a, b, c, d}) do
    {(a <<< 24) + (b <<< 16) + (c <<< 8) + d, 32}
  end

  defp to_integer(address) when tuple_size(address) == 8 do
    integer =
      address
      |> Tuple.to_list()
      |> Enum.reduce(0, fn segment, accumulator -> (accumulator <<< 16) + segment end)

    {integer, 128}
  end
end
