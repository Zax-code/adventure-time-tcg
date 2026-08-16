defmodule AdventureTimeApi.AccessRequestAssessment.NetworkClassification do
  @moduledoc """
  Classifies Firebase Test Lab origin and general Google ownership independently.
  """

  alias AdventureTimeApi.AccessRequestAssessment.NetworkRangeSet
  alias AdventureTimeApi.NetworkAddress

  @cache_key {__MODULE__, :range_sets}

  @spec classify(NetworkAddress.address() | String.t() | nil) :: map()
  def classify(address) do
    with {:ok, normalized} <- NetworkAddress.parse(address) do
      %{test_lab: test_lab, google: google} = range_sets()
      test_lab_match = NetworkRangeSet.match(test_lab, normalized)
      google_match = NetworkRangeSet.match(google, normalized)

      %{
        test_lab: status(test_lab_match),
        google_network: status(google_match),
        test_lab_matched_cidr: matched_cidr(test_lab_match),
        google_network_matched_cidr: matched_cidr(google_match),
        test_lab_range_version: test_lab.version,
        google_network_range_version: google.version,
        test_lab_range_stale: NetworkRangeSet.stale?(test_lab, DateTime.utc_now()),
        google_network_range_stale: NetworkRangeSet.stale?(google, DateTime.utc_now())
      }
    else
      :error -> unknown()
    end
  end

  defp range_sets do
    case :persistent_term.get(@cache_key, nil) do
      nil ->
        loaded = load_range_sets!()
        :persistent_term.put(@cache_key, loaded)
        loaded

      loaded ->
        loaded
    end
  end

  defp load_range_sets! do
    priv_dir = :adventure_time_api |> :code.priv_dir() |> List.to_string()

    %{
      test_lab:
        NetworkRangeSet.load!(Path.join(priv_dir, "network_ranges/firebase_test_lab.json")),
      google: NetworkRangeSet.load!(Path.join(priv_dir, "network_ranges/google_network.json"))
    }
  end

  defp status({:ok, _cidr}), do: :matched
  defp status(:not_matched), do: :not_matched

  defp matched_cidr({:ok, cidr}), do: cidr
  defp matched_cidr(:not_matched), do: nil

  defp unknown do
    %{
      test_lab: :unknown,
      google_network: :unknown,
      test_lab_matched_cidr: nil,
      google_network_matched_cidr: nil,
      test_lab_range_version: nil,
      google_network_range_version: nil,
      test_lab_range_stale: nil,
      google_network_range_stale: nil
    }
  end
end
