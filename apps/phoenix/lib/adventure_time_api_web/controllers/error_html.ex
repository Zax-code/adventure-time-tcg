defmodule AdventureTimeApiWeb.ErrorHTML do
  @moduledoc false

  import Phoenix.HTML, only: [raw: 1]

  def render(template, _assigns) do
    status = template |> String.replace_suffix(".html", "")

    {badge, title, body, primary_label, primary_href, secondary_label, secondary_href} =
      copy_for(status)

    raw("""
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>#{escape(title)} | Adventure Time TCG</title>
        <meta name="theme-color" content="#F472B6" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/assets/landing.css" />
      </head>
      <body>
        <main class="verify-page-shell">
          <section class="verify-card hero-shell" aria-label="#{escape(title)}">
            <div class="hero-copy">
              <p class="eyebrow">#{escape(badge)}</p>
              <h1 class="verify-title">#{escape(title)}</h1>
              <p class="lede verify-lede">#{escape(body)}</p>

              <div class="verify-actions">
                <a class="action primary" href="#{escape(primary_href)}">#{escape(primary_label)}</a>
                <a class="action secondary" href="#{escape(secondary_href)}">#{escape(secondary_label)}</a>
              </div>
            </div>

            <aside class="hero-panel verify-panel" aria-label="Adventure Time TCG">
              <div class="hero-mark verify-mark">
                <div class="card-shadow card-shadow-left"></div>
                <div class="card-shadow card-shadow-right"></div>
                <div class="logo-wrap">
                  <img src="/images/app-icon.png" alt="Adventure Time TCG app icon" />
                </div>
              </div>

              <div class="status-stack">
                <div class="status-tile">
                  <p class="status-label">Where now</p>
                  <p class="status-value">Head back into the Candy Kingdom</p>
                </div>
                <div class="status-tile">
                  <p class="status-label">Quick fix</p>
                  <p class="status-value">Open the app or restart from the email link</p>
                </div>
                <div class="status-tile">
                  <p class="status-label">Status</p>
                  <p class="status-value">#{escape(status)}</p>
                </div>
              </div>
            </aside>
          </section>
        </main>
      </body>
    </html>
    """)
  end

  defp copy_for("404") do
    {
      "Not found",
      "This page wandered off",
      "The path you tried does not exist anymore, or it was never part of this adventure. Start again from the homepage or jump back into the app.",
      "Go to homepage",
      "/",
      "Open the app",
      "adventure-time://login?mode=login"
    }
  end

  defp copy_for(_status) do
    {
      "Something went wrong",
      "This page hit a snag",
      "Adventure Time TCG could not finish this page right now. Try again in a moment, or go back to the app and continue there.",
      "Go to homepage",
      "/",
      "Open the app",
      "adventure-time://login?mode=login"
    }
  end

  defp escape(value) do
    value
    |> to_string()
    |> Plug.HTML.html_escape_to_iodata()
    |> IO.iodata_to_binary()
  end
end
