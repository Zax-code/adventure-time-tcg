import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { Button, Field, FormStatus } from "../../components/ui";
import { getErrorMessage, webApiClient } from "../../lib/api";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function EmailVerifyPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [code, setCode] = useState(() => digitsOnly(searchParams.get("code") ?? ""));
  const verify = useMutation({
    mutationFn: () =>
      webApiClient.verifyEmail({ email: email.trim(), code }),
  });
  const resend = useMutation({
    mutationFn: () => webApiClient.resendVerification({ email: email.trim() }),
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    verify.reset();
    resend.reset();
    await verify.mutateAsync().catch(() => undefined);
  }

  if (verify.data) {
    const ready = verify.data.authorized && !verify.data.accessRequestPending;
    return (
      <section className="link-card auth-result-card">
        <div className="link-card-copy">
          <span className="eyebrow">Email confirmed</span>
          <h1>{ready ? "Your account is ready." : "Approval is next."}</h1>
          <p>{verify.data.message}</p>
          {!ready ? (
            <div className="notice notice-info" role="status">
              <strong>You do not need to verify again.</strong>
              <p>A super admin will review the access request before your first sign-in.</p>
            </div>
          ) : null}
          <div className="button-row">
            <Link className="button button-primary" to="/login">
              {ready ? "Sign in" : "Return to sign in"}
            </Link>
            <Link className="button button-ghost" to="/">
              App overview
            </Link>
          </div>
        </div>
        <div className="link-card-art" aria-hidden="true">
          <span className="result-check">✓</span>
          <strong>One small step</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="link-card">
      <div className="link-card-copy">
        <span className="eyebrow">Email verification</span>
        <h1>Confirm this email.</h1>
        <p>
          Enter the six-digit code from your message. The same code also works
          in the mobile app.
        </p>

        <FormStatus
          message={
            verify.error
              ? getErrorMessage(verify.error, "That code could not be confirmed.")
              : resend.error
                ? getErrorMessage(resend.error, "We could not send another code.")
                : resend.data?.message
          }
          success={Boolean(resend.data) && !verify.error && !resend.error}
        />

        <form
          aria-label="Confirm email"
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <Field label="Email">
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
              type="email"
              value={email}
            />
          </Field>
          <Field hint="Six digits" label="Verification code">
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              name="code"
              onChange={(event) => setCode(digitsOnly(event.currentTarget.value))}
              pattern="[0-9]{6}"
              required
              value={code}
            />
          </Field>
          <Button
            busy={verify.isPending}
            className="wide"
            disabled={code.length !== 6}
            type="submit"
          >
            Confirm email
          </Button>
          <Button
            busy={resend.isPending}
            className="wide"
            disabled={!email.trim()}
            onClick={() => {
              resend.reset();
              void resend.mutateAsync().catch(() => undefined);
            }}
            tone="ghost"
          >
            Send a fresh code
          </Button>
        </form>
      </div>
      <div className="link-card-art" aria-hidden="true">
        <span className="story-orb" />
        <strong>A tiny key</strong>
      </div>
    </section>
  );
}
