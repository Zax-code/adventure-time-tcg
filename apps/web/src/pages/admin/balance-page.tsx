import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AdminCardsResponse } from "@adventure-time/api-client";

import { BarChartIcon } from "../../components/icons";
import { Button, EmptyState, Notice } from "../../components/ui";
import { webApiClient } from "../../lib/api";
import { AdminDataState, AdminMetric, AdminPageHeader, AdminSection } from "./admin-common";
import { ADMIN_QUERY_KEYS } from "./admin-data";
import {
  buildBalanceRun,
  DEFAULT_BALANCE_WEIGHTS,
  downloadBalanceRun,
  loadBalanceHistory,
  saveBalanceHistory,
  type BalanceGroup,
  type BalanceRun,
  type BalanceScope,
  type BalanceWeights,
} from "./balance-report";
import "./balance-page.css";

type AdminCard = AdminCardsResponse["cards"][number];
type WeightName = keyof BalanceWeights;

const weightFields: Array<{
  key: WeightName;
  label: string;
  hint: string;
}> = [
  { key: "hp", label: "HP weight", hint: "Durability pool" },
  { key: "attack", label: "Attack weight", hint: "Direct pressure" },
  { key: "defense", label: "Defense weight", hint: "Damage mitigation" },
  { key: "speed", label: "Speed weight", hint: "Turn priority" },
];

const runDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatRunDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : runDateFormatter.format(date);
}

function scoreTone(score: number) {
  if (score >= 75) return "success" as const;
  if (score >= 50) return "info" as const;
  return "danger" as const;
}

function scoreLabel(score: number) {
  if (score >= 75) return "Compact";
  if (score >= 50) return "Review";
  return "Wide spread";
}

function BalanceControls({
  catalogCards,
  disabled,
  onGenerate,
}: {
  catalogCards: AdminCard[];
  disabled: boolean;
  onGenerate: (scope: BalanceScope, weights: BalanceWeights) => void;
}) {
  const [scope, setScope] = useState<BalanceScope>("active");
  const [weights, setWeights] = useState<BalanceWeights>({
    ...DEFAULT_BALANCE_WEIGHTS,
  });
  const eligibleCards =
    scope === "active"
      ? catalogCards.filter((card) => !card.isArchived).length
      : catalogCards.length;
  const hasPositiveWeight = Object.values(weights).some((weight) => weight > 0);

  function updateWeight(name: WeightName, value: string) {
    const parsed = Number(value);
    setWeights((current) => ({
      ...current,
      [name]: Number.isFinite(parsed) ? Math.min(10, Math.max(0, parsed)) : 0,
    }));
  }

  return (
    <AdminSection
      action={
        <Button
          disabled={disabled || eligibleCards === 0 || !hasPositiveWeight}
          onClick={() => onGenerate(scope, weights)}
        >
          Generate analysis
        </Button>
      }
      description="Tune a transparent weighted-stat lens, then snapshot the current Phoenix catalog."
      title="Analysis controls"
    >
      <div className="balance-control-grid">
        <label className="balance-scope-field">
          <span>Catalog scope</span>
          <select
            disabled={disabled}
            onChange={(event) =>
              setScope(event.currentTarget.value as BalanceScope)
            }
            value={scope}
          >
            <option value="active">Active cards only</option>
            <option value="all">Active and archived</option>
          </select>
          <small>{eligibleCards} cards will be analyzed</small>
        </label>
        <div className="balance-weight-grid" aria-label="Weighted score settings">
          {weightFields.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <input
                disabled={disabled}
                max="10"
                min="0"
                onChange={(event) =>
                  updateWeight(field.key, event.currentTarget.value)
                }
                step="0.05"
                type="number"
                value={weights[field.key]}
              />
              <small>{field.hint}</small>
            </label>
          ))}
        </div>
      </div>
      <Notice title="What this report can—and cannot—say" tone="warning">
        {hasPositiveWeight ? (
          <p>
            The score is <b>HP × {weights.hp} + attack × {weights.attack} + defense × {weights.defense} + speed × {weights.speed}</b>.
            It compares real catalog stats, but it does not simulate matches, inspect
            abilities or type matchups, or predict win rates.
          </p>
        ) : (
          <p><b>Set at least one positive weight</b> to generate a meaningful score.</p>
        )}
      </Notice>
    </AdminSection>
  );
}

