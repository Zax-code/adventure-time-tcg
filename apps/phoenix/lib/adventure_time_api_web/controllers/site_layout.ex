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
    page_key = Keyword.get(opts, :page_key)

    asset_version = "public-site-20260701-5"
    stylesheet_path = ~p"/assets/landing.css" <> "?v=#{asset_version}"
    script_path = ~p"/assets/site.js" <> "?v=#{asset_version}"

    """
    <!DOCTYPE html>
    <html lang="#{escape(lang)}" data-theme="candy"#{page_key_attr(page_key)}>
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
              var l = localStorage.getItem("attcg-web-language");
              if (["en", "fr"].indexOf(l) === -1) {
                l = document.documentElement.getAttribute("lang") === "fr" ? "fr" : null;
                if (!l) {
                  var ls = navigator.languages && navigator.languages.length
                    ? navigator.languages
                    : [navigator.language || navigator.userLanguage || "en"];
                  l = "en";
                  for (var i = 0; i < ls.length; i++) {
                    var candidate = String(ls[i]).toLowerCase();
                    if (candidate.indexOf("fr") === 0) {
                      l = "fr";
                      break;
                    }
                    if (candidate.indexOf("en") === 0) {
                      l = "en";
                      break;
                    }
                  }
                }
              }
              document.documentElement.setAttribute("lang", l);
              document.documentElement.setAttribute("data-language", l);
            } catch (e) {}
          })();
        </script>
      </head>
      <body>
        <a class="skip-link" href="#main-content" data-i18n="common.skip">Skip to content</a>
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
        <a class="brand" href="/" aria-label="Adventure Time TCG home" data-i18n-attr="aria-label:common.brandAria">
          <span class="brand-name">
            <b>Adventure Time TCG</b>
            <span data-i18n="common.tagline">Collect cards. Complete quests. Battle friends.</span>
          </span>
        </a>

        <nav class="nav" aria-label="Primary" data-i18n-attr="aria-label:common.primaryNav">
          <a href="/" data-i18n="nav.home"#{nav_current(active, :home)}>Home</a>
          <a href="/status" data-i18n="nav.status"#{nav_current(active, :status)}>Status</a>
          <a href="/privacy" data-optional data-i18n="nav.privacy"#{nav_current(active, :privacy)}>Privacy</a>
        </nav>

        <div class="topbar-controls">
          <div class="language-switch" role="group" aria-label="Choose a language" data-i18n-attr="aria-label:common.languageSwitch">
            <button type="button" data-language-name="en" aria-pressed="true" data-i18n="language.en" title="English" data-i18n-attr="title:language.enFull">EN</button>
            <button type="button" data-language-name="fr" aria-pressed="false" data-i18n="language.fr" title="French" data-i18n-attr="title:language.frFull">FR</button>
          </div>

          <div class="theme-switch" role="group" aria-label="Choose a theme" data-i18n-attr="aria-label:common.themeSwitch">
            <button type="button" data-theme-name="candy" aria-pressed="true" title="Candy Kingdom theme" data-i18n-attr="title:theme.candy">
              <span class="visually-hidden" data-i18n="theme.candy">Candy theme</span>
            </button>
            <button type="button" data-theme-name="ice" aria-pressed="false" title="Ice Kingdom theme" data-i18n-attr="title:theme.ice">
              <span class="visually-hidden" data-i18n="theme.ice">Ice theme</span>
            </button>
            <button type="button" data-theme-name="nightosphere" aria-pressed="false" title="Nightosphere theme" data-i18n-attr="title:theme.nightosphere">
              <span class="visually-hidden" data-i18n="theme.nightosphere">Nightosphere theme</span>
            </button>
          </div>
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
        </div>
        <nav class="footer-links" aria-label="Footer" data-i18n-attr="aria-label:common.footerNav">
          <a href="/" data-i18n="nav.home">Home</a>
          <a href="/status" data-i18n="nav.status">Status</a>
          <a href="/privacy" data-i18n="nav.privacy">Privacy</a>
          <a href="/account-deletion" data-i18n="nav.accountDeletion">Account deletion</a>
          <a href="/.well-known/security.txt" data-i18n="nav.security">Security</a>
          <a href="mailto:support@leaetzak.love" data-i18n="nav.support">Support</a>
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

  defp page_key_attr(nil), do: ""
  defp page_key_attr(page_key), do: ~s( data-page-key="#{escape(page_key)}")
end
