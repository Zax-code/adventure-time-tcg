defmodule AdventureTimeApiWeb.SiteLayout do
  @moduledoc """
  Shared HTML shell for the public browser-facing pages.

  Every public page (landing, policy, status, email verification, password
  reset) renders through `document/1` so they share one consistent, themeable
  design system: the sticky top bar, theme switcher, and footer. Page-specific
  markup is passed in as the `:body` string.
  """

  use AdventureTimeApiWeb, :verified_routes

  @doc """
  Wrap page `:body` in the shared document chrome.

  Options:
    * `:title` - page title (required)
    * `:description` - meta description (required)
    * `:body` - inner HTML for `main` (required)
    * `:lang` - `<html lang>` value (default `"en"`)
    * `:active` - current nav key (`:home | :status | :privacy | nil`)
    * `:main_class` - class list for the `<main>` element (default `"shell"`)
  """
  def document(opts) do
    title = Keyword.fetch!(opts, :title)
    description = Keyword.fetch!(opts, :description)
    body = Keyword.fetch!(opts, :body)
    lang = Keyword.get(opts, :lang, "en")
    active = Keyword.get(opts, :active)
    main_class = Keyword.get(opts, :main_class, "shell")

    stylesheet_path = ~p"/assets/landing.css"
    script_path = ~p"/assets/site.js"

    """
    <!DOCTYPE html>
    <html lang="#{escape(lang)}" data-theme="candy">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>#{escape(title)}</title>
        <meta name="description" content="#{escape(description)}" />
        <meta name="theme-color" content="#fff0f5" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="#{stylesheet_path}" />
        <script>
          (function () {
            try {
              var t = localStorage.getItem("attcg-web-theme");
              if (["candy", "ice", "nightosphere"].indexOf(t) === -1) {
                t =
                  window.matchMedia &&
                  window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "nightosphere"
                    : "candy";
              }
              document.documentElement.setAttribute("data-theme", t);
            } catch (e) {}
          })();
        </script>
      </head>
      <body>
        <a class="skip-link" href="#main-content">Skip to content</a>
        #{header(active)}
        <main id="main-content" class="#{escape(main_class)}">
    #{body}
        </main>
        #{footer()}
        <script src="#{script_path}" defer></script>
      </body>
    </html>
    """
  end

  @doc "Sticky top navigation bar with brand, links, and the theme switcher."
  def header(active) do
    """
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="/" aria-label="Adventure Time TCG home">
          <span class="brand-name">
            <b>Adventure Time TCG</b>
            <span>Official mobile backend</span>
          </span>
        </a>

        <nav class="nav" aria-label="Primary">
          <a href="/"#{nav_current(active, :home)}>Home</a>
          <a href="/status"#{nav_current(active, :status)}>Status</a>
          <a href="/privacy" data-optional#{nav_current(active, :privacy)}>Privacy</a>
        </nav>

        <div class="theme-switch" role="group" aria-label="Choose a theme">
          <button type="button" data-theme-name="candy" aria-pressed="true" title="Candy Kingdom theme">
            <span class="visually-hidden">Candy theme</span>
          </button>
          <button type="button" data-theme-name="ice" aria-pressed="false" title="Ice Kingdom theme">
            <span class="visually-hidden">Ice theme</span>
          </button>
          <button type="button" data-theme-name="nightosphere" aria-pressed="false" title="Nightosphere theme">
            <span class="visually-hidden">Nightosphere theme</span>
          </button>
        </div>
      </div>
    </header>
    """
  end

  @doc "Shared footer with policy, status, and security links."
  def footer do
    """
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <b>Adventure Time TCG</b>
          <span>The Phoenix backend and public web surface for the Adventure Time TCG mobile app.</span>
        </div>
        <nav class="footer-links" aria-label="Footer">
          <a href="/">Home</a>
          <a href="/status">Status</a>
          <a href="/privacy">Privacy</a>
          <a href="/account-deletion">Account deletion</a>
          <a href="/.well-known/security.txt">Security</a>
          <a href="mailto:support@leaetzak.love">Support</a>
        </nav>
      </div>
    </footer>
    """
  end

  @doc "HTML-escape a value for safe interpolation into templates."
  def escape(value) do
    value
    |> to_string()
    |> Plug.HTML.html_escape_to_iodata()
    |> IO.iodata_to_binary()
  end

  defp nav_current(active, key) when active == key, do: ~s( aria-current="page")
  defp nav_current(_active, _key), do: ""
end
