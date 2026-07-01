defmodule AdventureTimeApiWeb.PasswordResetController do
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
    |> send_resp(200, reset_html(locale, assigns))
  end

  def confirm(conn, params) do
    locale = parse_locale(params["locale"])
    email = params["email"] || ""
    code = params["code"] || ""
    password = params["password"] || ""

    assigns =
      case Accounts.reset_password(%{"email" => email, "code" => code, "password" => password}) do
        {:ok, _response} ->
          success_assigns(locale, email)

        {:error, :validation, message} ->
          validation_assigns(locale, email, code, message)

        {:error, :invalid_code, _message} ->
          invalid_assigns(locale, email, code)

        {:error, :expired, _message} ->
          expired_assigns(locale, email, code)

        {:error, :not_found, _message} ->
          missing_assigns(locale, email, code)
      end

    conn
    |> put_resp_content_type("text/html")
    |> put_resp_header("cache-control", "no-store")
    |> send_resp(200, reset_html(locale, assigns))
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
      error_message: nil,
      show_form?: valid_prefill?(email, code),
      show_open_app?: valid_prefill?(email, code),
      app_link: app_link(email, code, locale, mode: "reset-password"),
      primary_label: copy.reset_in_browser,
      secondary_label: copy.open_in_app,
      password_label: copy.password_label,
      password_placeholder: copy.password_placeholder,
      badge_key: "reset.pending.badge",
      title_key: "reset.pending.title",
      body_key: "reset.pending.body",
      primary_key: "reset.action.resetInBrowser",
      secondary_key: "reset.action.openInApp"
    }
  end

  defp success_assigns(locale, email) do
    copy = copy_for(locale)

    %{
      badge: copy.success_badge,
      title: copy.success_title,
      body: copy.success_body,
      email: email,
      code: "",
      locale: locale,
      error_message: nil,
      show_form?: false,
      show_open_app?: true,
      app_link: app_link(email, "", locale, mode: "login"),
      primary_label: copy.open_app_to_sign_in,
      secondary_label: copy.open_app_to_sign_in,
      password_label: copy.password_label,
      password_placeholder: copy.password_placeholder,
      badge_key: "reset.success.badge",
      title_key: "reset.success.title",
      body_key: "reset.success.body",
      primary_key: "reset.action.openAppToSignIn",
      secondary_key: "reset.action.openAppToSignIn"
    }
  end

  defp validation_assigns(locale, email, code, message) do
    copy = copy_for(locale)

    %{
      badge: copy.validation_badge,
      title: copy.validation_title,
      body: copy.validation_body,
      email: email,
      code: code,
      locale: locale,
      error_message: message,
      show_form?: valid_prefill?(email, code),
      show_open_app?: valid_prefill?(email, code),
      app_link: app_link(email, code, locale, mode: "reset-password"),
      primary_label: copy.reset_in_browser,
      secondary_label: copy.open_in_app,
      password_label: copy.password_label,
      password_placeholder: copy.password_placeholder,
      badge_key: "reset.validation.badge",
      title_key: "reset.validation.title",
      body_key: "reset.validation.body",
      primary_key: "reset.action.resetInBrowser",
      secondary_key: "reset.action.openInApp"
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
      error_message: nil,
      show_form?: false,
      show_open_app?: true,
      app_link: app_link(email, code, locale, mode: "reset-password"),
      primary_label: copy.open_in_app,
      secondary_label: copy.open_in_app,
      password_label: copy.password_label,
      password_placeholder: copy.password_placeholder,
      badge_key: "reset.error.badge",
      title_key: "reset.invalid.title",
      body_key: "reset.invalid.body",
      primary_key: "reset.action.openInApp",
      secondary_key: "reset.action.openInApp"
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
      error_message: nil,
      show_form?: false,
      show_open_app?: true,
      app_link: app_link(email, code, locale, mode: "reset-password"),
      primary_label: copy.open_in_app,
      secondary_label: copy.open_in_app,
      password_label: copy.password_label,
      password_placeholder: copy.password_placeholder,
      badge_key: "reset.error.badge",
      title_key: "reset.missing.title",
      body_key: "reset.missing.body",
      primary_key: "reset.action.openInApp",
      secondary_key: "reset.action.openInApp"
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
      error_message: nil,
      show_form?: false,
      show_open_app?: true,
      app_link: app_link(email, code, locale, mode: "reset-password"),
      primary_label: copy.open_in_app,
      secondary_label: copy.open_in_app,
      password_label: copy.password_label,
      password_placeholder: copy.password_placeholder,
      badge_key: "reset.error.badge",
      title_key: "reset.expired.title",
      body_key: "reset.expired.body",
      primary_key: "reset.action.openInApp",
      secondary_key: "reset.action.openInApp"
    }
  end

  defp reset_html(locale, assigns) do
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
    escaped_password_label = escape(assigns.password_label)
    escaped_password_placeholder = escape(assigns.password_placeholder)
    escaped_error = escape(assigns.error_message || "")
    escaped_badge_key = escape(assigns.badge_key)
    escaped_title_key = escape(assigns.title_key)
    escaped_body_key = escape(assigns.body_key)
    escaped_primary_key = escape(assigns.primary_key)
    escaped_secondary_key = escape(assigns.secondary_key)

    reset_form =
      if assigns.show_form? do
        """
        <form method="post" action="/password/reset" class="form">
          <input type="hidden" name="email" value="#{escaped_email}" />
          <input type="hidden" name="code" value="#{escaped_code}" />
          <input type="hidden" name="locale" value="#{escaped_locale}" data-language-field />
          <label class="field">
            <span class="label" data-i18n="reset.label.password">#{escaped_password_label}</span>
            <input
              class="input"
              type="password"
              name="password"
              minlength="8"
              required
              placeholder="#{escaped_password_placeholder}"
              data-i18n-attr="placeholder:reset.placeholder.password"
            />
          </label>
          #{if assigns.error_message, do: ~s(<p class="form-error">#{escaped_error}</p>), else: ""}
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

        <div class="detail-grid" aria-label="#{escaped_help}" data-i18n-attr="aria-label:reset.help">
          <div class="detail-card">
            <p class="kicker" data-i18n="reset.label.email">#{escaped_email_label}</p>
            <p class="detail-value">#{escaped_email}</p>
          </div>
          <div class="detail-card">
            <p class="kicker" data-i18n="reset.label.code">#{escaped_code_label}</p>
            <p class="code-pill">#{escaped_code}</p>
          </div>
        </div>

        <p class="form-help" data-i18n="reset.help">#{escaped_help}</p>

        <div class="actions">
          #{reset_form}
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
            <p class="label" data-i18n="reset.tile.app.label">#{escape(copy.app_label)}</p>
            <p class="value" data-i18n="reset.tile.app.value">#{escape(copy.app_value)}</p>
          </div>
          <div class="tile">
            <p class="label" data-i18n="reset.tile.browser.label">#{escape(copy.browser_label)}</p>
            <p class="value" data-i18n="reset.tile.browser.value">#{escape(copy.browser_value)}</p>
          </div>
          <div class="tile">
            <p class="label" data-i18n="reset.tile.tip.label">#{escape(copy.tip_label)}</p>
            <p class="value" data-i18n="reset.tile.tip.value">#{escape(copy.tip_value)}</p>
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
      |> Enum.reject(fn {_key, value} -> value in [nil, ""] end)
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
      pending_badge: "Réinitialisation",
      pending_title: "Choisis un nouveau mot de passe",
      pending_body:
        "Termine ici dans le navigateur, ou ouvre l'application pour revenir avec l'e-mail et le code déjà remplis.",
      success_badge: "Mot de passe mis à jour",
      success_title: "Ton mot de passe est prêt",
      success_body:
        "Ton nouveau mot de passe est enregistré. Ouvre l'application pour te reconnecter.",
      validation_badge: "Presque fini",
      validation_title: "Choisis un mot de passe valide",
      validation_body:
        "Le code semble bon, mais ton nouveau mot de passe doit encore respecter les règles minimales.",
      error_badge: "Lien invalide",
      invalid_title: "Ce code n'a pas pu être utilisé",
      invalid_body:
        "Le code semble incorrect. Ouvre l'application pour demander un nouvel e-mail de réinitialisation.",
      missing_title: "Aucune réinitialisation en attente",
      missing_body:
        "Ce lien ne correspond à aucune demande active. Ouvre l'application pour demander un nouvel e-mail de réinitialisation.",
      expired_title: "Ce lien n'est plus actif",
      expired_body:
        "Ce code a peut-être déjà été utilisé ou il a expiré. Ouvre l'application pour demander un nouveau code.",
      reset_in_browser: "Mettre à jour le mot de passe",
      open_in_app: "Ouvrir l'application",
      open_app_to_sign_in: "Ouvrir l'application pour se connecter",
      email_label: "E-mail",
      code_label: "Code",
      password_label: "Nouveau mot de passe",
      password_placeholder: "Au moins 8 caractères",
      help_text:
        "Le même code fonctionne aussi dans l'écran de mot de passe oublié de l'application.",
      app_label: "Application",
      app_value: "Retour direct avec deeplink",
      browser_label: "Navigateur",
      browser_value: "Nouveau mot de passe sans retaper le code",
      tip_label: "Astuce",
      tip_value: "Si tu préfères, ouvre l'app pour finaliser la réinitialisation là-bas."
    }
  end

  defp copy_for(_locale) do
    %{
      lang: "en",
      pending_badge: "Reset",
      pending_title: "Choose a new password",
      pending_body:
        "Finish here in the browser, or open the app and come back with your email and code already filled in.",
      success_badge: "Password updated",
      success_title: "Your password is ready",
      success_body: "Your new password is saved. Open the app to sign in again.",
      validation_badge: "Almost there",
      validation_title: "Choose a valid password",
      validation_body:
        "The code looks right, but your new password still needs to meet the minimum rules.",
      error_badge: "Invalid link",
      invalid_title: "This code could not be used",
      invalid_body:
        "The code looks incorrect. Open the app to request a fresh password reset email.",
      missing_title: "No reset is waiting",
      missing_body:
        "This link does not match any active reset request. Open the app to request a fresh password reset email.",
      expired_title: "This link is no longer active",
      expired_body:
        "This code may have already been used or it expired. Open the app to request a fresh code.",
      reset_in_browser: "Update password",
      open_in_app: "Open the app",
      open_app_to_sign_in: "Open the app to sign in",
      email_label: "Email",
      code_label: "Code",
      password_label: "New password",
      password_placeholder: "At least 8 characters",
      help_text: "The same code also works inside the app's forgot password flow.",
      app_label: "App",
      app_value: "Direct handoff by deeplink",
      browser_label: "Browser",
      browser_value: "Set a new password without retyping the code",
      tip_label: "Tip",
      tip_value: "If you prefer, open the app and finish the reset there."
    }
  end
end
