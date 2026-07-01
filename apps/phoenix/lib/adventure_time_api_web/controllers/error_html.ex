defmodule AdventureTimeApiWeb.ErrorHTML do
  @moduledoc false

  import Phoenix.HTML, only: [raw: 1]

  alias AdventureTimeApiWeb.SiteLayout

  def render(template, _assigns) do
    status = template |> String.replace_suffix(".html", "")

    if status == "404" do
      raw(not_found_document())
    else
      raw(error_document(status))
    end
  end

  def not_found_document do
    logo_path = "/images/app-icon.png"

    body = """
    <section class="hero not-found-hero" aria-label="Missing page" data-i18n-attr="aria-label:notFound.heroAria">
      <div class="hero-copy not-found-copy">
        <p class="kicker kicker-primary" data-i18n="notFound.kicker">404: Lost in the Candy Kingdom</p>
        <h1 data-i18n-html="notFound.title">This page is missing from the collection.</h1>
        <p class="lede" data-i18n="notFound.lede">
          We searched the Tree Fort, the Nightosphere, and one very suspicious pack wrapper. This page still did not show up.
        </p>

        <ul class="pill-list not-found-list" aria-label="Helpful exits" data-i18n-attr="aria-label:notFound.exitsAria">
          <li data-i18n="notFound.clue.route">No secret endpoint map here. Nice try, wizard.</li>
          <li data-i18n="notFound.clue.home">The homepage is safe, sparkly, and only one click away.</li>
          <li data-i18n="notFound.clue.support">If a link sent you here, support can help untangle it.</li>
        </ul>

        <div class="actions">
          <a class="btn btn-primary" href="/" data-i18n="notFound.cta.home">Return to homepage</a>
          <a class="btn btn-ghost" href="mailto:support@leaetzak.love" data-i18n="notFound.cta.support">Contact support</a>
        </div>
      </div>

      <aside class="hero-panel not-found-panel" aria-label="Lost card report" data-i18n-attr="aria-label:notFound.reportAria">
        <div class="lost-card-stack" aria-hidden="true">
          <div class="lost-card lost-card-back">
            <span>404</span>
          </div>
          <div class="lost-card lost-card-front">
            <img src="#{logo_path}" alt="" />
            <b>404</b>
            <span data-i18n="notFound.cardStatus">Page MIA</span>
          </div>
        </div>

        <div class="tile-stack">
          <div class="tile">
            <p class="label" data-i18n="notFound.tile.rarity.label">Rarity</p>
            <p class="value" data-i18n="notFound.tile.rarity.value">Mythically misplaced</p>
          </div>
          <div class="tile">
            <p class="label" data-i18n="notFound.tile.ability.label">Ability</p>
            <p class="value" data-i18n="notFound.tile.ability.value">Dodges every route</p>
          </div>
          <div class="tile">
            <p class="label" data-i18n="notFound.tile.counter.label">Counterplay</p>
            <p class="value" data-i18n="notFound.tile.counter.value">Go home, regroup</p>
          </div>
        </div>
      </aside>
    </section>
    """

    SiteLayout.document(
      title: "Page Not Found - Adventure Time TCG",
      description:
        "The requested Adventure Time TCG page could not be found. Return to the homepage or contact support.",
      page_key: "notFound",
      body: body
    )
  end

  defp error_document(status) do
    body = """
    <section class="hero not-found-hero" aria-label="Server error">
      <div class="hero-copy not-found-copy">
        <p class="kicker kicker-primary">Something went wrong</p>
        <h1>This page hit a snag.</h1>
        <p class="lede">
          Adventure Time TCG could not finish this page right now. Try again in a moment, or go back to the app and continue there.
        </p>

        <div class="actions">
          <a class="btn btn-primary" href="/">Go to homepage</a>
          <a class="btn btn-ghost" href="adventure-time://login?mode=login">Open the app</a>
        </div>
      </div>

      <aside class="hero-panel not-found-panel" aria-label="Adventure Time TCG">
        <div class="tile-stack">
          <div class="tile">
            <p class="label">Status</p>
            <p class="value">#{escape(status)}</p>
          </div>
          <div class="tile">
            <p class="label">Next step</p>
            <p class="value">Try again soon</p>
          </div>
        </div>
      </aside>
    </section>
    """

    SiteLayout.document(
      title: "Something Went Wrong - Adventure Time TCG",
      description: "Adventure Time TCG could not finish this page right now.",
      body: body
    )
  end

  defp escape(value) do
    value
    |> to_string()
    |> Plug.HTML.html_escape_to_iodata()
    |> IO.iodata_to_binary()
  end
end
