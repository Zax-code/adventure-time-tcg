import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  BarChartIcon,
  BoxIcon,
  CardsIcon,
  PackIcon,
  SparklesIcon,
  SwordsIcon,
  UserPlusIcon,
} from "../../components/icons";
import { useAuth } from "../../auth/auth-provider";
import { webApiClient } from "../../lib/api";
import { ADMIN_QUERY_KEYS } from "./admin-data";
import {
  AdminDataState,
  AdminMetric,
  AdminPageHeader,
  AdminSection,
  AdminStatus,
} from "./admin-common";

const workspaces = [
  { href: "/admin/cards", title: "Cards", copy: "Identity, stats, images, abilities, archive, and featured state", Icon: CardsIcon, tone: "primary" },
  { href: "/admin/packs", title: "Packs", copy: "Prices, contents, guarantees, activation, and catalog art", Icon: PackIcon, tone: "secondary" },
  { href: "/admin/card-backs", title: "Card backs", copy: "Three themes across every rarity", Icon: BoxIcon, tone: "accent" },
  { href: "/admin/image-assets", title: "Image assets", copy: "Reusable PNG, JPEG, WEBP, and SVG uploads", Icon: SparklesIcon, tone: "success" },
  { href: "/admin/abilities", title: "Abilities", copy: "Combat definitions and card assignments", Icon: SwordsIcon, tone: "accent" },
  { href: "/admin/users", title: "Users", copy: "Roles, coins, quests, and deletion permissions", Icon: UserPlusIcon, tone: "info" },
] as const;

export function AdminOverviewPage() {
  const { user } = useAuth();
  const cards = useQuery({ queryKey: ADMIN_QUERY_KEYS.cards, queryFn: () => webApiClient.adminCards() });
  const packs = useQuery({ queryKey: ADMIN_QUERY_KEYS.packs, queryFn: () => webApiClient.adminPacks() });
  const users = useQuery({ queryKey: ADMIN_QUERY_KEYS.users, queryFn: () => webApiClient.adminUsers() });
  const abilities = useQuery({ queryKey: ADMIN_QUERY_KEYS.abilities, queryFn: () => webApiClient.adminAbilities() });
  const requests = useQuery({
    queryKey: ADMIN_QUERY_KEYS.emailRequests,
    queryFn: () => webApiClient.adminEmailRequests(),
    enabled: Boolean(user?.isSuperAdmin),
  });
  const requiredQueries = [cards, packs, users, abilities];
  const loading = requiredQueries.some((query) => query.isPending);
  const error = requiredQueries.find((query) => query.error)?.error;
  const pendingRequests = requests.data?.requests.filter((request) => request.status === "pending").length ?? 0;

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations overview"
        lede="Current catalog, economy, player, and combat workspaces—each limited to capabilities backed by Phoenix."
        title="Keep the world coherent."
      />
      {loading || error ? (
        <AdminDataState
          error={error}
          loading={loading}
          onRetry={() => requiredQueries.forEach((query) => void query.refetch())}
        />
      ) : null}
      {!loading && !error ? (
        <>
          <section className="admin-metrics" aria-label="Operations summary">
            <AdminMetric label="Player accounts" note="Visible to this administrator" tone="info" value={users.data?.users.length ?? 0} />
            <AdminMetric label="Active catalog" note="Non-archived card definitions" tone="success" value={cards.data?.cards.filter((card) => !card.isArchived).length ?? 0} />
            <AdminMetric label="Active packs" note="Available pack definitions" tone="secondary" value={packs.data?.packs.filter((pack) => pack.isActive).length ?? 0} />
            <AdminMetric
              label="Pending access"
              note={user?.isSuperAdmin ? "Super-admin moderation queue" : "Super-admin only"}
              tone={pendingRequests ? "danger" : "accent"}
              value={user?.isSuperAdmin ? pendingRequests : "Restricted"}
            />
          </section>
          <div className="admin-overview-layout">
            <AdminSection description="Open a focused operational workspace." title="Workspaces">
              <div className="admin-workspace-grid">
                {workspaces.map(({ Icon, copy, href, title, tone }) => (
                  <Link className={`admin-workspace-card tone-${tone}`} key={href} to={href}>
                    <span><Icon /></span>
                    <div><h3>{title}</h3><p>{copy}</p></div>
                    <b aria-hidden="true">→</b>
                  </Link>
                ))}
                {user?.isSuperAdmin ? (
                  <Link className="admin-workspace-card tone-danger" to="/admin/email-requests">
                    <span><BarChartIcon /></span>
                    <div><h3>Access requests</h3><p>Sensitive authentication moderation queue</p></div>
                    <b aria-hidden="true">→</b>
                  </Link>
                ) : null}
              </div>
            </AdminSection>
            <AdminSection description="Explicit product decisions from the current contract." title="Product integrity">
              <div className="admin-integrity-list">
                <article><AdminStatus tone="approved">Resolved</AdminStatus><div><h3>Daily reward</h3><p>Phoenix is authoritative; the current reward is 50 coins.</p></div></article>
                <article><AdminStatus tone="approved">Resolved</AdminStatus><div><h3>Daily quests</h3><p>Seven current definitions; the retired daily-login quest is excluded.</p></div></article>
                <article><AdminStatus tone="pending">Interface policy</AdminStatus><div><h3>Featured maximum</h3><p>Five slots are enforced by the website, not the backend contract.</p></div></article>
                <article><AdminStatus tone="rejected">Unavailable</AdminStatus><div><h3>Operational audit log</h3><p>No audit-log endpoint exists, so no synthetic activity is shown.</p></div></article>
                <article><AdminStatus tone="rejected">Unavailable</AdminStatus><div><h3>Balance Lab</h3><p><Link className="text-link" to="/admin/balance">Review the explicit keep, rebuild, or remove decision →</Link></p></div></article>
              </div>
            </AdminSection>
          </div>
        </>
      ) : null}
    </>
  );
}
