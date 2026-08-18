defmodule AdventureTimeApi.AccessRequestAssessment.NetworkRangeSet do
  @moduledoc """
  Loads and validates a versioned, local set of network prefixes.
  """

  alias AdventureTimeApi.NetworkAddress

  @enforce_keys [:version, :retrieved_at, :prefixes]
  defstruct [:version, :retrieved_at, :source_metadata, prefixes: []]

  @type t :: %__MODULE__{
          version: String.t(),
          retrieved_at: DateTime.t(),
          source_metadata: map(),
          prefixes: [NetworkAddress.cidr()]
        }

  @spec load!(Path.t()) :: t()
  def load!(path) do
    data = path |> File.read!() |> Jason.decode!()
    prefixes = data |> Map.fetch!("prefixes") |> Enum.map(&NetworkAddress.parse_cidr!/1)

    validate_no_overlaps!(prefixes, path)

    %__MODULE__{
      version: Map.fetch!(data, "version"),
      retrieved_at: parse_datetime!(Map.fetch!(data, "retrievedAt"), path),
      source_metadata: Map.drop(data, ["version", "retrievedAt", "prefixes"]),
      prefixes: prefixes
    }
  end

  @spec match(t(), NetworkAddress.address()) :: {:ok, String.t()} | :not_matched
  def match(%__MODULE__{prefixes: prefixes}, address) do
    case Enum.find(prefixes, &NetworkAddress.contains?(&1, address)) do
      nil -> :not_matched
      prefix -> {:ok, prefix.source}
    end
  end

  @spec stale?(t(), DateTime.t(), pos_integer()) :: boolean()
  def stale?(%__MODULE__{retrieved_at: retrieved_at}, now, max_age_days \\ 90) do
    DateTime.diff(now, retrieved_at, :day) > max_age_days
  end

  defp validate_no_overlaps!(prefixes, path) do
    prefixes
    |> Enum.with_index()
    |> Enum.each(fn {prefix, index} ->
      prefixes
      |> Enum.drop(index + 1)
      |> Enum.find(&NetworkAddress.overlaps?(prefix, &1))
      |> case do
        nil ->
          :ok

        overlapping ->
          raise ArgumentError,
                "overlapping networks in #{path}: #{prefix.source} and #{overlapping.source}"
      end
    end)
  end

  defp parse_datetime!(value, path) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> datetime
      {:error, reason} -> raise ArgumentError, "invalid retrievedAt in #{path}: #{reason}"
    end
  end
end
