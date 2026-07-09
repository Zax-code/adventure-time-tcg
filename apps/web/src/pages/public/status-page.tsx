import { useQuery } from "@tanstack/react-query";

import { webJsonRequest } from "../../lib/api";

type ProbePayload = {
  service: string;
  status: "ok" | "ready" | "not_ready";
};

type StatusLevel = "operational" | "degraded" | "unavailable";

type ServiceCheck = {
  description: string;
  detail: string;
  label: string;
  level: StatusLevel;
};

type PublicStatus = {
  checks: ServiceCheck[];
  checkedAt: Date;
  level: StatusLevel;
};

const checkedAtFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

function parseProbe(data: unknown): ProbePayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The status probe returned an invalid response.");
  }

  const record = data as Record<string, unknown>;
  if (
    typeof record.service !== "string" ||
    (record.status !== "ok" &&
      record.status !== "ready" &&
      record.status !== "not_ready")
  ) {
    throw new Error("The status probe returned an invalid response.");
  }

  return {
    service: record.service,
    status: record.status,
  };
}

async function timedProbe(path: "/health" | "/ready") {
  const startedAt = performance.now();
  const payload = await webJsonRequest(
    path,
    { method: "GET" },
    parseProbe,
  );

  return {
    latency: Math.max(0, Math.round(performance.now() - startedAt)),
    payload,
  };
}

async function fetchPublicStatus(): Promise<PublicStatus> {
  const [health, readiness] = await Promise.allSettled([
    timedProbe("/health"),
    timedProbe("/ready"),
  ]);
  const healthUp =
    health.status === "fulfilled" && health.value.payload.status === "ok";
  const ready =
    readiness.status === "fulfilled" &&
    readiness.value.payload.status === "ready";
  const checks: ServiceCheck[] = [
    {
      label: "Front door",
      description: "Players can reach the game",
      level: health.status === "fulfilled" ? "operational" : "unavailable",
      detail:
        health.status === "fulfilled"
          ? `Response ${health.value.latency}ms`
          : "Could not connect",
    },
    {
      label: "Game services",
      description: "Sign-in, packs, quests, and battles",
      level: healthUp ? "operational" : "unavailable",
      detail: healthUp ? "API responding" : "API unavailable",
    },
    {
      label: "Saved progress",
      description: "Collections and match history",
      level: ready ? "operational" : healthUp ? "degraded" : "unavailable",
      detail: ready ? "Database ready" : "Readiness check failed",
    },
  ];
  const level = checks.some((check) => check.level === "unavailable")
    ? "unavailable"
    : checks.some((check) => check.level === "degraded")
      ? "degraded"
      : "operational";

  return { checks, checkedAt: new Date(), level };
}

const statusCopy = {
  operational: {
    title: "All systems operational",
    body: "No incidents are affecting Adventure Time TCG. Your collection and ongoing matches are available.",
  },
  degraded: {
    title: "Some services are recovering",
    body: "The game is reachable, but saved progress may respond more slowly than usual.",
  },
  unavailable: {
    title: "The world is having trouble loading",
    body: "One or more game services could not be reached. Your saved progress is not lost.",
  },
} satisfies Record<StatusLevel, { title: string; body: string }>;

function formatCheckedAt(value: Date) {
  return checkedAtFormatter.format(value);
}

function levelLabel(level: StatusLevel) {
  if (level === "operational") return "Operational";
  if (level === "degraded") return "Degraded";
  return "Unavailable";
}

export function StatusPage() {
  const query = useQuery({
    queryKey: ["public", "status"],
    queryFn: fetchPublicStatus,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const current = query.data;
  const copy = current ? statusCopy[current.level] : null;

  return (
    <>
      <header className="page-header public-page-header">
        <div className="page-heading">
          <span className="eyebrow">Live service</span>
          <h1>The world is ready when you are.</h1>
          <p>A plain-language view of sign-in, gameplay, and saved progress.</p>
        </div>
        <div className="page-actions checked-time" aria-live="polite">
          {current
            ? `Checked ${formatCheckedAt(current.checkedAt)} · refreshes every 15s`
            : "Checking now…"}
        </div>
      </header>

      {query.isPending ? (
        <section className="status-hero status-checking" role="status">
          <div className="status-orb" aria-hidden="true">
            <span />
          </div>
          <div>
            <h2>Checking Adventure Time TCG</h2>
            <p>We are checking sign-in, collections, quests, and battles now.</p>
          </div>
        </section>
      ) : null}

      {current && copy ? (
        <>
          <section
            className={`status-hero status-${current.level}`}
            aria-live="polite"
          >
            <div className="status-orb" aria-hidden="true">
              <span />
            </div>
            <div>
              <h2>{copy.title}</h2>
              <p>{copy.body}</p>
            </div>
          </section>

          <section className="status-list" aria-label="Game service status">
            {current.checks.map((check) => (
              <article className={`status-row status-${check.level}`} key={check.label}>
                <span className="status-dot" aria-hidden="true" />
                <div>
                  <h3>{check.label}</h3>
                  <p>{check.description}</p>
                </div>
                <strong>{levelLabel(check.level)}</strong>
                <small>{check.detail}</small>
              </article>
            ))}
          </section>
        </>
      ) : null}

      <section className="support-strip">
        <div>
          <span className="eyebrow">Something still feel wrong?</span>
          <h2>Your progress is safe.</h2>
          <p>
            Try reopening the game or checking your connection. If it persists,
            include what you were trying to do when you contact support.
          </p>
        </div>
        <a className="button button-secondary" href="mailto:support@leaetzak.love">
          Contact support
        </a>
      </section>
    </>
  );
}
