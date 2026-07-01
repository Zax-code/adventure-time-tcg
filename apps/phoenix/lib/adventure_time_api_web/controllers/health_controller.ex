defmodule AdventureTimeApiWeb.HealthController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Health
  alias AdventureTimeApiWeb.SiteLayout

  # ---------------------------------------------------------------------------
  # JSON probes (consumed by uptime monitors, the container orchestrator health
  # check, and the deploy script). Keep the response shapes stable.
  # ---------------------------------------------------------------------------
  def show(conn, _params) do
    json(conn, %{status: "ok", service: "phoenix"})
  end

  def ready(conn, _params) do
    case Health.ready?() do
      :ok ->
        json(conn, %{status: "ready", service: "phoenix"})

      {:error, _reason} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{status: "not_ready", service: "phoenix"})
    end
  end

  # ---------------------------------------------------------------------------
  # Human-facing status page. Renders a server-side snapshot and then refreshes
  # live in the browser against the JSON probes above.
  # ---------------------------------------------------------------------------
  def page(conn, _params) do
    db_ok = Health.ready?() == :ok

    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(200, status_html(db_ok))
  end

  defp status_html(db_ok) do
    banner_state = if db_ok, do: "operational", else: "degraded"
    db_state = if db_ok, do: "operational", else: "down"

    db_hint =
      if db_ok,
        do: "Readiness probe passed (SELECT 1).",
        else: "Readiness probe failed or unreachable."

    banner_title = if db_ok, do: "All systems operational", else: "Partial service disruption"

    banner_text =
      if db_ok,
        do: "The public edge, API, and database are responding normally.",
        else: "The edge and API are up, but the database readiness check is failing."

    version = SiteLayout.escape(app_version())
    elixir_version = SiteLayout.escape(System.version())
    otp_version = SiteLayout.escape(otp_release())
    uptime = SiteLayout.escape(format_uptime())
    checked_at = SiteLayout.escape(now_utc())

    body = """
    <div data-status-page>
      <section class="status-hero">
        <div class="status-banner" data-status-banner data-state="#{banner_state}">
          <span class="status-orb" aria-hidden="true"></span>
          <div class="status-banner-copy">
            <p class="eyebrow">Live status</p>
            <h1 data-banner-title>#{banner_title}</h1>
            <p data-banner-text>#{banner_text}</p>
          </div>
          <div class="status-refresh">
            <span>Auto-refreshes every 15s</span>
            <span>Checked <b data-updated-at>#{checked_at}</b> UTC</span>
          </div>
        </div>
      </section>

      <section class="section" aria-label="Service components">
        <div class="section-head">
          <div>
            <p class="kicker">Components</p>
            <h2>Service components</h2>
          </div>
          <p>Each component reflects a live probe from your browser.</p>
        </div>

        <div class="status-components">
          <div class="status-row" data-component="edge">
            <div class="status-row-main">
              <b>Public edge</b>
              <span>Caddy routing HTTPS traffic to Phoenix</span>
            </div>
            <span class="status-badge" data-badge data-state="operational">
              <span class="dot"></span>
              <span data-badge-label>Operational</span>
            </span>
          </div>

          <div class="status-row" data-component="api">
            <div class="status-row-main">
              <b>API service</b>
              <span>Phoenix responding on <code>/health</code></span>
            </div>
            <span class="status-badge" data-badge data-state="operational">
              <span class="dot"></span>
              <span data-badge-label>Operational</span>
            </span>
          </div>

          <div class="status-row" data-component="database">
            <div class="status-row-main">
              <b>Database</b>
              <span data-hint>#{db_hint}</span>
            </div>
            <span class="status-badge" data-badge data-state="#{db_state}">
              <span class="dot"></span>
              <span data-badge-label>#{if db_ok, do: "Operational", else: "Down"}</span>
            </span>
          </div>
        </div>
      </section>

      <section class="section" aria-label="Runtime details">
        <div class="section-head">
          <div>
            <p class="kicker kicker-secondary">Runtime</p>
            <h2>Build &amp; runtime</h2>
          </div>
        </div>

        <div class="metric-grid">
          <div class="metric">
            <p class="metric-label">Service</p>
            <p class="metric-value">Phoenix</p>
            <p class="metric-hint">adventure_time_api</p>
          </div>
          <div class="metric">
            <p class="metric-label">Version</p>
            <p class="metric-value">#{version}</p>
          </div>
          <div class="metric">
            <p class="metric-label">Uptime</p>
            <p class="metric-value">#{uptime}</p>
            <p class="metric-hint">Since last restart</p>
          </div>
          <div class="metric">
            <p class="metric-label">Ready latency</p>
            <p class="metric-value" data-latency-value>—</p>
            <p class="metric-hint">/ready round-trip</p>
          </div>
          <div class="metric">
            <p class="metric-label">Elixir</p>
            <p class="metric-value">#{elixir_version}</p>
          </div>
          <div class="metric">
            <p class="metric-label">OTP</p>
            <p class="metric-value">#{otp_version}</p>
          </div>
        </div>
      </section>

      <section class="section" aria-label="Machine-readable probes">
        <div class="card">
          <span class="kicker kicker-primary">Endpoints</span>
          <h2>Machine-readable probes</h2>
          <p>
            This page is backed by two JSON endpoints used by uptime monitors and the
            container orchestrator health check. You can open them directly:
          </p>
          <div class="actions">
            <a class="btn btn-ghost" href="/health">GET /health</a>
            <a class="btn btn-ghost" href="/ready">GET /ready</a>
          </div>
        </div>
      </section>
    </div>
    """

    SiteLayout.document(
      title: "Service Status — Adventure Time TCG",
      description:
        "Live status of the Adventure Time TCG backend: public edge, API, and database readiness.",
      active: :status,
      body: body
    )
  end

  defp app_version do
    case Application.spec(:adventure_time_api, :vsn) do
      nil -> "unknown"
      vsn -> to_string(vsn)
    end
  end

  defp otp_release do
    :erlang.system_info(:otp_release) |> to_string()
  end

  defp now_utc do
    DateTime.utc_now()
    |> DateTime.truncate(:second)
    |> Calendar.strftime("%Y-%m-%d %H:%M:%S")
  end

  defp format_uptime do
    {wall_clock_ms, _since_last_call} = :erlang.statistics(:wall_clock)
    total_seconds = div(wall_clock_ms, 1000)

    days = div(total_seconds, 86_400)
    hours = total_seconds |> rem(86_400) |> div(3600)
    minutes = total_seconds |> rem(3600) |> div(60)
    seconds = rem(total_seconds, 60)

    cond do
      days > 0 -> "#{days}d #{hours}h"
      hours > 0 -> "#{hours}h #{minutes}m"
      minutes > 0 -> "#{minutes}m #{seconds}s"
      true -> "#{seconds}s"
    end
  end
end
