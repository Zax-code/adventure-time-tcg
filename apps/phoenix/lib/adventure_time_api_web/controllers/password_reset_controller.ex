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
      password_placeholder: copy.password_placeholder
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
      password_placeholder: copy.password_placeholder
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
      password_placeholder: copy.password_placeholder
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
      password_placeholder: copy.password_placeholder
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
      password_placeholder: copy.password_placeholder
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
      password_placeholder: copy.password_placeholder
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

    reset_form =
      if assigns.show_form? do
        """
        <form method="post" action="/password/reset" class="form">
          <input type="hidden" name="email" value="#{escaped_email}" />
          <input type="hidden" name="code" value="#{escaped_code}" />
          <input type="hidden" name="locale" value="#{escaped_locale}" />
          <label class="field">
            <span class="label">#{escaped_password_label}</span>
            <input
              class="input"
              type="password"
              name="password"
              minlength="8"
              required
              placeholder="#{escaped_password_placeholder}"
            />
          </label>
          #{if assigns.error_message, do: ~s(<p class="form-error">#{escaped_error}</p>), else: ""}
          <button type="submit" class="btn btn-primary">#{escaped_primary}</button>
        </form>
        """
      else
        ""
      end

    open_app_link =
      if assigns.show_open_app? do
        ~s(<a class="btn btn-secondary" href="#{escaped_app_link}">#{escaped_secondary}</a>)
      else
        ""
      end

    body = """
    <section class="hero" aria-label="#{escaped_title}">
      <div class="hero-copy">
        <p class="eyebrow">#{escaped_badge}</p>
        <h1>#{escaped_title}</h1>
        <p class="lede">#{escaped_body}</p>

        <div class="detail-grid" aria-label="#{escaped_help}">
          <div class="detail-card">
            <p class="kicker">#{escaped_email_label}</p>
            <p class="detail-value">#{escaped_email}</p>
          </div>
          <div class="detail-card">
            <p class="kicker">#{escaped_code_label}</p>
            <p class="code-pill">#{escaped_code}</p>
          </div>
        </div>

        <p class="form-help">#{escaped_help}</p>

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
            <img src="#{logo_path}" alt="Adventure Time TCG app icon" />
          </div>
        </div>

        <div class="tile-stack">
          <div class="tile">
            <p class="label">#{escape(copy.app_label)}</p>
            <p class="value">#{escape(copy.app_value)}</p>
          </div>
          <div class="tile">
            <p class="label">#{escape(copy.browser_label)}</p>
            <p class="value">#{escape(copy.browser_value)}</p>
          </div>
          <div class="tile">
            <p class="label">#{escape(copy.tip_label)}</p>
            <p class="value">#{escape(copy.tip_value)}</p>
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
      pending_badge: "Reinitialisation",
      pending_title: "Choisis un nouveau mot de passe",
      pending_body:
        "Termine ici dans le navigateur, ou ouvre l'application pour revenir avec l'e-mail et le code deja remplis.",
      success_badge: "Mot de passe mis a jour",
      success_title: "Ton mot de passe est pret",
      success_body:
        "Ton nouveau mot de passe est enregistre. Ouvre l'application pour te reconnecter.",
      validation_badge: "Presque fini",
      validation_title: "Choisis un mot de passe valide",
      validation_body:
        "Le code semble bon, mais ton nouveau mot de passe doit encore respecter les regles minimales.",
      error_badge: "Lien invalide",
      invalid_title: "Ce code n'a pas pu etre valide",
      invalid_body:
        "Le code semble incorrect. Ouvre l'application pour demander un nouvel e-mail de reinitialisation.",
      missing_title: "Aucune reinitialisation en attente",
      missing_body:
        "Ce lien ne correspond a aucune demande active. Ouvre l'application pour demander un nouvel e-mail de reinitialisation.",
      expired_title: "Ce lien n'est plus actif",
      expired_body:
        "Ce code a peut-etre deja ete utilise ou il a expire. Ouvre l'application pour demander un nouveau code.",
      reset_in_browser: "Mettre a jour le mot de passe",
      open_in_app: "Ouvrir l'application",
      open_app_to_sign_in: "Ouvrir l'application pour se connecter",
      email_label: "E-mail",
      code_label: "Code",
      password_label: "Nouveau mot de passe",
      password_placeholder: "Au moins 8 caracteres",
      help_text:
        "Le meme code fonctionne aussi dans l'ecran mot de passe oublie de l'application.",
      app_label: "Application",
      app_value: "Retour direct avec deeplink",
      browser_label: "Navigateur",
      browser_value: "Nouveau mot de passe sans retaper le code",
      tip_label: "Astuce",
      tip_value: "Si tu preferes, ouvre l'app pour finaliser la reinitialisation la-bas."
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
