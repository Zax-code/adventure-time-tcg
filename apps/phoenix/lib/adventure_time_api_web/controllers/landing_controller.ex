defmodule AdventureTimeApiWeb.LandingController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApiWeb.SiteLayout

  def index(conn, _params) do
    render_html(conn, "public, max-age=300", landing_html())
  end

  def privacy(conn, _params) do
    render_html(conn, "public, max-age=300", privacy_html())
  end

  def account_deletion(conn, _params) do
    render_html(conn, "public, max-age=300", account_deletion_html())
  end

  defp render_html(conn, cache_control, html) do
    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", cache_control)
    |> send_resp(200, html)
  end

  defp landing_html do
    logo_path = ~p"/images/app-icon.png"

    body = """
    <section class="hero" aria-label="Service overview">
      <div class="hero-copy">
        <p class="eyebrow">Official mobile backend</p>
        <h1>The home of <span class="grad">Adventure Time TCG</span>.</h1>
        <p class="lede">
          This host powers account access, card art, gifts, quest progress, and
          real-time PvP for the Adventure Time TCG mobile app.
        </p>

        <ul class="pill-list" aria-label="Core capabilities">
          <li>Collectible cards, packs, and synced media</li>
          <li>Daily quests, rewards, and progression systems</li>
          <li>Realtime battles, sockets, spectating, and match history</li>
        </ul>

        <div class="actions">
          <a class="btn btn-primary" href="/status">View live status</a>
          <a class="btn btn-ghost" href="/privacy">Privacy &amp; data</a>
        </div>
      </div>

      <aside class="hero-panel" aria-label="Service snapshot">
        <div class="hero-mark">
          <div class="card-ghost left"></div>
          <div class="card-ghost right"></div>
          <div class="logo-wrap">
            <img
              src="#{logo_path}"
              alt="Adventure Time TCG app icon showing a collectible card with Finn"
            />
          </div>
        </div>

        <div class="tile-stack">
          <div class="tile">
            <p class="label">Platform</p>
            <p class="value">Expo mobile app</p>
          </div>
          <div class="tile">
            <p class="label">Backend</p>
            <p class="value">Phoenix API</p>
          </div>
          <div class="tile">
            <p class="label">Realtime</p>
            <p class="value">Sockets &amp; live PvP</p>
          </div>
        </div>
      </aside>
    </section>

    <section class="stat-strip" aria-label="At a glance">
      <div class="stat">
        <b>3</b>
        <span>Core game loops</span>
      </div>
      <div class="stat">
        <b>2</b>
        <span>Languages: EN &amp; FR</span>
      </div>
      <div class="stat">
        <b>Live</b>
        <span>Realtime PvP sockets</span>
      </div>
      <div class="stat">
        <b>24/7</b>
        <span>Public status page</span>
      </div>
    </section>

    <section class="section" aria-label="Core app loops">
      <div class="section-head">
        <div>
          <p class="kicker kicker-primary">The loop</p>
          <h2>Collect, quest, and battle</h2>
        </div>
        <p>Three tightly connected systems, all served from one backend contract.</p>
      </div>

      <div class="bento">
        <article class="card feature-card wide">
          <span class="card-glyph" aria-hidden="true">&#127183;</span>
          <span class="kicker kicker-primary">Collect</span>
          <h2>Packs, rarities, and card art</h2>
          <p>
            Pack openings, collection sync, crafted cards, and image delivery stay fast and
            consistent with the app's candy-coated card feel.
          </p>
        </article>

        <article class="card feature-card wide">
          <span class="card-glyph g-secondary" aria-hidden="true">&#9889;</span>
          <span class="kicker kicker-secondary">Quest</span>
          <h2>Daily progress that stays in step</h2>
          <p>
            Daily claims, Wordle, speed calculus, and step-linked rewards all run through one
            backend contract for the mobile client.
          </p>
        </article>

        <article class="card feature-card full">
          <span class="card-glyph g-accent" aria-hidden="true">&#9876;</span>
          <span class="kicker">Battle</span>
          <h2>Live PvP, replays, and spectating</h2>
          <p>
            Matchmaking, battle actions, websocket updates, and replay-friendly match history
            are hosted here for players and spectators &mdash; every action journaled and
            reconstructable.
          </p>
        </article>
      </div>
    </section>

    <section class="section" aria-label="Support and operational links">
      <div class="section-head">
        <div>
          <p class="kicker">Operations</p>
          <h2>Health, security, and one shared backend</h2>
        </div>
      </div>

      <div class="card-grid">
        <article class="card">
          <span class="card-glyph g-success" aria-hidden="true">&#128994;</span>
          <span class="kicker kicker-primary">Health</span>
          <h2>Live service status</h2>
          <p>
            A public status page presents the readiness of the edge, API, and database in
            real time instead of exposing a raw JSON probe.
          </p>
          <a class="text-link" href="/status">Open the status page</a>
        </article>

        <article class="card">
          <span class="card-glyph g-accent" aria-hidden="true">&#128274;</span>
          <span class="kicker">Security</span>
          <h2>Responsible disclosure</h2>
          <p>
            Security researchers and operators can use the published disclosure contact for
            issues related to the public service.
          </p>
          <a class="text-link" href="/.well-known/security.txt">Open security.txt</a>
        </article>

        <article class="card">
          <span class="card-glyph g-secondary" aria-hidden="true">&#127959;</span>
          <span class="kicker kicker-secondary">Infrastructure</span>
          <h2>One backend, shared contracts</h2>
          <p>
            Phoenix owns auth, persistence, uploads, and gameplay state while the mobile app
            talks to it through shared API contracts.
          </p>
          <a class="text-link" href="/privacy">See how data is handled</a>
        </article>
      </div>
    </section>
    """

    SiteLayout.document(
      title: "Adventure Time TCG",
      description:
        "Adventure Time TCG is the mobile-first card battler where you collect cards, complete quests, and jump into real-time PvP.",
      active: :home,
      body: body
    )
  end

  defp privacy_html do
    body =
      policy_body(
        "Privacy Policy",
        "How Adventure Time TCG handles account, gameplay, and optional step-sync data.",
        :privacy,
        privacy_cards()
      )

    SiteLayout.document(
      title: "Privacy Policy — Adventure Time TCG",
      description:
        "How Adventure Time TCG handles account, gameplay, and optional step-sync data.",
      active: :privacy,
      body: body
    )
  end

  defp account_deletion_html do
    body =
      policy_body(
        "Account Deletion",
        "Delete your Adventure Time TCG account from the app settings screen whenever you need to.",
        :account_deletion,
        account_deletion_cards()
      )

    SiteLayout.document(
      title: "Account Deletion — Adventure Time TCG",
      description:
        "Delete your Adventure Time TCG account from the app settings screen whenever you need to.",
      active: nil,
      body: body
    )
  end

  defp policy_body(title, lede, page, cards_html) do
    escaped_title = SiteLayout.escape(title)
    escaped_lede = SiteLayout.escape(lede)

    """
    <section class="hero" aria-label="#{escaped_title}">
      <div class="hero-copy">
        <p class="eyebrow">Adventure Time TCG</p>
        <h1>#{escaped_title}</h1>
        <p class="lede">#{escaped_lede}</p>

        <ul class="pill-list" aria-label="Policy highlights">
          <li>Plain-language controls live in the mobile settings screen</li>
          <li>Gameplay progress stays tied to your signed-in account</li>
          <li>Optional health data is used only for step quest progress</li>
        </ul>

        <div class="actions">
          <a class="btn btn-primary" href="#policy-details">Read the details</a>
          <a class="btn btn-ghost" href="/">App overview</a>
        </div>
      </div>

      <aside class="hero-panel" aria-label="Data controls">
        <div class="tile-stack">
          <div class="tile">
            <p class="label">Account control</p>
            <p class="value">Settings screen</p>
          </div>
          <div class="tile">
            <p class="label">Privacy policy</p>
            <p class="value"><a href="/privacy">Open page</a></p>
          </div>
          <div class="tile">
            <p class="label">Deletion help</p>
            <p class="value"><a href="/account-deletion">Open page</a></p>
          </div>
          <div class="tile">
            <p class="label">Support</p>
            <p class="value"><a href="mailto:support@leaetzak.love">support@leaetzak.love</a></p>
          </div>
        </div>
      </aside>
    </section>

    <section class="section" id="policy-details" aria-label="#{escaped_title} details">
      <div class="section-head">
        <div>
          <p class="kicker">#{policy_kicker(page)}</p>
          <h2>#{policy_heading(page)}</h2>
        </div>
      </div>
      <div class="card-grid">
    #{cards_html}
      </div>
    </section>
    """
  end

  defp policy_kicker(:privacy), do: "Privacy"
  defp policy_kicker(:account_deletion), do: "Account deletion"

  defp policy_heading(:privacy), do: "What we store and why"
  defp policy_heading(:account_deletion), do: "How to delete your account"

  defp privacy_cards do
    """
        <article class="card feature-card">
          <span class="kicker kicker-primary">Account</span>
          <h3>Account and authentication data</h3>
          <p>
            We store your email address, display name, password authentication state,
            preferred language, timezone, profile image, and session tokens so you can
            sign in and keep your account secure.
          </p>
        </article>

        <article class="card feature-card">
          <span class="kicker kicker-secondary">Gameplay</span>
          <h3>Game progress data</h3>
          <p>
            We store coins, dust, cards, packs, gifts, quests, PvP loadouts, matches,
            battle events, and related timestamps so the game can preserve your progress.
          </p>
        </article>

        <article class="card feature-card">
          <span class="kicker">Activity</span>
          <h3>Optional step-sync data</h3>
          <p>
            If you enable step quests, the app reads step counts from Apple Health,
            Health Connect, the device pedometer, or Fitbit. We store daily step totals,
            source, date, and sync timestamps for quest progress. We do not sell this data.
          </p>
        </article>

        <article class="card feature-card">
          <span class="kicker kicker-primary">Notifications</span>
          <h3>Notification data</h3>
          <p>
            If you enable notifications, we store installation identifiers and push tokens
            so the app can send requested quest, gift, and PvP alerts. You can disable
            notification preferences in the app or revoke OS permission at any time.
          </p>
        </article>

        <article class="card feature-card">
          <span class="kicker kicker-secondary">Sharing</span>
          <h3>Sharing and third parties</h3>
          <p>
            Data is transmitted over HTTPS to the Adventure Time TCG backend. Third-party
            services are used only as needed for platform login, push delivery, store
            distribution, infrastructure, and optional Fitbit connection.
          </p>
        </article>

        <article class="card feature-card">
          <span class="kicker">Control</span>
          <h3>Access and deletion</h3>
          <p>
            You can delete your account in the mobile settings screen. Deletion removes
            your account, credentials, collection, gifts, quest progress, PvP data, step
            snapshots, notification devices, and profile image from the production backend.
          </p>
          <a class="text-link" href="/account-deletion">Open deletion instructions</a>
        </article>
    """
  end

  defp account_deletion_cards do
    """
        <article class="card feature-card">
          <span class="kicker kicker-primary">In app</span>
          <h3>Delete from settings</h3>
          <p>
            Sign in, open Settings, scroll to Privacy and data, then choose Delete my
            account. Confirm the prompt to permanently remove your account and gameplay data.
          </p>
        </article>

        <article class="card feature-card">
          <span class="kicker kicker-secondary">Deleted data</span>
          <h3>What is removed</h3>
          <p>
            Account deletion removes login credentials, sessions, collection data, gifts,
            quest progress, PvP data, step snapshots, notification devices, access requests,
            verification codes, and your profile image.
          </p>
        </article>

        <article class="card feature-card">
          <span class="kicker">Help</span>
          <h3>Need assistance?</h3>
          <p>
            If you cannot access the app, contact support from the account email address
            and request account deletion. We may ask you to verify ownership before acting.
          </p>
          <a class="text-link" href="mailto:support@leaetzak.love">support@leaetzak.love</a>
        </article>
    """
  end
end
