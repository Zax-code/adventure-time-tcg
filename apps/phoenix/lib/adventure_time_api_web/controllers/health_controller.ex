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
    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(200, status_html())
  end

  defp status_html do
    checked_at = SiteLayout.escape(now_utc())

    body = """
    <div data-status-page>
      <section class="status-hero">
        <div class="status-banner" data-status-banner data-state="checking">
          <span class="status-orb" aria-hidden="true"></span>
          <div class="status-banner-copy">
            <p class="eyebrow">Game status</p>
            <h1 data-banner-title>Checking Adventure Time TCG</h1>
            <p data-banner-text>We are checking sign-in, collections, quests, and battles now.</p>
          </div>
          <div class="status-refresh">
            <span>Updates automatically</span>
            <span>Checked <b data-updated-at>#{checked_at}</b> UTC</span>
          </div>
        </div>
      </section>

      <section class="section" aria-label="Game areas">
        <div class="section-head">
          <div>
            <p class="kicker">Can I play?</p>
            <h2>What this status covers</h2>
          </div>
          <p>A quick check of the parts players rely on most.</p>
        </div>

        <div class="status-components">
          <div class="status-row" data-component="edge">
            <div class="status-row-main">
              <b>Open the app</b>
              <span>The app can reach Adventure Time TCG.</span>
            </div>
            <span class="status-badge" data-badge data-state="checking">
              <span class="dot"></span>
              <span data-badge-label>Checking</span>
            </span>
          </div>

          <div class="status-row" data-component="api">
            <div class="status-row-main">
              <b>Sign in and play</b>
              <span>Accounts, packs, quests, gifts, and battles can respond.</span>
            </div>
            <span class="status-badge" data-badge data-state="checking">
              <span class="dot"></span>
              <span data-badge-label>Checking</span>
            </span>
          </div>

          <div class="status-row" data-component="database">
            <div class="status-row-main">
              <b>Saved progress</b>
              <span data-hint>Checking collections, quests, gifts, and battle history.</span>
            </div>
            <span class="status-badge" data-badge data-state="checking">
              <span class="dot"></span>
              <span data-badge-label>Checking</span>
            </span>
          </div>
        </div>
      </section>

      <section class="section" aria-label="Player help">
        <div class="card">
          <span class="kicker kicker-primary">Still stuck?</span>
          <h2>If the game still feels off</h2>
          <p>
            Try closing and reopening the app, checking your connection, or coming back in a
            few minutes. If the problem keeps happening, contact support and include what you
            were trying to do.
          </p>
          <div class="actions">
            <a class="btn btn-primary" href="mailto:support@leaetzak.love">Contact support</a>
            <a class="btn btn-ghost" href="/">Back to app overview</a>
          </div>
        </div>
      </section>
    </div>
    """

    SiteLayout.document(
      title: "Game Status — Adventure Time TCG",
      description:
        "Check whether Adventure Time TCG is ready for sign-in, quests, packs, and battles.",
      active: :status,
      body: body
    )
  end

  defp now_utc do
    DateTime.utc_now()
    |> DateTime.truncate(:second)
    |> Calendar.strftime("%Y-%m-%d %H:%M:%S")
  end
end
