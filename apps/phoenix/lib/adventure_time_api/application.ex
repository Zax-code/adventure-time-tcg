defmodule AdventureTimeApi.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    validate_access_assessment_configuration!()

    children = [
      AdventureTimeApiWeb.Telemetry,
      AdventureTimeApi.Repo,
      AdventureTimeApi.Quests.WordleCacheWarmer,
      {Oban, Application.fetch_env!(:adventure_time_api, Oban)},
      {DNSCluster,
       query: Application.get_env(:adventure_time_api, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: AdventureTimeApi.PubSub},
      # Start a worker by calling: AdventureTimeApi.Worker.start_link(arg)
      # {AdventureTimeApi.Worker, arg},
      # Start to serve requests, typically the last entry
      AdventureTimeApiWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: AdventureTimeApi.Supervisor]
    Supervisor.start_link(children, opts)
  end

  defp validate_access_assessment_configuration! do
    if AdventureTimeApi.AccessAssessment.collection_enabled?() do
      config =
        Application.get_env(:adventure_time_api, AdventureTimeApi.AccessAssessment, [])

      configured_model_version = Keyword.fetch!(config, :scoring_model_version)

      if configured_model_version != AdventureTimeApi.AccessAssessment.Score.model_version() do
        raise ArgumentError,
              "access assessment model version mismatch: expected #{AdventureTimeApi.AccessAssessment.Score.model_version()}, got #{configured_model_version}"
      end

      AdventureTimeApi.AccessRequestAssessment.NetworkClassification.validate_range_sets!()

      AdventureTimeApi.AccessRequestAssessment.NetworkClassification.validate_expected_versions!(
        Keyword.fetch!(config, :expected_range_versions)
      )
    end
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    AdventureTimeApiWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