function BalanceBreakdownTable({
  groups,
  label,
}: {
  groups: BalanceGroup[];
  label: string;
}) {
  return (
    <div className="balance-table-wrap">
      <table className="balance-table">
        <caption className="sr-only">{label} weighted score breakdown</caption>
        <thead>
          <tr>
            <th scope="col">{label}</th>
            <th scope="col">Cards</th>
            <th scope="col">Average</th>
            <th scope="col">Range</th>
            <th scope="col">Dispersion</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.label}>
              <th scope="row">{group.label}</th>
              <td>{group.count}</td>
              <td>{group.averageScore.toFixed(1)}</td>
              <td>{group.minimumScore.toFixed(1)}–{group.maximumScore.toFixed(1)}</td>
              <td>{group.dispersionPercent.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceRunHistory({
  history,
  onClear,
  onRemove,
  onSelect,
  selectedId,
}: {
  history: BalanceRun[];
  onClear: () => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  selectedId?: string;
}) {
  return (
    <AdminSection
      action={
        history.length ? (
          <Button onClick={onClear} tone="ghost">Clear history</Button>
        ) : undefined
      }
      description="Up to ten versioned snapshots are retained in this browser only."
      title="Run history"
    >
      {history.length ? (
        <div className="balance-history-list">
          {history.map((run, index) => (
            <article className={run.id === selectedId ? "selected" : ""} key={run.id}>
              <button
                aria-pressed={run.id === selectedId}
                className="balance-history-select"
                onClick={() => onSelect(run.id)}
                type="button"
              >
                <span>{index === 0 ? "Latest run" : `Run ${history.length - index}`}</span>
                <b>{formatRunDate(run.generatedAt)}</b>
                <small>{run.summary.cardsAnalyzed} cards · {run.catalogFingerprint}</small>
              </button>
              <button
                aria-label={`Remove balance run from ${formatRunDate(run.generatedAt)}`}
                className="balance-history-remove"
                onClick={() => onRemove(run.id)}
                type="button"
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="balance-muted-copy">
          Generate an analysis to create the first local snapshot.
        </p>
      )}
    </AdminSection>
  );
}

function BalanceReportPreview({ run }: { run: BalanceRun }) {
  return (
    <div className="balance-report-preview">
      <section className="admin-metrics" aria-label="Balance report summary">
        <AdminMetric
          label="Catalog signal"
          note={scoreLabel(run.summary.healthScore)}
          tone={scoreTone(run.summary.healthScore)}
          value={`${run.summary.healthScore.toFixed(0)}/100`}
        />
        <AdminMetric
          label="Within-rarity spread"
          note="Weighted coefficient of variation"
          tone="secondary"
          value={`${run.summary.withinRarityDispersion.toFixed(1)}%`}
        />
        <AdminMetric
          label="Type gap"
          note="High-to-low average score range"
          tone="info"
          value={`${run.summary.typeGap.toFixed(1)}%`}
        />
        <AdminMetric
          label="Review signals"
          note="Outside the 1.5σ comparison band"
          tone={run.summary.outlierCount ? "danger" : "success"}
          value={run.summary.outlierCount}
        />
      </section>

      <AdminSection
        action={
          <div className="balance-download-actions">
            <Button onClick={() => downloadBalanceRun(run, "json")} tone="secondary">
              Download JSON
            </Button>
            <Button onClick={() => downloadBalanceRun(run, "csv")} tone="secondary">
              Download CSV
            </Button>
          </div>
        }
        description={`${run.source} · ${run.scope === "active" ? "Active cards" : "Active and archived"} · ${formatRunDate(run.generatedAt)}`}
        title="Generated report"
      >
        <Notice title="Interpret this as a catalog screen, not a combat verdict" tone="info">
          <p>{run.limitation}</p>
        </Notice>
        <div className="balance-report-grid">
          <BalanceBreakdownTable groups={run.rarityBreakdown} label="Rarity" />
          <BalanceBreakdownTable groups={run.typeBreakdown} label="Type" />
        </div>
      </AdminSection>

      <div className="balance-insight-grid">
        <AdminSection
          description="Cards whose weighted score is at least 1.5 standard deviations from their rarity peers. Small rarity pools fall back to the full catalog."
          title="Cards to inspect"
        >
          {run.outliers.length ? (
            <div className="balance-outlier-list">
              {run.outliers.map((card) => (
                <article key={card.id}>
                  <span className={`balance-signal balance-signal-${card.signal}`}>
                    {card.signal === "high" ? "High" : "Low"}
                  </span>
                  <div>
                    <h3>{card.name}</h3>
                    <p>{card.rarity} · {card.type}</p>
                  </div>
                  <dl>
                    <div><dt>Score</dt><dd>{card.powerScore.toFixed(1)}</dd></div>
                    <div><dt>Peer delta</dt><dd>{card.rarityDeltaPercent > 0 ? "+" : ""}{card.rarityDeltaPercent.toFixed(1)}%</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p className="balance-muted-copy">
              No card crosses the current comparison threshold.
            </p>
          )}
        </AdminSection>
        <AdminSection
          description="Investigation prompts derived from this run, never automatic tuning instructions."
          title="Next checks"
        >
          <ol className="balance-recommendations">
            {run.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ol>
          <dl className="balance-run-facts">
            <div><dt>Catalog version</dt><dd>{run.catalogFingerprint}</dd></div>
            <div><dt>Report schema</dt><dd>v{run.schemaVersion}</dd></div>
            <div><dt>Rarity progression</dt><dd>{run.summary.rarityProgression.toFixed(1)}%</dd></div>
          </dl>
        </AdminSection>
      </div>

      <AdminSection
        description="Every source stat and computed score included in the downloadable report."
        title="Card score ledger"
      >
        <div className="balance-table-wrap">
          <table className="balance-table balance-card-ledger">
            <thead>
              <tr>
                <th scope="col">Card</th>
                <th scope="col">Rarity</th>
                <th scope="col">Type</th>
                <th scope="col">HP</th>
                <th scope="col">ATK</th>
                <th scope="col">DEF</th>
                <th scope="col">SPD</th>
                <th scope="col">Score</th>
                <th scope="col">Peer delta</th>
              </tr>
            </thead>
            <tbody>
              {run.cards.map((card) => (
                <tr key={card.id}>
                  <th scope="row"><b>{card.name}</b><small>{card.character}</small></th>
                  <td>{card.rarity}</td>
                  <td>{card.type}</td>
                  <td>{card.hp}</td>
                  <td>{card.attack}</td>
                  <td>{card.defense}</td>
                  <td>{card.speed}</td>
                  <td>{card.powerScore.toFixed(1)}</td>
                  <td>{card.rarityDeltaPercent > 0 ? "+" : ""}{card.rarityDeltaPercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </div>
  );
}

export function AdminBalancePage() {
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.cards,
    queryFn: () => webApiClient.adminCards(),
  });
  const [history, setHistory] = useState<BalanceRun[]>(() =>
    loadBalanceHistory(
      typeof window === "undefined" ? undefined : window.localStorage,
    ),
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(
    history[0]?.id,
  );
  const selectedRun = useMemo(
    () => history.find((run) => run.id === selectedId) ?? history[0],
    [history, selectedId],
  );
  const cards = query.data?.cards ?? [];

  function storeHistory(nextHistory: BalanceRun[]) {
    const bounded = saveBalanceHistory(
      nextHistory,
      typeof window === "undefined" ? undefined : window.localStorage,
    );
    setHistory(bounded);
  }

  function generate(scope: BalanceScope, weights: BalanceWeights) {
    const run = buildBalanceRun(cards, { scope, weights });
    storeHistory([run, ...history]);
    setSelectedId(run.id);
  }

  function removeRun(id: string) {
    const nextHistory = history.filter((run) => run.id !== id);
    storeHistory(nextHistory);
    if (selectedId === id) setSelectedId(nextHistory[0]?.id);
  }

  return (
    <>
      <AdminPageHeader
        actions={
          <Button
            busy={query.isFetching}
            onClick={() => void query.refetch()}
            tone="secondary"
          >
            Refresh catalog
          </Button>
        }
        eyebrow="Combat operations · Catalog diagnostics"
        lede="Generate repeatable balance signals from the real Phoenix card catalog, compare rarity and type bands, and export every source metric."
        title="Read the shape of the roster."
      />

      {query.isPending || query.error ? (
        <AdminDataState
          error={query.error}
          loading={query.isPending}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      <div className="balance-lab-shell">
        <div className="balance-lab-main">
          <BalanceControls
            catalogCards={cards}
            disabled={!query.data || query.isFetching}
            onGenerate={generate}
          />
        </div>
        <aside className="balance-lab-history">
          <BalanceRunHistory
            history={history}
            onClear={() => {
              storeHistory([]);
              setSelectedId(undefined);
            }}
            onRemove={removeRun}
            onSelect={setSelectedId}
            selectedId={selectedRun?.id}
          />
        </aside>
      </div>

      {selectedRun ? (
        <BalanceReportPreview run={selectedRun} />
      ) : (
        <EmptyState
          action={
            <span className="balance-empty-icon" aria-hidden="true">
              <BarChartIcon />
            </span>
          }
          copy="Choose a catalog scope and weights above. The report will be generated locally from the authorized Phoenix card response."
          title="No balance run selected"
        />
      )}
    </>
  );
}
