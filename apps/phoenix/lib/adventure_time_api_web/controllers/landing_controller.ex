defmodule AdventureTimeApiWeb.LandingController do
  use AdventureTimeApiWeb, :controller

  def index(conn, _params) do
    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "public, max-age=300")
    |> send_resp(200, landing_html())
  end

  defp landing_html do
    logo_path = ~p"/images/logo.svg"
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
        <main class="page-shell">
          <section class="hero">
            <div class="hero-copy">
              <p class="eyebrow">Adventure Time TCG</p>
              <h1>Collect weird heroes. Clear quests. Duel in real time.</h1>
              <p class="lede">
                This service powers the official Adventure Time TCG mobile app with secure sign-in,
                card media, quest progress, gifts, and live PvP battles.
              </p>

              <div class="actions">
                <a class="action primary" href="#{health_path}">View live status</a>
                <a class="action secondary" href="#{security_path}">Security contact</a>
              </div>

              <dl class="status-grid" aria-label="Service highlights">
                <div class="status-card">
                  <dt>Service</dt>
                  <dd>Phoenix API</dd>
                </div>
                <div class="status-card">
                  <dt>Realtime</dt>
                  <dd>PvP + sockets</dd>
                </div>
                <div class="status-card">
                  <dt>Platform</dt>
                  <dd>Expo mobile app</dd>
                </div>
              </dl>
            </div>

            <div class="hero-mark" aria-hidden="true">
              <div class="logo-wrap">
                <img src="#{logo_path}" alt="" />
              </div>
              <div class="orb orb-pink"></div>
              <div class="orb orb-yellow"></div>
              <div class="orb orb-lavender"></div>
            </div>
          </section>

          <section class="feature-grid" aria-label="Core app loops">
            <article class="feature-card">
              <span class="feature-kicker">Collect</span>
              <h2>Packs, rarities, and card art</h2>
              <p>
                Open packs, grow your collection, and sync card media fast enough for a playful
                mobile experience.
              </p>
            </article>

            <article class="feature-card">
              <span class="feature-kicker">Quest</span>
              <h2>Daily progress that stays in step</h2>
              <p>
                Wordle runs, speed calculus, daily claims, and step-driven rewards all flow through
                the same backend.
              </p>
            </article>

            <article class="feature-card">
              <span class="feature-kicker">Battle</span>
              <h2>Live PvP, replays, and spectating</h2>
              <p>
                Matchmaking, actions, sockets, and battle history are all hosted here for the
                mobile client.
              </p>
            </article>
          </section>

          <section class="trust-band">
            <p>
              Browsing this page means the public app host is online and presenting a normal landing
              page instead of a blank API root.
            </p>
          </section>
        </main>
      </body>
    </html>
    """
  end
end
