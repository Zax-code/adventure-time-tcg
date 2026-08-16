defmodule Mix.Tasks.AccessRequestRanges.Refresh do
  @shortdoc "Refreshes reviewed access-request network range data"

  @moduledoc """
  Refreshes the versioned Firebase Test Lab and Google network range files.

      mix access_request_ranges.refresh
      mix access_request_ranges.refresh --google-only
      mix access_request_ranges.refresh --test-lab-input /path/to/cidrs.txt

  By default Test Lab prefixes come from
  `gcloud beta firebase test ip-blocks list --format=value(BLOCK)`. Fixture
  inputs are supported for deterministic review and testing.
  """

  use Mix.Task

  alias AdventureTimeApi.AccessRequestAssessment.RangeDataRefresh

  @goog_url "https://www.gstatic.com/ipranges/goog.json"
  @cloud_url "https://www.gstatic.com/ipranges/cloud.json"

  @switches [
    google_only: :boolean,
    test_lab_only: :boolean,
    goog_input: :string,
    cloud_input: :string,
    test_lab_input: :string,
    output_dir: :string
  ]

  @impl Mix.Task
  def run(args) do
    Mix.Task.run("app.start")
    {opts, remaining, invalid} = OptionParser.parse(args, strict: @switches)

    if remaining != [] or invalid != [] do
      Mix.raise("invalid arguments: #{inspect(remaining ++ invalid)}")
    end

    if opts[:google_only] and opts[:test_lab_only] do
      Mix.raise("--google-only and --test-lab-only cannot be combined")
    end

    output_dir =
      opts[:output_dir] ||
        Path.join(to_string(:code.priv_dir(:adventure_time_api)), "network_ranges")

    retrieved_at = DateTime.utc_now() |> DateTime.truncate(:second)

    unless opts[:test_lab_only] do
      google =
        RangeDataRefresh.google_document(
          read_or_fetch(opts[:goog_input], @goog_url),
          read_or_fetch(opts[:cloud_input], @cloud_url),
          retrieved_at
        )

      write_document(Path.join(output_dir, "google_network.json"), google)
    end

    unless opts[:google_only] do
      test_lab =
        opts[:test_lab_input]
        |> test_lab_output()
        |> String.split("\n", trim: true)
        |> RangeDataRefresh.test_lab_document(retrieved_at)

      write_document(Path.join(output_dir, "firebase_test_lab.json"), test_lab)
    end
  end

  defp read_or_fetch(path, _url) when is_binary(path), do: File.read!(path)

  defp read_or_fetch(nil, url) do
    case Req.get(url) do
      {:ok, %{status: 200, body: body}} when is_binary(body) -> body
      {:ok, response} -> Mix.raise("range download failed with HTTP #{response.status}")
      {:error, reason} -> Mix.raise("range download failed: #{inspect(reason)}")
    end
  end

  defp test_lab_output(path) when is_binary(path), do: File.read!(path)

  defp test_lab_output(nil) do
    case System.find_executable("gcloud") do
      nil ->
        Mix.raise("gcloud is required for Test Lab refresh; install it or pass --test-lab-input")

      executable ->
        case System.cmd(
               executable,
               ["beta", "firebase", "test", "ip-blocks", "list", "--format=value(BLOCK)"],
               stderr_to_stdout: true
             ) do
          {output, 0} -> output
          {output, status} -> Mix.raise("gcloud exited #{status}: #{String.trim(output)}")
        end
    end
  end

  defp write_document(path, document) do
    previous_prefixes = existing_prefixes(path)
    next_prefixes = Map.fetch!(document, "prefixes")
    added = next_prefixes -- previous_prefixes
    removed = previous_prefixes -- next_prefixes

    File.mkdir_p!(Path.dirname(path))
    File.write!(path, [Jason.encode_to_iodata!(document, pretty: true), "\n"])

    Mix.shell().info(
      "updated #{path}: #{length(next_prefixes)} prefixes, +#{length(added)} -#{length(removed)}"
    )
  end

  defp existing_prefixes(path) do
    with {:ok, body} <- File.read(path),
         {:ok, %{"prefixes" => prefixes}} <- Jason.decode(body) do
      prefixes
    else
      _missing_or_invalid -> []
    end
  end
end
