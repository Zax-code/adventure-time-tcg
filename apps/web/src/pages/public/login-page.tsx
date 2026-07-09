import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button, Field, FormStatus } from "../../components/ui";
import { useAuth } from "../../auth/auth-provider";
import { getErrorMessage } from "../../lib/api";

type LoginLocationState = {
  from?: string;
};

function safeDestination(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/home";
}

export function LoginPage() {
  const { login, restoreError, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);

    if (status === "restoring") {
      return;
    }

    if (password.length < 8) {
      setMessage("Your password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      await login({ email: email.trim(), password });
      const state = location.state as LoginLocationState | null;
      navigate(safeDestination(state?.from), { replace: true });
    } catch (error) {
      setMessage(getErrorMessage(error, "We could not sign you in."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-layout">
      <aside className="auth-story" aria-label="A small Adventure Time TCG story">
        <div className="auth-story-scene" aria-hidden="true">
          <span className="story-orb" />
          <span className="story-hill story-hill-back" />
          <span className="story-hill story-hill-front" />
          <span className="story-path" />
        </div>
        <div className="auth-story-copy">
          <span className="eyebrow">A small adventure every day</span>
          <h2>Quest. Collect. Shape. Battle.</h2>
          <p>No ladder. No pressure. Just a growing deck and people you know.</p>
        </div>
      </aside>

      <div className="auth-panel">
        <Link className="auth-back" to="/">
          <span aria-hidden="true">←</span> Back to overview
        </Link>
        <span className="eyebrow">Player sign-in</span>
        <h1>Welcome back, adventurer.</h1>
        <p>
          Your cards, daily rhythm, and ongoing battles are right where you left
          them.
        </p>

        <FormStatus message={message ?? restoreError ?? undefined} />

        <form
          aria-label="Sign in"
          className="auth-form"
          onSubmit={handleSubmit}
        >
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
          <Field label="Password">
            <input
              autoComplete="current-password"
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              type="password"
              value={password}
            />
          </Field>
          <Link className="text-link auth-forgot" to="/password/reset">
            Forgot password?
          </Link>
          <Button
            busy={busy || status === "restoring"}
            className="wide"
            type="submit"
          >
            Sign in
          </Button>
        </form>

        <p className="auth-provider-note">
          Google and Apple sign-in remain available in the mobile app.
        </p>
        <p className="auth-switch">
          New to the game? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </section>
  );
}
