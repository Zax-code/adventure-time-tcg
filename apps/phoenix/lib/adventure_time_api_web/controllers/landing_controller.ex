defmodule AdventureTimeApiWeb.LandingController do
  use AdventureTimeApiWeb, :controller

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "public, max-age=300")
    |> send_resp(200, landing_html())
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
end
