defmodule AdventureTimeApiWeb.Telemetry do
  use Supervisor
  import Telemetry.Metrics

  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @impl true
  def init(_arg) do
    children = [
      # Telemetry poller will execute the given period measurements
      # every 10_000ms. Learn more here: https://hexdocs.pm/telemetry_metrics
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000}
      # Add reporters as children of your supervision tree.
      # {Telemetry.Metrics.ConsoleReporter, metrics: metrics()}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  def metrics do
    [
      # Phoenix Metrics
      summary("phoenix.endpoint.start.system_time",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.endpoint.stop.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.start.system_time",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.exception.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.stop.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),
      summary("phoenix.socket_connected.duration",
        unit: {:native, :millisecond}
      ),
      sum("phoenix.socket_drain.count"),
      summary("phoenix.channel_joined.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.channel_handled_in.duration",
        tags: [:event],
        unit: {:native, :millisecond}
      ),

      # Database Metrics
      summary("adventure_time_api.repo.query.total_time",
        unit: {:native, :millisecond},
        description: "The sum of the other measurements"
      ),
      summary("adventure_time_api.repo.query.decode_time",
        unit: {:native, :millisecond},
        description: "The time spent decoding the data received from the database"
      ),
      summary("adventure_time_api.repo.query.query_time",
        unit: {:native, :millisecond},
        description: "The time spent executing the query"
      ),
      summary("adventure_time_api.repo.query.queue_time",
        unit: {:native, :millisecond},
        description: "The time spent waiting for a database connection"
      ),
      summary("adventure_time_api.repo.query.idle_time",
        unit: {:native, :millisecond},
        description:
          "The time the connection spent waiting before being checked out for the query"
      ),

      # Access-request assessment metrics. Every tag is a bounded enum and no
      # metric includes request, identity, or network identifiers.
      counter("adventure_time_api.access_assessment.capture.count", tags: [:result]),
      distribution("adventure_time_api.access_assessment.capture.duration",
        unit: {:native, :millisecond}
      ),
      counter("adventure_time_api.access_assessment.classification.count",
        tags: [:test_lab, :google_network]
      ),
      distribution("adventure_time_api.access_assessment.classification.duration",
        unit: {:native, :millisecond}
      ),
      counter("adventure_time_api.access_assessment.provider.count",
        tags: [:provider, :result]
      ),
      distribution("adventure_time_api.access_assessment.provider.duration",
        tags: [:provider, :result],
        unit: {:native, :millisecond}
      ),
      counter("adventure_time_api.access_assessment.worker.count", tags: [:result]),
      distribution("adventure_time_api.access_assessment.worker.duration",
        tags: [:result],
        unit: {:native, :millisecond}
      ),
      counter("adventure_time_api.access_assessment.outcome.count", tags: [:state]),
      counter("adventure_time_api.access_assessment.challenge.count",
        tags: [:operation, :result]
      ),
      distribution("adventure_time_api.access_assessment.challenge.duration",
        tags: [:operation, :result],
        unit: {:native, :millisecond}
      ),
      counter("adventure_time_api.access_assessment.ip_reveal.count", tags: [:result]),
      distribution("adventure_time_api.access_assessment.ip_reveal.duration",
        tags: [:result],
        unit: {:native, :millisecond}
      ),
      counter("adventure_time_api.access_assessment.range_data.count",
        tags: [:range_set, :status]
      ),
      counter("adventure_time_api.access_assessment.enqueue_error.count", tags: [:error]),
      counter("adventure_time_api.access_assessment.stale_job.count", tags: [:reason]),
      sum("adventure_time_api.access_assessment.retention.exact_ip_deleted"),
      sum("adventure_time_api.access_assessment.retention.details_deleted"),
      sum("adventure_time_api.access_assessment.retention.summaries_deleted"),
      sum("adventure_time_api.access_assessment.retention.reveal_audits_deleted"),
      sum("adventure_time_api.access_assessment.retention.snapshots_deleted"),
      sum("adventure_time_api.access_assessment.retention.challenges_deleted"),
      distribution("adventure_time_api.access_assessment.retention.duration",
        unit: {:native, :millisecond}
      ),
      counter("adventure_time_api.canonical_client_ip.invalid.count", tags: [:reason]),

      # VM Metrics
      summary("vm.memory.total", unit: {:byte, :kilobyte}),
      summary("vm.total_run_queue_lengths.total"),
      summary("vm.total_run_queue_lengths.cpu"),
      summary("vm.total_run_queue_lengths.io")
    ]
  end

  defp periodic_measurements do
    [
      # A module, function and arguments to be invoked periodically.
      # This function must call :telemetry.execute/3 and a metric must be added above.
      # {AdventureTimeApiWeb, :count_users, []}
    ]
  end
end
