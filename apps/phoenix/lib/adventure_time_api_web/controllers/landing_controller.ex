defmodule AdventureTimeApiWeb.LandingController do
  use AdventureTimeApiWeb, :controller

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "public, max-age=300")
    |> send_resp(200, landing_html())
  end

  def privacy(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "public, max-age=300")
    |> send_resp(200, privacy_html())
  end

  def account_deletion(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "public, max-age=300")
    |> send_resp(200, account_deletion_html())
  end

  defp landing_html do
    logo_path = ~p"/images/app-icon.png"
    stylesheet_path = ~p"/assets/landing.css"
    health_path = ~p"/ready"
    security_path = ~p"/.well-known/security.txt"

    """
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Adventure Time TCG</title>
        <meta
          name="description"
          content="Adventure Time TCG is the mobile-first card battler where you collect cards, complete quests, and jump into real-time PvP."
        />
        <meta name="theme-color" content="#F472B6" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="#{stylesheet_path}" />
      </head>
      <body>
        <a class="skip-link" href="#main-content">Skip to content</a>
        <main class="page-shell">
          <section class="hero-shell" aria-label="Service overview">
            <div class="hero-copy" id="main-content">
              <p class="eyebrow">Official mobile backend</p>
              <h1>Adventure Time TCG lives here.</h1>
              <p class="lede">
                The public app host powers account access, card art, gifts, quest progress, and
                real-time PvP for the Adventure Time TCG mobile app.
              </p>

              <ul class="signal-list" aria-label="Core capabilities">
                <li>Collectible cards, packs, and synced media</li>
                <li>Daily quests, rewards, and progression systems</li>
                <li>Realtime battles, sockets, spectating, and match history</li>
              </ul>

              <div class="actions">
                <a class="action primary" href="#{health_path}">Open live status</a>
                <a class="action secondary" href="#{security_path}">View security contact</a>
              </div>
            </div>

            <aside class="hero-panel" aria-label="Service status">
              <div class="hero-mark">
                <div class="card-shadow card-shadow-left"></div>
                <div class="card-shadow card-shadow-right"></div>
                <div class="logo-wrap">
                  <img
                    src="#{logo_path}"
                    alt="Adventure Time TCG app icon showing a collectible card with Finn"
                  />
                </div>
              </div>

              <div class="status-stack">
                <div class="status-tile">
                  <p class="status-label">Platform</p>
                  <p class="status-value">Expo mobile app</p>
                </div>
                <div class="status-tile">
                  <p class="status-label">Backend</p>
                  <p class="status-value">Phoenix API</p>
                </div>
                <div class="status-tile">
                  <p class="status-label">Realtime</p>
                  <p class="status-value">Sockets + PvP</p>
                </div>
              </div>
            </aside>
          </section>

          <section class="feature-grid" aria-label="Core app loops">
            <article class="feature-card">
              <span class="feature-kicker">Collect</span>
              <h2>Packs, rarities, and card art</h2>
              <p>
                Pack openings, collection sync, crafted cards, and image delivery all stay fast and
                consistent with the app's candy-coated card feel.
              </p>
            </article>

            <article class="feature-card">
              <span class="feature-kicker">Quest</span>
              <h2>Daily progress that stays in step</h2>
              <p>
                Daily claims, Wordle, speed calculus, and step-linked rewards all run through one
                backend contract for the mobile client.
              </p>
            </article>

            <article class="feature-card">
              <span class="feature-kicker">Battle</span>
              <h2>Live PvP, replays, and spectating</h2>
              <p>
                Matchmaking, battle actions, websocket updates, and replay-friendly match history
                are hosted here for players and spectators.
              </p>
            </article>
          </section>

          <section class="support-grid" aria-label="Support and operational links">
            <article class="support-card">
              <p class="support-kicker">Health</p>
              <h2>Public edge is responding</h2>
              <p>
                If this page loads, the public host is up and routing web traffic normally instead
                of exposing a blank API root.
              </p>
              <a class="text-link" href="#{health_path}">Check the readiness endpoint</a>
            </article>

            <article class="support-card">
              <p class="support-kicker">Security</p>
              <h2>Responsible disclosure</h2>
              <p>
                Security researchers and operators can use the published disclosure contact for
                issues related to the public service.
              </p>
              <a class="text-link" href="#{security_path}">Open security.txt</a>
            </article>

            <article class="support-card">
              <p class="support-kicker">Infrastructure</p>
              <h2>One backend, shared contracts</h2>
              <p>
                Phoenix owns auth, persistence, uploads, and gameplay state while the mobile app
                talks to it through shared API contracts.
              </p>
              <span class="support-note">Built for the live Adventure Time TCG app.</span>
            </article>
          </section>
        </main>
      </body>
    </html>
    """
  end

  defp privacy_html do
    policy_page(
      "Privacy Policy",
      "How Adventure Time TCG handles account, gameplay, and optional step-sync data.",
      """
      <section class="feature-grid policy-grid" aria-label="Privacy details">
        <article class="feature-card policy-card">
          <span class="feature-kicker">Account</span>
          <h2>Account and authentication data</h2>
          <p>
            We store your email address, display name, password authentication state,
            preferred language, timezone, profile image, and session tokens so you can
            sign in and keep your account secure.
          </p>
        </article>

        <article class="feature-card policy-card">
          <span class="feature-kicker">Gameplay</span>
          <h2>Game progress data</h2>
          <p>
            We store coins, dust, cards, packs, gifts, quests, PvP loadouts, matches,
            battle events, and related timestamps so the game can preserve your progress.
          </p>
        </article>

        <article class="feature-card policy-card">
          <span class="feature-kicker">Activity</span>
          <h2>Optional step-sync data</h2>
          <p>
            If you enable step quests, the app reads step counts from Apple Health,
            Health Connect, the device pedometer, or Fitbit. We store daily step totals,
            source, date, and sync timestamps for quest progress. We do not sell this data.
          </p>
        </article>

        <article class="feature-card policy-card">
          <span class="feature-kicker">Notifications</span>
          <h2>Notification data</h2>
          <p>
            If you enable notifications, we store installation identifiers and push tokens
            so the app can send requested quest, gift, and PvP alerts. You can disable
            notification preferences in the app or revoke OS permission at any time.
          </p>
        </article>

        <article class="feature-card policy-card">
          <span class="feature-kicker">Sharing</span>
          <h2>Sharing and third parties</h2>
          <p>
            Data is transmitted over HTTPS to the Adventure Time TCG backend. Third-party
            services are used only as needed for platform login, push delivery, store
            distribution, infrastructure, and optional Fitbit connection.
          </p>
        </article>

        <article class="feature-card policy-card">
          <span class="feature-kicker">Control</span>
          <h2>Access and deletion</h2>
          <p>
            You can delete your account in the mobile settings screen. Deletion removes
            your account, credentials, collection, gifts, quest progress, PvP data, step
            snapshots, notification devices, and profile image from the production backend.
          </p>
          <a class="text-link" href="/account-deletion">Open deletion instructions</a>
        </article>
      </section>
      """
    )
  end

  defp account_deletion_html do
    policy_page(
      "Account Deletion",
      "Delete your Adventure Time TCG account from the app settings screen whenever you need to.",
      """
      <section class="feature-grid policy-grid" aria-label="Account deletion instructions">
        <article class="feature-card policy-card">
          <span class="feature-kicker">In app</span>
          <h2>Delete from settings</h2>
          <p>
            Sign in, open Settings, scroll to Privacy and data, then choose Delete my
            account. Confirm the prompt to permanently remove your account and gameplay data.
          </p>
        </article>

        <article class="feature-card policy-card">
          <span class="feature-kicker">Deleted data</span>
          <h2>What is removed</h2>
          <p>
            Account deletion removes login credentials, sessions, collection data, gifts,
            quest progress, PvP data, step snapshots, notification devices, access requests,
            verification codes, and your profile image.
          </p>
        </article>

        <article class="feature-card policy-card">
          <span class="feature-kicker">Help</span>
          <h2>Need assistance?</h2>
          <p>
            If you cannot access the app, contact support from the account email address
            and request account deletion. We may ask you to verify ownership before acting.
          </p>
          <a class="text-link" href="mailto:support@leaetzak.love">support@leaetzak.love</a>
        </article>
      </section>
      """
    )
  end

  defp policy_page(title, lede, body_html) do
    stylesheet_path = ~p"/assets/landing.css"
    privacy_path = ~p"/privacy"
    deletion_path = ~p"/account-deletion"

    """
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>#{title} - Adventure Time TCG</title>
        <meta name="description" content="#{lede}" />
        <meta name="theme-color" content="#F472B6" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="#{stylesheet_path}" />
      </head>
      <body>
        <a class="skip-link" href="#main-content">Skip to content</a>
        <main class="page-shell policy-page-shell">
          <section class="hero-shell policy-hero" aria-label="#{title}">
            <div class="hero-copy policy-copy" id="main-content">
              <p class="eyebrow">Adventure Time TCG</p>
              <h1>#{title}</h1>
              <p class="lede">#{lede}</p>
              <ul class="signal-list" aria-label="Policy highlights">
                <li>Plain-language controls live in the mobile settings screen</li>
                <li>Gameplay progress stays tied to your signed-in account</li>
                <li>Optional health data is used only for step quest progress</li>
              </ul>
              <div class="actions">
                <a class="action primary" href="/">App overview</a>
                <a class="action secondary" href="#policy-details">Policy details</a>
              </div>
            </div>

            <aside class="hero-panel policy-panel" aria-label="Data controls">
              <div class="status-stack policy-status-stack">
                <div class="status-tile">
                  <p class="status-label">Account control</p>
                  <p class="status-value">Settings screen</p>
                </div>
                <div class="status-tile">
                  <p class="status-label">Privacy policy</p>
                  <p class="status-value">
                    <a class="panel-link" href="#{privacy_path}">Open page</a>
                  </p>
                </div>
                <div class="status-tile">
                  <p class="status-label">Deletion help</p>
                  <p class="status-value">
                    <a class="panel-link" href="#{deletion_path}">Open page</a>
                  </p>
                </div>
              </div>

              <div class="policy-note">
                <p class="support-kicker">Support</p>
                <h2>Need help with your account?</h2>
                <p>
                  Contact support from the email address on your Adventure Time TCG account so
                  ownership can be verified.
                </p>
                <a class="text-link" href="mailto:support@leaetzak.love">support@leaetzak.love</a>
              </div>
            </aside>
          </section>

          <div id="policy-details">
            #{body_html}
          </div>
        </main>
      </body>
    </html>
    """
  end
end
