defmodule AdventureTimeApi.Accounts.VerificationEmailTemplate do
  @moduledoc false

  def render(code) do
    subject = "Confirm your Adventure Time TCG account"
    preheader = "Use this verification code to finish creating your account."
    title = "Confirm your account"
    intro = "Use this verification code to finish creating your account."
    expiry_prefix = "Expires in"
    expiry_value = "15 minutes"
    copy_hint = "Tap and hold, then copy all 6 digits at once."
    ignore_hint = "If you didn't request this, you can safely ignore this email."

    %{
      subject: subject,
      text: text_body(code),
      html:
        html_body(
          subject,
          preheader,
          title,
          intro,
          expiry_prefix,
          expiry_value,
          copy_hint,
          ignore_hint,
          code
        )
    }
  end

  defp text_body(code) do
    [
      "Adventure Time TCG",
      "",
      "Use this verification code to finish creating your account.",
      "",
      "Verification code: #{code}",
      "Expires in 15 minutes.",
      "",
      "Tip: copy all 6 digits and paste them in the verify form."
    ]
    |> Enum.join("\n")
  end

  defp html_body(
         subject,
         preheader,
         title,
         intro,
         expiry_prefix,
         expiry_value,
         copy_hint,
         ignore_hint,
         code
       ) do
    """
    <!doctype html>
    <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <title>#{subject}</title>
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
        <div style="display:none;font-size:1px;color:#fff0f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">#{preheader}</div>
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
                    #{title}
                  </td>
                </tr>
                <tr>
                  <td class="app-copy" style="padding:0 24px 12px;font-size:15px;line-height:1.6;color:#4d3846;">
                    #{intro}
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
                  <td class="app-meta" style="padding:8px 24px 0;font-size:13px;line-height:1.6;color:#614b58;">
                    #{expiry_prefix} <strong>#{expiry_value}</strong>. #{copy_hint}
                  </td>
                </tr>
                <tr>
                  <td class="app-footnote" style="padding:18px 24px 24px;font-size:12px;line-height:1.6;color:#6f5866;">
                    #{ignore_hint}
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
end
