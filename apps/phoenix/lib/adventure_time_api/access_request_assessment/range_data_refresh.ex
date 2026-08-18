defmodule AdventureTimeApi.AccessRequestAssessment.RangeDataRefresh do
  @moduledoc """
  Transforms published provider range data into reviewed local documents.
  """

  alias AdventureTimeApi.NetworkAddress

  @goog_url "https://www.gstatic.com/ipranges/goog.json"
  @cloud_url "https://www.gstatic.com/ipranges/cloud.json"
  @test_lab_url "https://firebase.google.com/docs/test-lab/ios/get-started#ip-addresses"

  @spec google_document(binary(), binary(), DateTime.t()) :: map()
  def google_document(goog_body, cloud_body, retrieved_at) do
    goog = Jason.decode!(goog_body)
    cloud = Jason.decode!(cloud_body)
    goog_prefixes = validated_prefixes!(extract_prefixes(goog), "Google network")
    cloud_prefixes = validated_prefixes!(extract_prefixes(cloud), "Google Cloud")

    ensure_cloud_is_google!(goog_prefixes, cloud_prefixes)

    sync_token = Map.fetch!(goog, "syncToken")

    %{
      "version" => "google-ip-ranges-#{sync_token}",
      "retrievedAt" => DateTime.to_iso8601(retrieved_at),
      "sources" => [
        source(@goog_url, goog, goog_body),
        source(@cloud_url, cloud, cloud_body)
      ],
      "prefixes" => Enum.map(goog_prefixes, & &1.source)
    }
  end

  @spec test_lab_document([String.t()], DateTime.t()) :: map()
  def test_lab_document(prefix_lines, retrieved_at) do
    prefixes = validated_prefixes!(prefix_lines, "Firebase Test Lab")
    source_lines = Enum.map(prefixes, & &1.source)
    source_date = DateTime.to_date(retrieved_at)

    %{
      "version" => "firebase-test-lab-#{Date.to_iso8601(source_date)}",
      "sourceUrl" => @test_lab_url,
      "retrievedAt" => DateTime.to_iso8601(retrieved_at),
      "checksum" => checksum(Enum.join(source_lines, "\n") <> "\n"),
      "prefixes" => source_lines
    }
  end

  defp extract_prefixes(%{"prefixes" => prefixes}) do
    Enum.map(prefixes, fn prefix ->
      Map.get(prefix, "ipv4Prefix") || Map.fetch!(prefix, "ipv6Prefix")
    end)
  end

  defp validated_prefixes!(prefixes, label) do
    parsed =
      prefixes
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
      |> Enum.uniq()
      |> Enum.map(&NetworkAddress.parse_cidr!/1)
      |> Enum.sort_by(&{&1.bits, &1.network, &1.prefix})

    parsed
    |> Enum.with_index()
    |> Enum.each(fn {prefix, index} ->
      parsed
      |> Enum.drop(index + 1)
      |> Enum.find(&NetworkAddress.overlaps?(prefix, &1))
      |> case do
        nil ->
          :ok

        overlapping ->
          raise ArgumentError,
                "overlapping networks in #{label}: #{prefix.source} and #{overlapping.source}"
      end
    end)

    parsed
  end

  defp ensure_cloud_is_google!(goog_prefixes, cloud_prefixes) do
    case Enum.find(cloud_prefixes, fn cloud_prefix ->
           not Enum.any?(goog_prefixes, &NetworkAddress.covers?(&1, cloud_prefix))
         end) do
      nil -> :ok
      prefix -> raise ArgumentError, "Google Cloud prefix is outside goog.json: #{prefix.source}"
    end
  end

  defp source(url, document, body) do
    %{
      "url" => url,
      "creationTime" => Map.fetch!(document, "creationTime"),
      "syncToken" => Map.fetch!(document, "syncToken"),
      "checksum" => checksum(body)
    }
  end

  defp checksum(value) do
    :sha256
    |> :crypto.hash(value)
    |> Base.encode16(case: :lower)
  end
end
