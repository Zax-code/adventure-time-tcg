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
    <section class="hero" aria-label="App overview">
      <div class="hero-copy">
        <h1>Collect, quest, and battle in <span class="grad">Adventure Time TCG</span>.</h1>
        <p class="lede">
          Build a collection of Adventure Time cards, open packs, complete daily
          challenges, and test your team in friendly head-to-head battles.
        </p>

        <ul class="pill-list" aria-label="What you can do">
          <li>Open packs and grow a collection of character cards</li>
          <li>Earn coins, dust, and rewards from daily play</li>
          <li>Challenge friends and watch matches unfold turn by turn</li>
        </ul>

        <div class="actions">
          <a class="btn btn-primary" href="#how-it-plays">See how it plays</a>
          <a class="btn btn-ghost" href="/privacy">Privacy &amp; account</a>
        </div>
      </div>

      <aside class="hero-panel" aria-label="App snapshot">
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
            <p class="label">Collect</p>
            <p class="value">Cards &amp; packs</p>
          </div>
          <div class="tile">
            <p class="label">Progress</p>
            <p class="value">Quests &amp; rewards</p>
          </div>
          <div class="tile">
            <p class="label">Play</p>
            <p class="value">Friendly battles</p>
          </div>
        </div>
      </aside>
    </section>

    <section class="stat-strip" aria-label="At a glance">
      <div class="stat">
        <b>3</b>
        <span>Ways to play each day</span>
      </div>
      <div class="stat">
        <b>2</b>
        <span>Languages: English &amp; French</span>
      </div>
      <div class="stat">
        <b>PvP</b>
        <span>Challenge other players</span>
      </div>
      <div class="stat">
        <b>Daily</b>
        <span>Fresh quests and rewards</span>
      </div>
    </section>

    <section class="section" id="how-it-plays" aria-label="How the app plays">
      <div class="section-head">
        <div>
          <p class="kicker kicker-primary">How it plays</p>
          <h2>A card collection with something to do every day</h2>
        </div>
        <p>Open packs, make progress, and bring your favorite cards into battle.</p>
      </div>

      <div class="bento">
        <article class="card feature-card wide">
          <span class="card-glyph" aria-hidden="true">#{app_icon(:cards)}</span>
          <span class="kicker kicker-primary">Collect</span>
          <h2>Complete your character collection</h2>
          <p>
            Browse your cards, chase rarities, recycle extras into dust, and craft the
            characters you still need.
          </p>
        </article>

        <article class="card feature-card wide">
          <span class="card-glyph g-secondary" aria-hidden="true">#{app_icon(:quest)}</span>
          <span class="kicker kicker-secondary">Quest</span>
          <h2>Daily challenges with playful rewards</h2>
          <p>
            Check in, solve quick challenges, sync optional step progress, and turn small
            daily wins into coins, dust, and packs.
          </p>
        </article>

        <article class="card feature-card wide">
          <span class="card-glyph g-secondary" aria-hidden="true">#{app_icon(:pack)}</span>
          <span class="kicker kicker-secondary">Packs</span>
          <h2>Open rewards and discover new cards</h2>
          <p>
            Crack open packs from daily play, find new characters, and turn every reward
            into collection progress.
          </p>
        </article>

        <article class="card feature-card wide">
          <span class="card-glyph g-accent" aria-hidden="true">#{app_icon(:swords)}</span>
          <span class="kicker">Battle</span>
          <h2>Build a team and battle your friends</h2>
          <p>
            Pick your loadout, make tactical choices, follow the battle log, and keep a
            history of your favorite wins.
          </p>
        </article>
      </div>
    </section>

    <section class="section" aria-label="Player-friendly features">
      <div class="section-head">
        <div>
          <p class="kicker">Player friendly</p>
          <h2>Built for playful, low-pressure sessions</h2>
        </div>
      </div>

      <div class="card-grid">
        <article class="card">
          <span class="card-glyph g-success" aria-hidden="true">#{app_icon(:check_circle)}</span>
          <span class="kicker kicker-primary">Easy check-in</span>
          <h2>Know when the game is available</h2>
          <p>
            The status page gives players a simple place to check whether sign-in,
            collections, and battles are working normally.
          </p>
          <a class="text-link" href="/status">Check game status</a>
        </article>

        <article class="card">
          <span class="card-glyph g-accent" aria-hidden="true">#{app_icon(:shield_user)}</span>
          <span class="kicker">Account care</span>
          <h2>Your progress belongs to your account</h2>
          <p>
            Sign in to keep your collection, quest progress, gifts, preferences, and battle
            history with you.
          </p>
          <a class="text-link" href="/privacy">See privacy details</a>
        </article>

        <article class="card">
          <span class="card-glyph g-danger" aria-hidden="true">#{app_icon(:x_circle)}</span>
          <span class="kicker">Account deletion</span>
          <h2>You can delete your account</h2>
          <p>
            The account deletion page explains what is removed, what may be retained for
            safety, and how to request deletion.
          </p>
          <a class="text-link" href="/account-deletion">Delete account details</a>
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
            Data is sent securely when you use the app. Third-party services are used only
            as needed for platform login, push notifications, app store distribution, and
            optional Fitbit connection.
          </p>
        </article>

        <article class="card feature-card">
          <span class="kicker">Control</span>
          <h3>Access and deletion</h3>
          <p>
            You can delete your account in the mobile settings screen. Deletion removes
            your account, credentials, collection, gifts, quest progress, PvP data, step
            snapshots, notification devices, and profile image from Adventure Time TCG.
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

  defp app_icon(:cards) do
    """
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M20.466,1.967,14.78.221a5.011,5.011,0,0,0-6.224,3.24L8.368,4H5A5.006,5.006,0,0,0,0,9V19a5.006,5.006,0,0,0,5,5h6a4.975,4.975,0,0,0,3.92-1.934,5.029,5.029,0,0,0,.689.052,4.976,4.976,0,0,0,4.775-3.563L23.8,8.156A5.021,5.021,0,0,0,20.466,1.967ZM11,22H5a3,3,0,0,1-3-3V9A3,3,0,0,1,5,6h6a3,3,0,0,1,3,3V19A3,3,0,0,1,11,22ZM21.887,7.563l-3.412,10.4a2.992,2.992,0,0,1-2.6,2.134A4.992,4.992,0,0,0,16,19V9a5.006,5.006,0,0,0-5-5h-.507a3,3,0,0,1,3.7-1.867l5.686,1.746A3.006,3.006,0,0,1,21.887,7.563ZM12,13c0,1.45-1.544,3.391-2.714,4.378a1.991,1.991,0,0,1-2.572,0C5.544,16.391,4,14.45,4,13a2,2,0,0,1,4,0,2,2,0,0,1,4,0Z" />
    </svg>
    """
  end

  defp app_icon(:quest) do
    """
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6 4C6 2.89543 6.89543 2 8 2H16C17.1046 2 18 2.89543 18 4V20C18 21.1046 17.1046 22 16 22H8C6.89543 22 6 21.1046 6 20V4Z" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="2" />
      <path d="M6 6H4C3.44772 6 3 5.55228 3 5C3 4.44772 3.44772 4 4 4H6M18 6H20C20.5523 6 21 5.55228 21 5C21 4.44772 20.5523 4 20 4H18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M12 8L13 10.5L15.5 11L13.5 13L14 15.5L12 14L10 15.5L10.5 13L8.5 11L11 10.5L12 8Z" fill="currentColor" />
      <path d="M9 18H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    """
  end

  defp app_icon(:swords) do
    """
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M6.152 19.092a3.1 3.1 0 0 0-.53-.71 3.1 3.1 0 0 0-.75-.55c-.325-.172-.068-.54-.068-.54.333-.507.636-1.015.887-1.458l-1.683-1.682H2.374a.57.57 0 0 1-.57-.569.57.57 0 0 1 .57-.569h1.869a.57.57 0 0 1 .403.167l6.15 6.144a.57.57 0 0 1 .167.403v1.878a.57.57 0 0 1-.57.569.57.57 0 0 1-.569-.57v-1.641l-1.676-1.675a25 25 0 0 0-1.5.955s-.298.212-.496-.152m-2.69-.466c-.512 0-.993.199-1.355.56a1.9 1.9 0 0 0-.56 1.353c0 .512.198.992.56 1.353s.843.56 1.355.56.993-.199 1.355-.56.56-.842.56-1.353-.199-.991-.56-1.352a1.9 1.9 0 0 0-1.355-.561m5.358-3.947a.65.65 0 0 1-.917 0l-.635-.634a.65.65 0 0 1 0-.916L18.102 2.306c.252-.252.75-.485 1.104-.517l2.656-.241a.522.522 0 0 1 .587.587l-.241 2.65c-.032.355-.265.852-.517 1.104L10.856 16.713a.65.65 0 0 1-.918 0l-.635-.635a.65.65 0 0 1 0-.916l9.071-9.063a.34.34 0 0 0 0-.483.34.34 0 0 0-.483 0z" />
    </svg>
    """
  end

  defp app_icon(:check_circle) do
    """
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
      <path d="M7 12l3.5 3.5L17 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    """
  end

  defp app_icon(:x_circle) do
    """
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    """
  end

  defp app_icon(:shield_user) do
    """
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 2L4 5V11C4 16.5 7.5 20.5 12 22C16.5 20.5 20 16.5 20 11V5L12 2Z" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <circle cx="12" cy="9" r="2.5" fill="currentColor" />
      <path d="M8 16C8 14 9.5 13 12 13C14.5 13 16 14 16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    """
  end

  defp app_icon(:pack) do
    """
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <g transform="translate(12 12) rotate(-7) scale(.94) translate(-12 -12)">
        <path d="M5.2 2.75 5.95 1.25 6.7 2.75 7.45 1.25 8.2 2.75 8.95 1.25 9.7 2.75 10.45 1.25 11.2 2.75 11.95 1.25 12.7 2.75 13.45 1.25 14.2 2.75 14.95 1.25 15.7 2.75 16.45 1.25 17.2 2.75 17.95 1.25 18.7 2.75V21.25L17.95 22.75 17.2 21.25 16.45 22.75 15.7 21.25 14.95 22.75 14.2 21.25 13.45 22.75 12.7 21.25 11.95 22.75 11.2 21.25 10.45 22.75 9.7 21.25 8.95 22.75 8.2 21.25 7.45 22.75 6.7 21.25 5.95 22.75 5.2 21.25Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-linejoin="miter" stroke-miterlimit="3" stroke-width="0.9" />
        <path d="M6.2 5.45H17.8M6.2 18.55H17.8" stroke="currentColor" stroke-width="0.95" />
        <g transform="translate(6.05 6.05) scale(.48)">
          <path d="M6.152 19.092a3.1 3.1 0 0 0-.53-.71 3.1 3.1 0 0 0-.75-.55c-.325-.172-.068-.54-.068-.54.333-.507.636-1.015.887-1.458l-1.683-1.682H2.374a.57.57 0 0 1-.57-.569.57.57 0 0 1 .57-.569h1.869a.57.57 0 0 1 .403.167l6.15 6.144a.57.57 0 0 1 .167.403v1.878a.57.57 0 0 1-.57.569.57.57 0 0 1-.569-.57v-1.641l-1.676-1.675a25 25 0 0 0-1.5.955s-.298.212-.496-.152m-2.69-.466c-.512 0-.993.199-1.355.56a1.9 1.9 0 0 0-.56 1.353c0 .512.198.992.56 1.353s.843.56 1.355.56.993-.199 1.355-.56.56-.842.56-1.353-.199-.991-.56-1.352a1.9 1.9 0 0 0-1.355-.561m5.358-3.947a.65.65 0 0 1-.917 0l-.635-.634a.65.65 0 0 1 0-.916L18.102 2.306c.252-.252.75-.485 1.104-.517l2.656-.241a.522.522 0 0 1 .587.587l-.241 2.65c-.032.355-.265.852-.517 1.104L10.856 16.713a.65.65 0 0 1-.918 0l-.635-.635a.65.65 0 0 1 0-.916l9.071-9.063a.34.34 0 0 0 0-.483.34.34 0 0 0-.483 0z" fill="currentColor" />
        </g>
      </g>
    </svg>
    """
  end
end
