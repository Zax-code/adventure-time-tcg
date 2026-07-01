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
    body = """
    <div data-status-page>
      <section class="status-hero">
        <div class="status-banner" data-status-banner data-state="checking">
          <span class="status-orb" aria-hidden="true"></span>
          <div class="status-banner-copy">
            <p class="eyebrow" data-i18n="status.eyebrow">Game status</p>
            <h1 data-banner-title data-i18n="status.banner.checking.title">Checking Adventure Time TCG</h1>
            <p data-banner-text data-i18n="status.banner.checking.body">We are checking sign-in, collections, quests, and battles now.</p>
          </div>
          <div class="status-refresh">
            <span data-i18n="status.updates">Updates automatically</span>
            <span><span data-i18n="status.checked">Checked</span> <b data-updated-at>...</b></span>
          </div>
        </div>
      </section>

      <section class="section" aria-label="Game areas" data-i18n-attr="aria-label:status.areasAria">
        <div class="section-head">
          <div>
            <p class="kicker" data-i18n="status.coverage.kicker">Can I play?</p>
            <h2 data-i18n="status.coverage.title">What this status covers</h2>
          </div>
          <p data-i18n="status.coverage.body">A quick check of the parts players rely on most.</p>
        </div>

        <div class="status-components">
          <div class="status-row" data-component="edge">
            <div class="status-row-main">
              <b data-i18n="status.edge.title">Open the app</b>
              <span data-i18n="status.edge.body">The app can reach Adventure Time TCG.</span>
            </div>
            <span class="status-badge" data-badge data-state="checking">
              <span class="dot"></span>
              <span data-badge-label data-i18n="status.state.checking">Checking</span>
            </span>
          </div>

          <div class="status-row" data-component="api">
            <div class="status-row-main">
              <b data-i18n="status.api.title">Sign in and play</b>
              <span data-i18n="status.api.body">Accounts, packs, quests, gifts, and battles can respond.</span>
            </div>
            <span class="status-badge" data-badge data-state="checking">
              <span class="dot"></span>
              <span data-badge-label data-i18n="status.state.checking">Checking</span>
            </span>
          </div>

          <div class="status-row" data-component="database">
            <div class="status-row-main">
              <b data-i18n="status.database.title">Saved progress</b>
              <span data-hint data-i18n="status.database.checking">Checking collections, quests, gifts, and battle history.</span>
            </div>
            <span class="status-badge" data-badge data-state="checking">
              <span class="dot"></span>
              <span data-badge-label data-i18n="status.state.checking">Checking</span>
            </span>
          </div>
        </div>
      </section>

      <section class="section" aria-label="Player help" data-i18n-attr="aria-label:status.helpAria">
        <div class="card">
          <span class="kicker kicker-primary" data-i18n="status.help.kicker">Still stuck?</span>
          <h2 data-i18n="status.help.title">If the game still feels off</h2>
          <p data-i18n="status.help.body">
            Try closing and reopening the app, checking your connection, or coming back in a
            few minutes. If the problem keeps happening, contact support and include what you
            were trying to do.
          </p>
          <div class="actions">
            <a class="btn btn-primary" href="mailto:support@leaetzak.love" data-i18n="status.help.support">Contact support</a>
            <a class="btn btn-ghost" href="/" data-i18n="status.help.back">Back to app overview</a>
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
end
