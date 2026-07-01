defmodule AdventureTimeApiWeb.EmailVerificationController do
  use AdventureTimeApiWeb, :controller

  alias AdventureTimeApi.Accounts
  alias AdventureTimeApiWeb.SiteLayout

  def show(conn, params) do
    locale = parse_locale(params["locale"])
    email = params["email"] || ""
    code = params["code"] || ""

    assigns =
      if valid_prefill?(email, code),
        do: pending_assigns(locale, email, code),
        else: missing_assigns(locale, email, code)

    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(200, verification_html(locale, assigns))
  end

  def confirm(conn, params) do
    locale = parse_locale(params["locale"])
    email = params["email"] || ""
    code = params["code"] || ""

    assigns =
      case Accounts.verify_email(%{"email" => email, "code" => code}) do
        {:ok, response} ->
          success_assigns(locale, email, code, response.authorized)

        {:error, :invalid_code, _message} ->
          invalid_assigns(locale, email, code)

        {:error, :expired, _message} ->
          expired_assigns(locale, email, code)

        {:error, :validation, _message} ->
          invalid_assigns(locale, email, code)

        {:error, :not_found, _message} ->
          missing_assigns(locale, email, code)
      end

    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(200, verification_html(locale, assigns))
  end

  defp pending_assigns(locale, email, code) do
    copy = copy_for(locale)

    %{
      badge: copy.pending_badge,
      title: copy.pending_title,
      body: copy.pending_body,
      email: email,
      code: code,
      locale: locale,
      show_confirm?: valid_prefill?(email, code),
      show_open_app?: valid_prefill?(email, code),
      show_back_to_app?: false,
      app_link: app_link(email, code, locale, auto_verify: true),
      primary_label: copy.confirm_in_browser,
      secondary_label: copy.open_in_app,
      badge_key: "email.pending.badge",
      title_key: "email.pending.title",
      body_key: "email.pending.body",
      primary_key: "email.action.confirmInBrowser",
      secondary_key: "email.action.openInApp"
    }
  end

  defp success_assigns(locale, email, code, true) do
    copy = copy_for(locale)

    %{
      badge: copy.ready_badge,
      title: copy.ready_title,
      body: copy.ready_body,
      email: email,
      code: code,
      locale: locale,
      show_confirm?: false,
      show_open_app?: true,
      show_back_to_app?: true,
      app_link: app_link(email, code, locale, mode: "login"),
      primary_label: copy.open_app_to_sign_in,
      secondary_label: copy.back_to_app,
      badge_key: "email.ready.badge",
      title_key: "email.ready.title",
      body_key: "email.ready.body",
      primary_key: "email.action.openAppToSignIn",
      secondary_key: "email.action.backToApp"
    }
  end

  defp success_assigns(locale, email, code, false) do
    copy = copy_for(locale)

    %{
      badge: copy.waiting_badge,
      title: copy.waiting_title,
      body: copy.waiting_body,
      email: email,
      code: code,
      locale: locale,
      show_confirm?: false,
      show_open_app?: true,
      show_back_to_app?: true,
      app_link: app_link(email, code, locale, mode: "login"),
      primary_label: copy.open_app,
      secondary_label: copy.back_to_app,
      badge_key: "email.waiting.badge",
      title_key: "email.waiting.title",
      body_key: "email.waiting.body",
      primary_key: "email.action.openApp",
      secondary_key: "email.action.backToApp"
    }
  end

  defp invalid_assigns(locale, email, code) do
    copy = copy_for(locale)

    %{
      badge: copy.error_badge,
      title: copy.invalid_title,
      body: copy.invalid_body,
      email: email,
      code: code,
      locale: locale,
      show_confirm?: false,
      show_open_app?: true,
      show_back_to_app?: false,
      app_link: app_link(email, code, locale, mode: "verify"),
      primary_label: copy.open_app,
      secondary_label: copy.back_to_app,
      badge_key: "email.error.badge",
      title_key: "email.invalid.title",
      body_key: "email.invalid.body",
      primary_key: "email.action.openApp",
      secondary_key: "email.action.backToApp"
    }
  end

  defp missing_assigns(locale, email, code) do
    copy = copy_for(locale)

    %{
      badge: copy.error_badge,
      title: copy.missing_title,
      body: copy.missing_body,
      email: email,
      code: code,
      locale: locale,
      show_confirm?: false,
      show_open_app?: true,
      show_back_to_app?: false,
      app_link: app_link(email, code, locale, mode: "verify"),
      primary_label: copy.open_app,
      secondary_label: copy.back_to_app,
      badge_key: "email.error.badge",
      title_key: "email.missing.title",
      body_key: "email.missing.body",
      primary_key: "email.action.openApp",
      secondary_key: "email.action.backToApp"
    }
  end

  defp expired_assigns(locale, email, code) do
    copy = copy_for(locale)

    %{
      badge: copy.error_badge,
      title: copy.expired_title,
      body: copy.expired_body,
      email: email,
      code: code,
      locale: locale,
      show_confirm?: false,
      show_open_app?: true,
      show_back_to_app?: false,
      app_link: app_link(email, code, locale, mode: "verify"),
      primary_label: copy.open_app,
      secondary_label: copy.back_to_app,
      badge_key: "email.error.badge",
      title_key: "email.expired.title",
      body_key: "email.expired.body",
      primary_key: "email.action.openApp",
      secondary_key: "email.action.backToApp"
    }
  end

  defp verification_html(locale, assigns) do
    copy = copy_for(locale)
    logo_path = ~p"/images/app-icon.png"
    escaped_email = escape(assigns.email)
    escaped_code = escape(assigns.code)
    escaped_locale = escape(Atom.to_string(assigns.locale))
    escaped_app_link = escape(assigns.app_link)
    escaped_badge = escape(assigns.badge)
    escaped_title = escape(assigns.title)
    escaped_body = escape(assigns.body)
    escaped_primary = escape(assigns.primary_label)
    escaped_secondary = escape(assigns.secondary_label)
    escaped_email_label = escape(copy.email_label)
    escaped_code_label = escape(copy.code_label)
    escaped_help = escape(copy.help_text)
    escaped_badge_key = escape(assigns.badge_key)
    escaped_title_key = escape(assigns.title_key)
    escaped_body_key = escape(assigns.body_key)
    escaped_primary_key = escape(assigns.primary_key)
    escaped_secondary_key = escape(assigns.secondary_key)

    confirm_form =
      if assigns.show_confirm? do
        """
        <form method="post" action="/email/verify" class="form">
          <input type="hidden" name="email" value="#{escaped_email}" />
          <input type="hidden" name="code" value="#{escaped_code}" />
          <input type="hidden" name="locale" value="#{escaped_locale}" data-language-field />
          <button type="submit" class="btn btn-primary" data-i18n="#{escaped_primary_key}">#{escaped_primary}</button>
        </form>
        """
      else
        ""
      end

    open_app_link =
      if assigns.show_open_app? do
        ~s(<a class="btn btn-secondary" href="#{escaped_app_link}" data-localized-app-link data-i18n="#{escaped_secondary_key}">#{escaped_secondary}</a>)
      else
        ""
      end

    body = """
    <section class="hero" aria-label="#{escaped_title}" data-i18n-attr="aria-label:#{escaped_title_key}" data-page-title-key="#{escaped_title_key}" data-page-description-key="#{escaped_body_key}">
      <div class="hero-copy">
        <p class="eyebrow" data-i18n="#{escaped_badge_key}">#{escaped_badge}</p>
        <h1 data-i18n="#{escaped_title_key}">#{escaped_title}</h1>
        <p class="lede" data-i18n="#{escaped_body_key}">#{escaped_body}</p>

        <div class="detail-grid" aria-label="#{escaped_help}" data-i18n-attr="aria-label:email.help">
          <div class="detail-card">
            <p class="kicker" data-i18n="email.label.email">#{escaped_email_label}</p>
            <p class="detail-value">#{escaped_email}</p>
          </div>
          <div class="detail-card">
            <p class="kicker" data-i18n="email.label.code">#{escaped_code_label}</p>
            <p class="code-pill">#{escaped_code}</p>
          </div>
        </div>

        <p class="form-help" data-i18n="email.help">#{escaped_help}</p>

        <div class="actions">
          #{confirm_form}
          #{open_app_link}
        </div>
      </div>

      <aside class="hero-panel" aria-label="Adventure Time TCG">
        <div class="hero-mark">
          <div class="card-ghost left"></div>
          <div class="card-ghost right"></div>
          <div class="logo-wrap">
            <img src="#{logo_path}" alt="Adventure Time TCG app icon" data-i18n-attr="alt:auth.iconAlt" />
          </div>
        </div>

        <div class="tile-stack">
          <div class="tile">
            <p class="label" data-i18n="email.tile.app.label">#{escape(copy.app_label)}</p>
            <p class="value" data-i18n="email.tile.app.value">#{escape(copy.app_value)}</p>
          </div>
          <div class="tile">
            <p class="label" data-i18n="email.tile.browser.label">#{escape(copy.browser_label)}</p>
            <p class="value" data-i18n="email.tile.browser.value">#{escape(copy.browser_value)}</p>
          </div>
          <div class="tile">
            <p class="label" data-i18n="email.tile.tip.label">#{escape(copy.tip_label)}</p>
            <p class="value" data-i18n="email.tile.tip.value">#{escape(copy.tip_value)}</p>
          </div>
        </div>
      </aside>
    </section>
    """

    SiteLayout.document(
      title: "#{assigns.title} | Adventure Time TCG",
      description: assigns.body,
      lang: copy.lang,
      main_class: "auth-shell",
      body: body
    )
  end

  defp valid_prefill?(email, code) do
    String.contains?(email, "@") and String.match?(code, ~r/^\d{6}$/)
  end

  defp parse_locale("fr"), do: :fr
  defp parse_locale(_), do: :en

  defp app_link(email, code, locale, extra_params) do
    params =
      [email: email, code: code, locale: Atom.to_string(locale)]
      |> Keyword.merge(extra_params)
      |> Enum.into(%{})
      |> URI.encode_query()

    "adventure-time://login?#{params}"
  end

  defp escape(value) do
    value
    |> to_string()
    |> Plug.HTML.html_escape_to_iodata()
    |> IO.iodata_to_binary()
  end

  defp copy_for(:fr) do
    %{
      lang: "fr",
      pending_badge: "Confirmation",
      pending_title: "Confirme ton e-mail",
      pending_body:
        "Valide ton compte ici dans le navigateur, ou ouvre l'application pour finir l'inscription sans recopier le code.",
      waiting_badge: "En attente",
      waiting_title: "Ton e-mail est confirmé",
      waiting_body:
        "Ton compte est créé, mais un super admin doit encore approuver l'accès avant ta première connexion.",
      ready_badge: "Compte prêt",
      ready_title: "Ton compte est prêt",
      ready_body:
        "Ton e-mail est confirmé et ton accès est déjà approuvé. Ouvre l'application pour te connecter.",
      error_badge: "Lien invalide",
      invalid_title: "Ce code n'a pas pu être confirmé",
      invalid_body:
        "Le code semble incorrect. Ouvre l'application pour corriger l'e-mail, vérifier le code ou en demander un nouveau.",
      missing_title: "Aucune vérification en attente",
      missing_body:
        "Ce lien ne correspond à aucune vérification active. Ouvre l'application pour demander un nouveau code ou reprendre l'inscription.",
      expired_title: "Ce lien n'est plus actif",
      expired_body:
        "Ce code a peut-être déjà été utilisé ou il a expiré. Ouvre l'application pour demander un nouveau code.",
      confirm_in_browser: "Confirmer dans le navigateur",
      open_in_app: "Ouvrir l'application",
      open_app: "Ouvrir l'application",
      open_app_to_sign_in: "Ouvrir l'application pour se connecter",
      back_to_app: "Revenir dans l'application",
      email_label: "E-mail",
      code_label: "Code",
      help_text: "Le même code fonctionne aussi dans l'écran d'inscription de l'application.",
      app_label: "Application",
      app_value: "Ouverture directe via deeplink",
      browser_label: "Navigateur",
      browser_value: "Confirmation sans recopier le code",
      tip_label: "Astuce",
      tip_value: "Si rien ne se passe, retourne à l'app et colle le code manuellement."
    }
  end

  defp copy_for(_locale) do
    %{
      lang: "en",
      pending_badge: "Confirmation",
      pending_title: "Confirm your email",
      pending_body:
        "Finish here in the browser, or open the app and continue without typing the code by hand.",
      waiting_badge: "Waiting",
      waiting_title: "Your email is confirmed",
      waiting_body:
        "Your account is created, but a super admin still needs to approve access before your first sign-in.",
      ready_badge: "Account ready",
      ready_title: "Your account is ready",
      ready_body:
        "Your email is confirmed and access is already approved. Open the app to sign in.",
      error_badge: "Invalid link",
      invalid_title: "This code could not be confirmed",
      invalid_body:
        "The code looks incorrect. Open the app to edit the email, verify the code, or request a fresh one.",
      missing_title: "No verification is waiting",
      missing_body:
        "This link does not match any active verification. Open the app to request a fresh code or restart signup.",
      expired_title: "This link is no longer active",
      expired_body:
        "This code may have already been used or it expired. Open the app to request a new code.",
      confirm_in_browser: "Confirm in browser",
      open_in_app: "Open the app",
      open_app: "Open the app",
      open_app_to_sign_in: "Open the app to sign in",
      back_to_app: "Back to the app",
      email_label: "Email",
      code_label: "Code",
      help_text: "The same code also works in the app's sign-up verification screen.",
      app_label: "App",
      app_value: "Opens directly with a deep link",
      browser_label: "Browser",
      browser_value: "Can finish verification without retyping the code",
      tip_label: "Tip",
      tip_value: "If nothing opens, return to the app and paste the code manually."
    }
  end
end
