defmodule AdventureTimeApi.Accounts.PasswordResetEmailTemplate do
  @moduledoc false

  def render(email, code, opts \\ []) do
    locale = Keyword.get(opts, :locale, :en)
    copy = copy_for(locale)
    reset_url = reset_url(email, code, locale)

    %{
      subject: copy.subject,
      text: text_body(copy, code, reset_url),
      html: html_body(copy, code, reset_url)
    }
  end

  defp reset_url(email, code, locale) do
    endpoint_url =
      Application.fetch_env!(:adventure_time_api, AdventureTimeApiWeb.Endpoint)
      |> Keyword.fetch!(:url)

    query =
      URI.encode_query(%{
        email: email,
        code: code,
        locale: Atom.to_string(locale)
      })

    %URI{
      scheme: Keyword.get(endpoint_url, :scheme, "https"),
      host: Keyword.fetch!(endpoint_url, :host),
      port: endpoint_url[:port],
      path: "/password/reset",
      query: query
    }
    |> URI.to_string()
  end

  defp text_body(copy, code, reset_url) do
    [
      "Adventure Time TCG",
      "",
      copy.intro,
      "",
      "#{copy.code_label}: #{code}",
      "#{copy.expiry_prefix} #{copy.expiry_value}.",
      "",
      copy.copy_hint,
      "",
      "#{copy.browser_cta}: #{reset_url}",
      "",
      copy.ignore_hint
    ]
    |> Enum.join("\n")
  end

  defp html_body(copy, code, reset_url) do
    """
    <!doctype html>
    <html lang="#{copy.lang}" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>#{copy.subject}</title>
        <style>
          :root {
            color-scheme: light dark;
            supported-color-schemes: light dark;
          }

          body,
          table,
          td,
          div,
          p,
          a,
          span {
            font-family: Nunito, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
          }

          .app-shell {
            background-color: #fff0f5 !important;
          }

          .app-card {
            background-color: #fffafc !important;
            border-color: #f6d3e3 !important;
          }

          .app-header {
            background-color: #ff9ec4 !important;
            color: #4a3728 !important;
          }

          .app-title,
          .app-copy,
          .app-meta,
          .app-footnote {
            color: #4a3728 !important;
          }

          .code-box {
            background-color: #fff3c0 !important;
            border-color: #e75a97 !important;
          }

          .code-text {
            color: #2f2333 !important;
          }

          .cta-link {
            display: block;
            width: 100%;
            padding: 14px 20px;
            color: #fff9fc !important;
            font-weight: 800;
            text-decoration: none;
            text-align: center;
            box-sizing: border-box;
          }

          .cta-cell {
            background: linear-gradient(135deg, #be185d, #f472b6);
            border-radius: 999px;
          }

          @media (prefers-color-scheme: dark) {
            .app-shell {
              background-color: #20131b !important;
            }

            .app-card {
              background-color: #2a1a24 !important;
              border-color: #ff9ec4 !important;
            }

            .app-header {
              background-color: #ff9ec4 !important;
              color: #2f2333 !important;
            }

            .app-title,
            .app-copy,
            .app-meta,
            .app-footnote {
              color: #fff6fb !important;
            }

            .code-box {
              background-color: #ffe48a !important;
              border-color: #ff7db2 !important;
            }

            .code-text {
              color: #2f2333 !important;
            }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background-color:#fff0f5;color:#4a3728;font-family:Nunito,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="display:none;font-size:1px;color:#fff0f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">#{copy.preheader}</div>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#fff0f5" class="app-shell" style="background-color:#fff0f5;margin:0;padding:0;">
          <tr>
            <td align="center" style="padding:24px 12px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="app-card" style="max-width:560px;background-color:#fffafc;border:1px solid #f6d3e3;">
                <tr>
                  <td class="app-header" style="padding:22px 24px 8px;background-color:#ff9ec4;color:#4a3728;font-size:24px;font-weight:800;letter-spacing:.2px;">
                    <span class="app-header" style="color:#4a3728;font-size:24px;font-weight:800;">Adventure Time TCG</span>
                  </td>
                </tr>
                <tr>
                  <td class="app-title" style="padding:20px 24px 8px;font-size:18px;font-weight:700;color:#4a3728;">
                    #{copy.title}
                  </td>
                </tr>
                <tr>
                  <td class="app-copy" style="padding:0 24px 12px;font-size:15px;line-height:1.6;color:#4d3846;">
                    #{copy.intro}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 24px 8px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#fff3c0" class="code-box" style="background-color:#fff3c0;border:2px solid #e75a97;">
                      <tr>
                        <td align="center" style="padding:16px 12px;">
                          <span class="code-text" style="display:block;font-size:34px;line-height:1.15;letter-spacing:2px;font-weight:900;color:#2f2333;font-family:'Courier New',Consolas,monospace;">#{code}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 24px 4px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" class="cta-cell" style="background:linear-gradient(135deg, #be185d, #f472b6);border-radius:999px;">
                          <a href="#{reset_url}" class="cta-link">#{copy.browser_button}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="app-meta" style="padding:8px 24px 0;font-size:13px;line-height:1.6;color:#614b58;">
                    #{copy.expiry_prefix} <strong>#{copy.expiry_value}</strong>. #{copy.copy_hint}
                  </td>
                </tr>
                <tr>
                  <td class="app-footnote" style="padding:18px 24px 24px;font-size:12px;line-height:1.6;color:#6f5866;">
                    #{copy.ignore_hint}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """
  end

  defp copy_for(:fr) do
    %{
      lang: "fr",
      subject: "Reinitialise ton mot de passe Adventure Time TCG",
      preheader: "Utilise ce code pour choisir un nouveau mot de passe.",
      title: "Reinitialise ton mot de passe",
      intro: "Utilise ce code pour choisir un nouveau mot de passe.",
      code_label: "Code de reinitialisation",
      expiry_prefix: "Expire dans",
      expiry_value: "15 minutes",
      copy_hint: "Tu peux aussi ouvrir la page de reinitialisation pour terminer plus vite.",
      browser_cta: "Page de reinitialisation",
      browser_button: "Ouvrir la reinitialisation",
      ignore_hint: "Si tu n'es pas a l'origine de cette demande, tu peux ignorer cet e-mail."
    }
  end

  defp copy_for(_locale) do
    %{
      lang: "en",
      subject: "Reset your Adventure Time TCG password",
      preheader: "Use this code to choose a new password.",
      title: "Reset your password",
      intro: "Use this code to choose a new password.",
      code_label: "Reset code",
      expiry_prefix: "Expires in",
      expiry_value: "15 minutes",
      copy_hint: "You can also open the reset page to finish more smoothly.",
      browser_cta: "Reset page",
      browser_button: "Open reset page",
      ignore_hint: "If you didn't request this, you can safely ignore this email."
    }
  end
end
