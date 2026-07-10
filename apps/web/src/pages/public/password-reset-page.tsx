import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { Button, Field, FormStatus } from "../../components/ui";
import { getErrorMessage, webApiClient } from "../../lib/api";

function resetCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const initialCode = resetCode(searchParams.get("code") ?? "");
  const [mode, setMode] = useState<"request" | "reset">(
    initialCode ? "reset" : "request",
  );
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string>();
  const requestReset = useMutation({
    mutationFn: () => webApiClient.requestPasswordReset({ email: email.trim() }),
    onSuccess: (data) => {
      if (data.devCode) setCode(data.devCode);
    },
  });
  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      webApiClient.resetPassword({
        email: email.trim(),
        code,
        password,
      }),
  });

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(undefined);
    requestReset.reset();
    await requestReset.mutateAsync().catch(() => undefined);
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(undefined);
    resetPasswordMutation.reset();

    if (password.length < 8) {
      setLocalError("Your new password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("The two passwords do not match.");
      return;
    }

    await resetPasswordMutation.mutateAsync().catch(() => undefined);
  }

  if (resetPasswordMutation.data) {
    return (
      <section className="link-card auth-result-card">
        <div className="link-card-copy">
          <span className="eyebrow">Password updated</span>
          <h1>Your new password is ready.</h1>
          <p>{resetPasswordMutation.data.message}</p>
          <p>Every previous session for this account has been signed out.</p>
          <div className="button-row">
            <Link className="button button-primary" to="/login">
              Sign in
            </Link>
            <Link className="button button-ghost" to="/">
              App overview
            </Link>
          </div>
        </div>
        <div className="link-card-art" aria-hidden="true">
          <span className="result-check">✓</span>
          <strong>A fresh key</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="link-card">
      <div className="link-card-copy">
        <span className="eyebrow">Password reset</span>
        <h1>{mode === "request" ? "Find your reset link." : "Choose a new password."}</h1>
        <p>
          {mode === "request"
            ? "Enter the account email and we will send a short-lived reset code."
            : "Updating your password signs out every existing session for this account."}
        </p>

        <FormStatus
          message={
            localError ??
            (requestReset.error
              ? getErrorMessage(requestReset.error, "We could not send a reset code.")
              : resetPasswordMutation.error
                ? getErrorMessage(
                    resetPasswordMutation.error,
                    "We could not update your password.",
                  )
                : requestReset.data?.message)
          }
          success={
            Boolean(requestReset.data) &&
            !localError &&
            !requestReset.error &&
            !resetPasswordMutation.error
          }
        />

        {mode === "request" ? (
          <form
            aria-label="Request password reset"
            className="auth-form"
            onSubmit={handleRequest}
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
            <Button busy={requestReset.isPending} className="wide" type="submit">
              Send reset code
            </Button>
            <Button
              className="wide"
              onClick={() => setMode("reset")}
              tone="ghost"
            >
              I already have a code
            </Button>
          </form>
        ) : (
          <form
            aria-label="Set new password"
            className="auth-form"
            onSubmit={handleReset}
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
            <Field hint="Six digits" label="Reset code">
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                name="code"
                onChange={(event) => setCode(resetCode(event.currentTarget.value))}
                pattern="[0-9]{6}"
                required
                value={code}
              />
            </Field>
            <Field hint="At least 8 characters" label="New password">
              <input
                autoComplete="new-password"
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.currentTarget.value)}
                required
                type="password"
                value={password}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                autoComplete="new-password"
                minLength={8}
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </Field>
            <Button
              busy={resetPasswordMutation.isPending}
              className="wide"
              disabled={code.length !== 6}
              type="submit"
            >
              Update password
            </Button>
            <Button className="wide" onClick={() => setMode("request")} tone="ghost">
              Request another code
            </Button>
          </form>
        )}
      </div>
      <div className="link-card-art" aria-hidden="true">
        <span className="story-orb" />
        <strong>A fresh key</strong>
      </div>
    </section>
  );
}
