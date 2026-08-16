import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import type {
  AdminUser,
  AdminUserDetail,
  EmailAccessRequestsResponse,
} from "@adventure-time/api-client";

import { SearchIcon, UserPlusIcon } from "../../components/icons";
import { Button, EmptyState, Field, FormStatus } from "../../components/ui";
import { getErrorMessage, webApiClient } from "../../lib/api";
import { ADMIN_QUERY_KEYS, formatAdminDate } from "./admin-data";
import {
  AdminBackLink,
  AdminDataState,
  AdminMetric,
  AdminPageHeader,
  AdminSection,
  AdminStatus,
} from "./admin-common";

type RoleFilter = "all" | "user" | "admin" | "super_admin";
type AccountRole = Exclude<RoleFilter, "all">;

function userRole(user: Pick<AdminUser, "isAdmin" | "isSuperAdmin">) {
  if (user.isSuperAdmin) return "Super admin";
  if (user.isAdmin) return "Admin";
  return "Player";
}

function authMethods(user: AdminUser) {
  const methods = Object.entries(user.authMethods).reduce<string[]>(
    (enabledMethods, [method, enabled]) => {
      if (enabled)
        enabledMethods.push(method[0].toUpperCase() + method.slice(1));
      return enabledMethods;
    },
    [],
  );
  return methods.join(" · ") || "None";
}

