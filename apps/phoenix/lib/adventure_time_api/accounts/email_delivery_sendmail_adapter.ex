defmodule AdventureTimeApi.Accounts.EmailDelivery.SendmailAdapter do
  @moduledoc false

  @behaviour AdventureTimeApi.Accounts.EmailDelivery

  def render_verification_message(email, code, opts \\ []) do
    email_content = AdventureTimeApi.Accounts.VerificationEmailTemplate.render(email, code, opts)
    build_message(default_from(), email, email_content)
  end

  def render_password_reset_message(email, code, opts \\ []) do
    email_content = AdventureTimeApi.Accounts.PasswordResetEmailTemplate.render(email, code, opts)
    build_message(default_from(), email, email_content)
  end

  def send_verification_code(email, code, opts \\ []) do
    email_content = AdventureTimeApi.Accounts.VerificationEmailTemplate.render(email, code, opts)
    deliver_message(email, email_content)
  end

  def send_password_reset_code(email, code, opts \\ []) do
    email_content = AdventureTimeApi.Accounts.PasswordResetEmailTemplate.render(email, code, opts)
    deliver_message(email, email_content)
  end

  defp deliver_message(email, email_content) do
    from =
      default_from()

    sendmail_path = System.get_env("AUTH_EMAIL_SENDMAIL_PATH") || "/usr/bin/sendmail"
    envelope_from = envelope_sender(from)
    body = build_message(from, email, email_content)
    temp_path = write_temp_message!(body)

    try do
      command =
        "#{shell_escape(sendmail_path)} -t -i -f #{shell_escape(envelope_from)} < #{shell_escape(temp_path)}"

      case System.shell(command, stderr_to_stdout: true) do
        {_output, 0} -> :ok
        {output, _status} -> {:error, sendmail_error(output)}
      end
    after
      File.rm(temp_path)
    end
  rescue
    error -> {:error, Exception.message(error)}
  end

  defp default_from do
    System.get_env("AUTH_EMAIL_FROM") || "Adventure Time TCG <no-reply@leaetzak.love>"
  end

  defp build_message(from, email, %{subject: subject, text: text, html: html}) do
    boundary = "adventure-time-boundary-#{System.unique_integer([:positive])}"
    date_header = Calendar.strftime(DateTime.utc_now(), "%a, %d %b %Y %H:%M:%S +0000")

    message_id =
      "<#{System.unique_integer([:positive])}.#{System.system_time(:microsecond)}@leaetzak.love>"

    [
      "From: ",
      from,
      "\r\n",
      "To: ",
      email,
      "\r\n",
      "Subject: ",
      subject,
      "\r\n",
      "Date: ",
      date_header,
      "\r\n",
      "Message-ID: ",
      message_id,
      "\r\n",
      "MIME-Version: 1.0\r\n",
      "Content-Type: multipart/alternative; boundary=\"",
      boundary,
      "\"\r\n",
      "\r\n",
      "--",
      boundary,
      "\r\n",
      "Content-Type: text/plain; charset=UTF-8\r\n",
      "Content-Transfer-Encoding: 7bit\r\n",
      "\r\n",
      normalize_body(text),
      "\r\n",
      "\r\n--",
      boundary,
      "\r\n",
      "Content-Type: text/html; charset=UTF-8\r\n",
      "Content-Transfer-Encoding: 7bit\r\n",
      "\r\n",
      normalize_body(html),
      "\r\n",
      "\r\n--",
      boundary,
      "--\r\n"
    ]
    |> IO.iodata_to_binary()
  end

  defp normalize_body(body) do
    body
    |> String.replace("\r\n", "\n")
    |> String.replace("\r", "\n")
    |> String.replace("\n", "\r\n")
  end

  defp sendmail_error(""), do: "Failed to send verification email."
  defp sendmail_error(output), do: String.trim(output)

  defp write_temp_message!(body) do
    path =
      Path.join(
        System.tmp_dir!(),
        "adventure-time-verification-#{System.unique_integer([:positive])}.eml"
      )

    File.write!(path, body)
    path
  end

  defp envelope_sender(from) do
    case Regex.run(~r/<([^>]+)>/, from) do
      [_, email] -> email
      _ -> from
    end
  end

  defp shell_escape(path) do
    path
    |> String.replace("'", "'\\''")
    |> then(&"'#{&1}'")
  end
end
