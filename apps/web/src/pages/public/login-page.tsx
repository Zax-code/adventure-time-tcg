import { type FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { AppleLogoIcon, GoogleLogoIcon } from "../../components/icons";
import { Button, Field, FormStatus } from "../../components/ui";
import { useAuth } from "../../auth/auth-provider";
import {
  requestAppleIdentity,
  requestGoogleAccessToken,
} from "../../auth/provider-auth";
import { getWebAuthConfig } from "../../auth/session";
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
  const {
    login,
    loginWithApple,
    loginWithGoogle,
    restoreError,
    status,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const authConfig = useQuery({
    queryKey: ["web-auth-config"],
    queryFn: getWebAuthConfig,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState<"apple" | "google">();
  const [message, setMessage] = useState<string>();

  function continueToDestination() {
    const state = location.state as LoginLocationState | null;
    navigate(safeDestination(state?.from), { replace: true });
  }

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
      continueToDestination();
    } catch (error) {
      setMessage(getErrorMessage(error, "We could not sign you in."));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    const clientId = authConfig.data?.googleClientId;
    if (!clientId || providerBusy) {
      return;
    }

    setMessage(undefined);
    setProviderBusy("google");
    try {
      const accessToken = await requestGoogleAccessToken(clientId);
      await loginWithGoogle({
        accessToken,
        preferredLanguage: navigator.language.toLowerCase().startsWith("fr")
          ? "fr"
          : "en",
      });
      continueToDestination();
    } catch (error) {
      setMessage(getErrorMessage(error, "We could not sign you in with Google."));
    } finally {
      setProviderBusy(undefined);
    }
  }

  async function handleAppleSignIn() {
    const apple = authConfig.data?.apple;
    if (!apple || providerBusy) {
      return;
    }

    setMessage(undefined);
    setProviderBusy("apple");
    try {
      const identity = await requestAppleIdentity(apple);
      await loginWithApple({
        ...identity,
        preferredLanguage: navigator.language.toLowerCase().startsWith("fr")
          ? "fr"
          : "en",
      });
      continueToDestination();
    } catch (error) {
      setMessage(getErrorMessage(error, "We could not sign you in with Apple."));
    } finally {
      setProviderBusy(undefined);
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

        {authConfig.data?.googleClientId || authConfig.data?.apple ? (
          <section className="auth-provider-section" aria-label="Provider sign-in">
            <div className="auth-divider"><span>or continue with</span></div>
            <div className="auth-provider-buttons">
              {authConfig.data.googleClientId ? (
                <Button
                  aria-label="Continue with Google"
                  busy={providerBusy === "google"}
                  className="wide auth-provider-button"
                  disabled={busy || Boolean(providerBusy)}
                  onClick={() => void handleGoogleSignIn()}
                  tone="ghost"
                >
                  <GoogleLogoIcon /> Continue with Google
                </Button>
              ) : null}
              {authConfig.data.apple ? (
                <Button
                  aria-label="Continue with Apple"
                  busy={providerBusy === "apple"}
                  className="wide auth-provider-button auth-provider-apple"
                  disabled={busy || Boolean(providerBusy)}
                  onClick={() => void handleAppleSignIn()}
                  tone="ghost"
                >
                  <AppleLogoIcon /> Continue with Apple
                </Button>
              ) : null}
            </div>
          </section>
        ) : (
          <p className="auth-provider-note">
            {authConfig.isError
              ? "Provider sign-in is temporarily unavailable."
              : authConfig.isPending
                ? "Checking available sign-in methods…"
                : "Apple sign-in remains available in the mobile app."}
          </p>
        )}
        <p className="auth-switch">
          New to the game? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </section>
  );
}
