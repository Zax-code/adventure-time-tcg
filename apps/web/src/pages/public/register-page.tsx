import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import type { RegisterResponse } from "@adventure-time/api-client";

import { Button, Field, FormStatus } from "../../components/ui";
import { getErrorMessage, webApiClient } from "../../lib/api";

export function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "fr">("en");
  const [result, setResult] = useState<RegisterResponse>();
  const register = useMutation({
    mutationFn: () =>
      webApiClient.register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        preferredLanguage,
      }),
    onSuccess: setResult,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(undefined);
    register.reset();
    await register.mutateAsync().catch(() => undefined);
  }

  if (result) {
    const verifySearch = new URLSearchParams({ email: email.trim() });
    if (result.devCode) verifySearch.set("code", result.devCode);

    return (
      <section className="link-card auth-result-card">
        <div className="link-card-copy">
          <span className="eyebrow">Check your inbox</span>
          <h1>Your collection has a beginning.</h1>
          <p>{result.message}</p>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{email.trim()}</dd>
            </div>
            <div>
              <dt>Next step</dt>
              <dd>Confirm your six-digit code</dd>
            </div>
          </dl>
          <div className="button-row">
            <Link
              className="button button-primary"
              to={`/email/verify?${verifySearch.toString()}`}
            >
              Confirm email
            </Link>
            <Link className="button button-ghost" to="/login">
              Return to sign in
            </Link>
          </div>
        </div>
        <div className="link-card-art" aria-hidden="true">
          <span className="story-orb" />
          <strong>One small step</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-layout">
      <aside className="auth-story" aria-label="Begin a card collection">
        <div className="auth-story-scene" aria-hidden="true">
          <span className="story-orb" />
          <span className="story-hill story-hill-back" />
          <span className="story-hill story-hill-front" />
          <span className="story-path" />
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow">A small adventure every day</span>
          <h2>Open a pack. Find a favorite.</h2>
          <p>Your account keeps every card, quest, gift, and friendly battle together.</p>
        </div>
      </aside>

      <div className="auth-panel">
        <Link className="auth-back" to="/">
          <span aria-hidden="true">←</span> Back to overview
        </Link>
        <span className="eyebrow">New player</span>
        <h1>Begin your collection.</h1>
        <p>Create your account, then confirm your email while access is reviewed.</p>

        <FormStatus
          message={
            register.error
              ? getErrorMessage(register.error, "We could not create your account.")
              : undefined
          }
        />

        <form
          aria-label="Create account"
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <Field hint="Required · 1–64 characters" label="Display name">
            <input
              autoComplete="nickname"
              maxLength={64}
              name="displayName"
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              placeholder="How other players see you"
              required
              value={displayName}
            />
          </Field>
          <Field label="Email">
            <input
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.currentTarget.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </Field>
          <Field hint="At least 8 characters" label="Password">
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
          <Field label="Language">
            <select
              name="preferredLanguage"
              onChange={(event) =>
                setPreferredLanguage(event.currentTarget.value as "en" | "fr")
              }
              value={preferredLanguage}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </Field>
          <Button busy={register.isPending} className="wide" type="submit">
            Create account
          </Button>
        </form>

        <p className="auth-switch">
          Already collecting? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </section>
  );
}