export function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.users,
    queryFn: () => webApiClient.adminUsers(),
  });
  const users = query.data?.users ?? [];
  const needle = search.trim().toLowerCase();
  const visible = users.filter((user) => {
    const matchesRole =
      role === "all" ||
      (role === "super_admin" && user.isSuperAdmin) ||
      (role === "admin" && user.isAdmin && !user.isSuperAdmin) ||
      (role === "user" && !user.isAdmin && !user.isSuperAdmin);
    return (
      matchesRole &&
      (!needle ||
        `${user.displayName ?? ""} ${user.email}`
          .toLowerCase()
          .includes(needle))
    );
  });

  return (
    <>
      <AdminPageHeader
        eyebrow="Player operations"
        lede="Search account roles, authentication methods, coin balances, and today's quest progress."
        title="Support players with context."
      />
      {query.isPending || query.error ? (
        <AdminDataState
          error={query.error}
          loading={query.isPending}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data ? (
        <>
          <section className="admin-metrics" aria-label="User summary">
            <AdminMetric
              label="Accounts"
              note="Visible to this administrator"
              tone="info"
              value={users.length}
            />
            <AdminMetric
              label="Admins"
              note="Includes super administrators"
              tone="accent"
              value={users.filter((user) => user.isAdmin).length}
            />
            <AdminMetric
              label="Super admins"
              note="Sensitive moderation access"
              tone="danger"
              value={users.filter((user) => user.isSuperAdmin).length}
            />
            <AdminMetric
              label="Quest completion"
              note="Average for today's assignments"
              tone="success"
              value={`${users.length ? Math.round(users.reduce((sum, user) => sum + user.dailyQuestCompletion.percentage, 0) / users.length) : 0}%`}
            />
          </section>
          <AdminSection
            description={`${visible.length} of ${users.length} accounts shown`}
            title="Accounts"
          >
            <div className="admin-toolbar">
              <label className="admin-search-field">
                <SearchIcon />
                <span className="sr-only">Search users</span>
                <input
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="Search name or email"
                  type="search"
                  value={search}
                />
              </label>
              <label>
                <span className="sr-only">Filter roles</span>
                <select
                  onChange={(event) =>
                    setRole(event.currentTarget.value as RoleFilter)
                  }
                  value={role}
                >
                  <option value="all">All roles</option>
                  <option value="user">Players</option>
                  <option value="admin">Admins</option>
                  <option value="super_admin">Super admins</option>
                </select>
              </label>
            </div>
            {visible.length ? (
              <div className="admin-user-list">
                {visible.map((user) => (
                  <Link
                    aria-label={`Open ${user.displayName ?? user.email}`}
                    className="admin-record admin-user-record"
                    key={user.id}
                    to={`/admin/users/${user.id}`}
                  >
                    <span className="admin-user-avatar">
                      {(user.displayName ?? user.email)
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                    <div className="admin-record-copy">
                      <small>{authMethods(user)}</small>
                      <h3>{user.displayName || "Unnamed adventurer"}</h3>
                      <p>{user.email}</p>
                    </div>
                    <div className="admin-user-role">
                      <b>{userRole(user)}</b>
                      <small>{user.coins.toLocaleString()} coins</small>
                    </div>
                    <div className="admin-quest-progress">
                      <progress
                        aria-label={`${user.dailyQuestCompletion.percentage}% of today's quests complete`}
                        max="100"
                        value={user.dailyQuestCompletion.percentage}
                      />
                      <small>
                        {user.dailyQuestCompletion.completed}/
                        {user.dailyQuestCompletion.total} quests
                      </small>
                    </div>
                    <span className="admin-record-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                copy="Try another search or role filter."
                title="No users match"
              />
            )}
          </AdminSection>
        </>
      ) : null}
    </>
  );
}

function currentRole(detail: AdminUserDetail): AccountRole {
  if (detail.isSuperAdmin) return "super_admin";
  if (detail.isAdmin) return "admin";
  return "user";
}

export function AdminUserDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [coinDelta, setCoinDelta] = useState("100");
  const [roleSelection, setRoleSelection] = useState<{
    id: string;
    role: AccountRole;
  }>();
  const [feedback, setFeedback] = useState<string>();
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.user(id),
    queryFn: () => webApiClient.adminUserDetail(id),
    enabled: Boolean(id),
  });
  const detail = query.data;
  const role =
    roleSelection?.id === id
      ? roleSelection.role
      : detail
        ? currentRole(detail)
        : "user";

  async function refreshUserData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.user(id) }),
      queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.users }),
      queryClient.invalidateQueries({
        queryKey: ADMIN_QUERY_KEYS.emailRequests,
      }),
    ]);
  }

  const coins = useMutation({
    mutationFn: () => webApiClient.adjustAdminUserCoins(id, Number(coinDelta)),
    onSuccess: async () => {
      await refreshUserData();
      setFeedback("Coin balance updated.");
    },
  });
  const updateRole = useMutation({
    mutationFn: () => webApiClient.updateAdminUserRole(id, { role }),
    onSuccess: async () => {
      await refreshUserData();
      setRoleSelection(undefined);
      setFeedback("Account role updated.");
    },
  });
  const resetQuest = useMutation({
    mutationFn: (
      input: { mode: "all" } | { mode: "single"; questType: string },
    ) => webApiClient.resetAdminUserDailyQuests(id, input),
    onSuccess: async () => {
      await refreshUserData();
      setFeedback("Daily quest progress reset.");
    },
  });
  const deleteUser = useMutation({
    mutationFn: () => webApiClient.deleteAdminUser(id),
    onSuccess: async () => {
      await refreshUserData();
      navigate("/admin/users", { replace: true });
    },
  });
  const error =
    query.error ??
    coins.error ??
    updateRole.error ??
    resetQuest.error ??
    deleteUser.error;
  const busy =
    coins.isPending ||
    updateRole.isPending ||
    resetQuest.isPending ||
    deleteUser.isPending;

  function handleCoins(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(undefined);
    coins.mutate();
  }

  if (query.isPending || query.error) {
    return (
      <AdminDataState
        error={query.error}
        loading={query.isPending}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!detail)
    return (
      <EmptyState
        action={
          <Link className="button button-secondary" to="/admin/users">
            Back to users
          </Link>
        }
        copy="This account is no longer available."
        title="User not found"
      />
    );

  return (
    <>
      <AdminBackLink to="/admin/users">Back to users</AdminBackLink>
      <AdminPageHeader
        eyebrow={`${userRole(detail)} · joined ${formatAdminDate(detail.createdAt)}`}
        lede="Every control below is permission-aware and enforced again by Phoenix."
        title={detail.displayName || detail.email}
      />
      <FormStatus
        message={error ? getErrorMessage(error) : feedback}
        success={Boolean(feedback) && !error}
      />
      <section className="admin-metrics" aria-label="User detail summary">
        <AdminMetric
          label="Coins"
          note="Current spendable balance"
          tone="secondary"
          value={detail.coins.toLocaleString()}
        />
        <AdminMetric
          label="Today's quests"
          note={`${detail.dailyQuestCompletion.completed} of ${detail.dailyQuestCompletion.total}`}
          tone="success"
          value={`${detail.dailyQuestCompletion.percentage}%`}
        />
        <AdminMetric
          label="Auth methods"
          note={authMethods(detail)}
          tone="info"
          value={Object.values(detail.authMethods).filter(Boolean).length}
        />
        <AdminMetric
          label="Date key"
          note="User's current quest day"
          tone="accent"
          value={detail.todayDate}
        />
      </section>
      <div className="admin-user-detail-grid">
        <AdminSection
          description="Identity and immutable account context."
          title="Account profile"
        >
          <dl className="admin-detail-list">
            <div>
              <dt>Display name</dt>
              <dd>{detail.displayName || "Not set"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{detail.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{userRole(detail)}</dd>
            </div>
            <div>
              <dt>Authentication</dt>
              <dd>{authMethods(detail)}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatAdminDate(detail.createdAt)}</dd>
            </div>
          </dl>
        </AdminSection>
        <AdminSection
          description="Apply a positive or negative integer adjustment."
          title="Coin balance"
        >
          {detail.viewerPermissions.canManageCoins ? (
            <form className="admin-inline-form" onSubmit={handleCoins}>
              <Field hint="Examples: 100 or -50" label="Coin delta">
                <input
                  onChange={(event) => setCoinDelta(event.currentTarget.value)}
                  required
                  step="1"
                  type="number"
                  value={coinDelta}
                />
              </Field>
              <Button busy={coins.isPending} type="submit">
                Apply delta
              </Button>
            </form>
          ) : (
            <p className="admin-muted-copy">
              Your role cannot manage this balance.
            </p>
          )}
        </AdminSection>
        <AdminSection
          description="Super-admin protections and self-management rules remain server-enforced."
          title="Account role"
        >
          {detail.viewerPermissions.canManageAdminRights ? (
            <div className="admin-inline-form">
              <Field label="Role">
                <select
                  onChange={(event) =>
                    setRoleSelection({
                      id,
                      role: event.currentTarget.value as AccountRole,
                    })
                  }
                  value={role}
                >
                  <option value="user">Player</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super admin</option>
                </select>
              </Field>
              <Button
                busy={updateRole.isPending}
                onClick={() => {
                  setFeedback(undefined);
                  updateRole.mutate();
                }}
                tone="secondary"
              >
                Update role
              </Button>
            </div>
          ) : (
            <p className="admin-muted-copy">
              Your role cannot change this account's permissions.
            </p>
          )}
        </AdminSection>
      </div>
      <AdminSection
        action={
          detail.viewerPermissions.canResetDailyQuests ? (
            <Button
              busy={resetQuest.isPending}
              onClick={() => {
                if (window.confirm("Reset every daily quest for this user?"))
                  resetQuest.mutate({ mode: "all" });
              }}
              tone="ghost"
            >
              Reset all quests
            </Button>
          ) : undefined
        }
        description={`Progress for ${detail.todayDate}`}
        title="Daily quests"
      >
        <div className="admin-user-quest-list">
          {detail.dailyQuests.map((quest) => (
            <article className="admin-user-quest" key={quest.id}>
              <div>
                <small>{quest.type}</small>
                <h3>{quest.title}</h3>
                <p>{quest.description}</p>
              </div>
              <div className="admin-quest-progress">
                <progress
                  aria-label={`${quest.progress} of ${quest.target}`}
                  max={Math.max(1, quest.target)}
                  value={Math.min(quest.progress, Math.max(1, quest.target))}
                />
                <small>
                  {quest.progress}/{quest.target} · {quest.reward} coins
                </small>
              </div>
              <AdminStatus
                tone={
                  quest.claimed
                    ? "approved"
                    : quest.completed
                      ? "featured"
                      : quest.failed
                        ? "rejected"
                        : "pending"
                }
              >
                {quest.claimed
                  ? "Claimed"
                  : quest.completed
                    ? "Complete"
                    : quest.failed
                      ? "Failed"
                      : "In progress"}
              </AdminStatus>
              {detail.viewerPermissions.canResetDailyQuests ? (
                <Button
                  busy={resetQuest.isPending}
                  onClick={() =>
                    resetQuest.mutate({ mode: "single", questType: quest.type })
                  }
                  tone="ghost"
                >
                  Reset
                </Button>
              ) : null}
            </article>
          ))}
        </div>
      </AdminSection>
      <AdminSection
        description="Deletion removes the account and dependent game records. This cannot be undone."
        title="Danger zone"
      >
        <div className="admin-danger-row">
          <div>
            <h3>Delete this user</h3>
            <p>
              {detail.viewerPermissions.canDeleteUser
                ? "Phoenix has approved this administrator for the operation."
                : "Self-deletion and protected accounts cannot be removed here."}
            </p>
          </div>
          <Button
            busy={busy}
            disabled={!detail.viewerPermissions.canDeleteUser}
            onClick={() => {
              if (window.confirm(`Permanently delete ${detail.email}?`))
                deleteUser.mutate();
            }}
            tone="danger"
          >
            Delete user
          </Button>
        </div>
      </AdminSection>
    </>
  );
}

type EmailRequest = EmailAccessRequestsResponse["requests"][number];
const EMPTY_EMAIL_REQUESTS: EmailRequest[] = [];

function requestName(request: EmailRequest) {
  return request.googleName || request.email.split("@")[0] || "Unknown request";
}

function formatAssessmentAge(assessedAt: string | null) {
  if (!assessedAt) return "not yet assessed";

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(assessedAt).getTime()) / 1000),
  );

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function AdminEmailRequestsPage() {
  const queryClient = useQueryClient();
  const [chosenId, setChosenId] = useState<string>();
  const [status, setStatus] = useState<"all" | EmailRequest["status"]>(
    "pending",
  );
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.emailRequests,
    queryFn: () => webApiClient.adminEmailRequests(),
  });
  const requests = query.data?.requests ?? EMPTY_EMAIL_REQUESTS;
  const visible = useMemo(
    () =>
      requests.filter(
        (request) => status === "all" || request.status === status,
      ),
    [requests, status],
  );

  const selectedId = visible.some((request) => request.id === chosenId)
    ? chosenId
    : visible[0]?.id;
  const selected = requests.find((request) => request.id === selectedId);
  const review = useMutation({
    mutationFn: ({
      id,
      nextStatus,
    }: {
      id: string;
      nextStatus: "approved" | "rejected";
    }) => webApiClient.reviewAdminEmailRequest(id, nextStatus),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ADMIN_QUERY_KEYS.emailRequests,
        }),
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.users }),
      ]);
    },
  });
  const revealIp = useMutation({
    mutationFn: (id: string) => webApiClient.revealAdminEmailRequestIp(id),
  });
  const evidenceReasons =
    selected?.assessment?.state === "complete" ||
    selected?.assessment?.state === "partial"
      ? selected.assessment.contributions.reduce(
          (groups, contribution) => {
            if ((contribution.effectFromNeutral ?? 0) > 0) {
              groups.positive.push(...contribution.reasonCodes);
            }

            if (
              (contribution.effectFromNeutral ?? 0) < 0 ||
              contribution.hardFailure
            ) {
              groups.negative.push(...contribution.reasonCodes);
            }

            return groups;
          },
          { positive: [] as string[], negative: [] as string[] },
        )
      : { positive: [], negative: [] };

  return (
    <>
      <AdminPageHeader
        eyebrow="Super-admin moderation"
        lede="Review sensitive access context deliberately. Phoenix rejects this entire workspace for non-super administrators."
        title="Decide who enters the world."
      />
      <FormStatus
        message={
          review.error
            ? getErrorMessage(review.error)
            : review.isSuccess
              ? "Access request updated."
              : undefined
        }
        success={review.isSuccess}
      />
      {query.isPending || query.error ? (
        <AdminDataState
          error={query.error}
          loading={query.isPending}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data ? (
        <div className="admin-request-layout">
          <AdminSection
            action={
              <label>
                <span className="sr-only">Filter request status</span>
                <select
                  onChange={(event) =>
                    setStatus(event.currentTarget.value as typeof status)
                  }
                  value={status}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            }
            description={`${visible.length} requests in this view`}
            title="Moderation queue"
          >
            {visible.length ? (
              <div className="admin-request-list">
                {visible.map((request) => (
                  <button
                    aria-pressed={request.id === selectedId}
                    className="admin-request-row"
                    key={request.id}
                    onClick={() => setChosenId(request.id)}
                    type="button"
                  >
                    <span className="admin-user-avatar">
                      {requestName(request).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <h3>{requestName(request)}</h3>
                      <p>{request.email}</p>
                    </div>
                    <small>{request.provider || "Email"}</small>
                    <AdminStatus tone={request.status}>
                      {request.status}
                    </AdminStatus>
                    <time dateTime={request.lastSeenAt ?? request.createdAt}>
                      {formatAdminDate(request.lastSeenAt ?? request.createdAt)}
                    </time>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                copy="There are no access requests in this status."
                title="Queue clear"
              />
            )}
          </AdminSection>
          <aside className="panel admin-request-detail">
            {selected ? (
              <>
                <span className="eyebrow">Sensitive request detail</span>
                <div className="admin-request-person">
                  <span className="admin-user-avatar">
                    {requestName(selected).slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h2>{requestName(selected)}</h2>
                    <p>{selected.email}</p>
                    <AdminStatus tone={selected.status}>
                      {selected.status}
                    </AdminStatus>
                  </div>
                </div>
                {selected.assessment ? (
                  <section className="admin-auth-events">
                    <h3>
                      Trust assessment <small>Advisory heuristic</small>
                    </h3>
                    <p>
                      Model {selected.assessment.modelVersion} · assessed{" "}
                      {formatAssessmentAge(selected.assessment.assessedAt)} ago
                    </p>
                    {selected.assessment.state === "test_lab" ? (
                      <>
                        <p>
                          <b>Firebase Test Lab environment</b> — no trust score.
                          This does not itself prove a Play pre-launch report.
                        </p>
                        <dl className="admin-detail-list">
                          <div>
                            <dt>Matched Test Lab range</dt>
                            <dd>
                              {selected.assessment.network.testLabMatchedCidr ??
                                "Unavailable"}
                            </dd>
                          </div>
                          <div>
                            <dt>Range-set version</dt>
                            <dd>
                              {selected.assessment.network.testLabRangeVersion ??
                                "Unavailable"}
                            </dd>
                          </div>
                        </dl>
                      </>
                    ) : selected.assessment.state === "complete" ||
                      selected.assessment.state === "partial" ? (
                      <>
                        <p>
                          <b>
                            {selected.assessment.confidence}% trustworthiness
                            confidence
                          </b>{" "}
                          · {selected.assessment.coverage}% evidence coverage ·{" "}
                          {selected.assessment.band}
                        </p>
                        {selected.assessment.network.googleNetwork ===
                          "matched" &&
                        selected.assessment.network.testLab !== "matched" ? (
                          <p>
                            Google-owned network; not a published Test Lab
                            range.
                          </p>
                        ) : null}
                        <p>
                          {selected.assessment.network.maskedIpAddress ??
                            "Address unavailable"}
                          {selected.assessment.network.organization
                            ? ` · ${selected.assessment.network.organization}`
                            : ""}
                          {selected.assessment.network.asn
                            ? ` · ASN ${selected.assessment.network.asn}`
                            : ""}
                          {selected.assessment.network.countryCode
                            ? ` · ${selected.assessment.network.countryCode}`
                            : ""}
                        </p>
                        <p>
                          Network flags:{" "}
                          {[
                            selected.assessment.network.vpn && "VPN",
                            selected.assessment.network.proxy && "proxy",
                            selected.assessment.network.hosting && "hosting",
                            selected.assessment.network.tor && "Tor",
                          ]
                            .filter(Boolean)
                            .join(", ") || "none reported"}
                        </p>
                        <details>
                          <summary>Evidence details</summary>
                          <h4>Positive evidence</h4>
                          <ul>
                            {evidenceReasons.positive.map((reason) => (
                              <li key={`positive-${reason}`}>{reason}</li>
                            ))}
                          </ul>
                          <h4>Negative evidence</h4>
                          <ul>
                            {evidenceReasons.negative.map((reason) => (
                              <li key={`negative-${reason}`}>{reason}</li>
                            ))}
                          </ul>
                          <h4>Hard failures</h4>
                          <p>
                            {selected.assessment.hardFailureReasons.join(", ") ||
                              "None"}
                          </p>
                          <h4>Missing evidence</h4>
                          <p>
                            {selected.assessment.missingReasons.join(", ") ||
                              "None"}
                          </p>
                        </details>
                      </>
                    ) : (
                      <>
                        <p>
                          {selected.assessment.state === "assessing"
                            ? "Assessment in progress."
                            : "Not enough evidence for a score."}
                        </p>
                        <details>
                          <summary>Evidence details</summary>
                          <p>
                            Missing:{" "}
                            {selected.assessment.missingReasons.join(", ") ||
                              "None"}
                          </p>
                          <p>
                            Hard failures:{" "}
                            {selected.assessment.hardFailureReasons.join(", ") ||
                              "None"}
                          </p>
                        </details>
                      </>
                    )}
                    <div className="button-row">
                      {revealIp.data && revealIp.variables === selected.id ? (
                        <strong>Exact IP: {revealIp.data.ipAddress}</strong>
                      ) : (
                        <Button
                          busy={revealIp.isPending}
                          onClick={() => revealIp.mutate(selected.id)}
                          tone="secondary"
                        >
                          Reveal exact IP (audited)
                        </Button>
                      )}
                    </div>
                    <FormStatus
                      message={
                        revealIp.error
                          ? getErrorMessage(revealIp.error)
                          : undefined
                      }
                    />
                  </section>
                ) : null}
                <dl className="admin-detail-list">
                  <div>
                    <dt>Provider</dt>
                    <dd>{selected.provider ?? "Email"}</dd>
                  </div>
                  <div>
                    <dt>Has account</dt>
                    <dd>{selected.hasAccount ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Attempts</dt>
                    <dd>{selected.attemptCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Last seen</dt>
                    <dd>{formatAdminDate(selected.lastSeenAt)}</dd>
                  </div>
                  <div>
                    <dt>Platform</dt>
                    <dd>{selected.lastClientPlatform ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>App version</dt>
                    <dd>{selected.lastClientAppVersion ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Request id</dt>
                    <dd>{selected.lastRequestId ?? "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Attestation</dt>
                    <dd>{selected.lastAttestationStatus ?? "Not recorded"}</dd>
                  </div>
                </dl>
                <section className="admin-auth-events">
                  <h3>Recent authentication events</h3>
                  {selected.authEvents?.length ? (
                    selected.authEvents.map((event) => (
                      <article key={event.id}>
                        <span />
                        <div>
                          <b>{event.eventType}</b>
                          <small>
                            {event.errorCode ??
                              event.provider ??
                              "No error code"}
                          </small>
                        </div>
                        <time dateTime={event.createdAt}>
                          {formatAdminDate(event.createdAt)}
                        </time>
                      </article>
                    ))
                  ) : (
                    <p>No event detail was returned.</p>
                  )}
                </section>
                {selected.status === "pending" ? (
                  <div className="button-row">
                    <Button
                      busy={review.isPending}
                      onClick={() =>
                        review.mutate({
                          id: selected.id,
                          nextStatus: "approved",
                        })
                      }
                    >
                      Approve access
                    </Button>
                    <Button
                      busy={review.isPending}
                      onClick={() => {
                        if (
                          window.confirm(`Reject access for ${selected.email}?`)
                        )
                          review.mutate({
                            id: selected.id,
                            nextStatus: "rejected",
                          });
                      }}
                      tone="danger"
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                copy="Choose a request from the moderation queue."
                title="No request selected"
              />
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
