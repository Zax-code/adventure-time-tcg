import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { AdminAbilitiesResponse } from "@adventure-time/api-client";

import { SearchIcon, SwordsIcon } from "../../components/icons";
import { Button, EmptyState, Field, FormStatus } from "../../components/ui";
import { getErrorMessage, webApiClient } from "../../lib/api";
import { ADMIN_QUERY_KEYS } from "./admin-data";
import {
  AdminBackLink,
  AdminDataState,
  AdminMetric,
  AdminPageHeader,
  AdminSection,
  AdminStatus,
} from "./admin-common";

type Ability = AdminAbilitiesResponse["abilities"][number];
type AbilityType = Ability["type"];

function assignedCount(ability: Ability, data: AdminAbilitiesResponse) {
  return data.cardAbilities.filter(
    (entry) =>
      entry.passiveId === ability.id ||
      entry.skillId === ability.id ||
      entry.ultimateId === ability.id,
  ).length;
}

export function AdminAbilitiesPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | AbilityType>("ALL");
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.abilities,
    queryFn: () => webApiClient.adminAbilities(),
  });
  const abilities = query.data?.abilities ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const visible = abilities.filter(
    (ability) =>
      (type === "ALL" || ability.type === type) &&
      (!normalizedSearch ||
        `${ability.name} ${ability.key} ${ability.description}`
          .toLowerCase()
          .includes(normalizedSearch)),
  );

  return (
    <>
      <AdminPageHeader
        actions={<Link className="button button-primary" to="/admin/abilities/new">Create ability</Link>}
        eyebrow="Combat library"
        lede="Reusable passive, skill, and ultimate definitions with localized copy and structured payloads."
        title="Author combat rules deliberately."
      />
      {query.isPending || query.error ? (
        <AdminDataState error={query.error} loading={query.isPending} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data ? (
        <>
          <section className="admin-metrics" aria-label="Ability summary">
            {(["PASSIVE", "SKILL", "ULTIMATE"] as const).map((abilityType) => (
              <AdminMetric
                key={abilityType}
                label={abilityType[0] + abilityType.slice(1).toLowerCase()}
                note="Reusable definitions"
                tone={abilityType === "PASSIVE" ? "success" : abilityType === "SKILL" ? "info" : "accent"}
                value={abilities.filter((ability) => ability.type === abilityType).length}
              />
            ))}
            <AdminMetric label="Assignments" note="Card overrides across all slots" tone="secondary" value={query.data.cardAbilities.length} />
          </section>
          <AdminSection description={`${visible.length} definitions shown`} title="Ability definitions">
            <div className="admin-toolbar">
              <label className="admin-search-field">
                <SearchIcon />
                <span className="sr-only">Search abilities</span>
                <input onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search name, key, or description" type="search" value={search} />
              </label>
              <label><span className="sr-only">Filter ability type</span><select onChange={(event) => setType(event.currentTarget.value as "ALL" | AbilityType)} value={type}><option value="ALL">All types</option><option value="PASSIVE">Passives</option><option value="SKILL">Skills</option><option value="ULTIMATE">Ultimates</option></select></label>
            </div>
            {visible.length ? (
              <div className="admin-ability-list">
                {visible.map((ability) => (
                  <Link aria-label={`Edit ${ability.name}`} className="admin-record admin-ability-record" key={ability.id} to={`/admin/abilities/${ability.id}`}>
                    <span className={`admin-ability-kind ability-${ability.type.toLowerCase()}`}><SwordsIcon /><b>{ability.type.slice(0, 1)}</b></span>
                    <div className="admin-record-copy"><small>{ability.key}</small><h3>{ability.name}</h3><p>{ability.description}</p></div>
                    <dl className="admin-ability-facts"><div><dt>Cost</dt><dd>{ability.cost}</dd></div><div><dt>Cooldown</dt><dd>{ability.cooldown ?? "—"}</dd></div><div><dt>Assigned</dt><dd>{assignedCount(ability, query.data)}</dd></div></dl>
                    {ability.oncePerMatch ? <AdminStatus tone="pending">Once per match</AdminStatus> : null}
                    <span className="admin-record-arrow" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            ) : <EmptyState copy="Try another search or ability type." title="No abilities match" />}
          </AdminSection>
        </>
      ) : null}
    </>
  );
}

type AbilityDraft = {
  key: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  type: AbilityType;
  cost: string;
  cooldown: string;
  oncePerMatch: boolean;
  payload: string;
};

const blankAbility: AbilityDraft = {
  key: "",
  name: "",
  nameFr: "",
  description: "",
  descriptionFr: "",
  type: "SKILL",
  cost: "0",
  cooldown: "",
  oncePerMatch: false,
  payload: "{}",
};

function toAbilityDraft(ability: Ability): AbilityDraft {
  return {
    key: ability.key,
    name: ability.name,
    nameFr: ability.nameFr ?? "",
    description: ability.description,
    descriptionFr: ability.descriptionFr ?? "",
    type: ability.type,
    cost: String(ability.cost),
    cooldown: ability.cooldown == null ? "" : String(ability.cooldown),
    oncePerMatch: ability.oncePerMatch,
    payload: JSON.stringify(ability.payload ?? {}, null, 2),
  };
}

function abilityPayload(draft: AbilityDraft) {
  let payload: unknown;
  try {
    payload = draft.payload.trim() ? JSON.parse(draft.payload) : null;
  } catch {
    throw new Error("Payload must be valid JSON.");
  }
  if (payload !== null && (typeof payload !== "object" || Array.isArray(payload))) {
    throw new Error("Payload must be a JSON object or null.");
  }
  return {
    key: draft.key.trim(),
    name: draft.name.trim(),
    nameFr: draft.nameFr.trim() || null,
    description: draft.description.trim(),
    descriptionFr: draft.descriptionFr.trim() || null,
    type: draft.type,
    cost: Number(draft.cost),
    cooldown: draft.cooldown === "" ? null : Number(draft.cooldown),
    oncePerMatch: draft.oncePerMatch,
    payload,
  };
}

export function AdminAbilityEditorPage() {
  const { id = "new" } = useParams<{ id: string }>();
  const createMode = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initializedId = useRef<string | undefined>(undefined);
  const [draft, setDraft] = useState<AbilityDraft>(blankAbility);
  const [feedback, setFeedback] = useState<string>();
  const [assignmentCardId, setAssignmentCardId] = useState("");
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.abilities,
    queryFn: () => webApiClient.adminAbilities(),
  });
  const ability = query.data?.abilities.find((entry) => entry.id === id);

  useEffect(() => {
    if (!createMode && ability && initializedId.current !== ability.id) {
      initializedId.current = ability.id;
      setDraft(toAbilityDraft(ability));
    }
  }, [ability, createMode]);

  const save = useMutation({
    mutationFn: () =>
      createMode
        ? webApiClient.createAdminAbility(abilityPayload(draft))
        : webApiClient.updateAdminAbility(id, abilityPayload(draft)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.abilities });
      if (createMode) navigate("/admin/abilities", { replace: true });
      else setFeedback("Ability definition saved.");
    },
  });
  const remove = useMutation({
    mutationFn: () => webApiClient.deleteAdminAbility(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.abilities });
      navigate("/admin/abilities", { replace: true });
    },
  });
  const assign = useMutation({
    mutationFn: async () => {
      if (!ability || !assignmentCardId || !query.data) throw new Error("Choose a card first.");
      const current = query.data.cardAbilities.find((entry) => entry.cardId === assignmentCardId);
      return webApiClient.assignAdminCardAbility({
        cardId: assignmentCardId,
        passiveId: ability.type === "PASSIVE" ? ability.id : current?.passiveId ?? null,
        skillId: ability.type === "SKILL" ? ability.id : current?.skillId ?? null,
        ultimateId: ability.type === "ULTIMATE" ? ability.id : current?.ultimateId ?? null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.abilities });
      setAssignmentCardId("");
      setFeedback("Ability assigned to card.");
    },
  });
  const assignedCards = useMemo(() => {
    if (!ability || !query.data) return [];
    const ids = new Set<string>();
    for (const entry of query.data.cardAbilities) {
      if (
        entry.passiveId === ability.id ||
        entry.skillId === ability.id ||
        entry.ultimateId === ability.id
      ) {
        ids.add(entry.cardId);
      }
    }
    return query.data.cards.filter((card) => ids.has(card.id));
  }, [ability, query.data]);
  const error = query.error ?? save.error ?? remove.error ?? assign.error;

  function updateDraft<K extends keyof AbilityDraft>(key: K, value: AbilityDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(undefined);
    save.mutate();
  }

  if (query.isPending || (query.error && !save.error && !remove.error && !assign.error)) {
    return <AdminDataState error={query.error} loading={query.isPending} onRetry={() => void query.refetch()} />;
  }
  if (!createMode && !ability) {
    return <EmptyState action={<Link className="button button-secondary" to="/admin/abilities">Back to abilities</Link>} copy="This ability is not present in the current Phoenix response." title="Ability not found" />;
  }

  return (
    <>
      <AdminBackLink to="/admin/abilities">Back to abilities</AdminBackLink>
      <AdminPageHeader
        actions={<Button busy={save.isPending} form="admin-ability-form" type="submit">{createMode ? "Create ability" : "Save ability"}</Button>}
        eyebrow={createMode ? "New combat definition" : draft.type}
        lede="Localized copy, cost, cooldown, lifecycle, and the structured engine payload save as one definition."
        title={createMode ? "Create an ability." : `Edit ${draft.name}.`}
      />
      <FormStatus message={error ? getErrorMessage(error) : feedback} success={Boolean(feedback) && !error} />
      <div className="admin-editor-layout">
        <form className="admin-editor-main" id="admin-ability-form" onSubmit={handleSubmit}>
          <AdminSection description="Stable key plus English and French player-facing language." title="01 · Identity and copy">
            <div className="form-grid admin-form-grid">
              <Field label="Stable key"><input onChange={(event) => updateDraft("key", event.currentTarget.value)} required value={draft.key} /></Field>
              <Field label="Ability type"><select onChange={(event) => updateDraft("type", event.currentTarget.value as AbilityType)} value={draft.type}><option value="PASSIVE">Passive</option><option value="SKILL">Skill</option><option value="ULTIMATE">Ultimate</option></select></Field>
              <Field label="English name"><input onChange={(event) => updateDraft("name", event.currentTarget.value)} required value={draft.name} /></Field>
              <Field label="French name"><input onChange={(event) => updateDraft("nameFr", event.currentTarget.value)} value={draft.nameFr} /></Field>
              <div className="full"><Field label="English description"><textarea onChange={(event) => updateDraft("description", event.currentTarget.value)} required value={draft.description} /></Field></div>
              <div className="full"><Field label="French description"><textarea onChange={(event) => updateDraft("descriptionFr", event.currentTarget.value)} value={draft.descriptionFr} /></Field></div>
            </div>
          </AdminSection>
          <AdminSection description="Engine-facing action constraints." title="02 · Cost and lifecycle">
            <div className="form-grid admin-form-grid">
              <Field label="Energy cost"><input min="0" onChange={(event) => updateDraft("cost", event.currentTarget.value)} required type="number" value={draft.cost} /></Field>
              <Field hint="Leave empty for no cooldown." label="Cooldown"><input min="0" onChange={(event) => updateDraft("cooldown", event.currentTarget.value)} type="number" value={draft.cooldown} /></Field>
              <label className="admin-check-field"><input checked={draft.oncePerMatch} onChange={(event) => updateDraft("oncePerMatch", event.currentTarget.checked)} type="checkbox" /><span><b>Once per match</b><small>Prevent repeated use after the first activation.</small></span></label>
            </div>
          </AdminSection>
          <AdminSection description="Validated JSON escape hatch for the current battle-engine payload." title="03 · Structured payload">
            <Field hint="Must be a JSON object or null." label="Payload JSON"><textarea className="admin-code-field" onChange={(event) => updateDraft("payload", event.currentTarget.value)} spellCheck={false} value={draft.payload} /></Field>
          </AdminSection>
          {!createMode ? (
            <AdminSection description="Deletion is permanent and may be blocked while references exist." title="04 · Danger zone">
              <div className="admin-danger-row"><div><h3>Delete ability definition</h3><p>Review assigned cards before removing this reusable combat rule.</p></div><Button busy={remove.isPending} onClick={() => { if (window.confirm(`Delete ${draft.name}?`)) remove.mutate(); }} tone="danger">Delete ability</Button></div>
            </AdminSection>
          ) : null}
        </form>
        <aside className="admin-editor-aside">
          <section className="panel admin-sticky-preview">
            <span className="eyebrow">Player-facing preview</span>
            <div className={`admin-ability-preview ability-${draft.type.toLowerCase()}`}><span><SwordsIcon /></span><div><small>{draft.type}</small><h2>{draft.name || "Untitled ability"}</h2><p>{draft.description || "Add a clear player-facing description."}</p><b>{draft.cost} energy{draft.cooldown ? ` · ${draft.cooldown} turn cooldown` : ""}</b></div></div>
            {!createMode && ability && query.data ? (
              <div className="admin-assignment-panel">
                <h3>Assign this ability</h3>
                <p>The selected slot is derived from the ability type; other slots remain unchanged.</p>
                <Field label="Card"><select onChange={(event) => setAssignmentCardId(event.currentTarget.value)} value={assignmentCardId}><option value="">Choose a card</option>{query.data.cards.map((card) => <option key={card.id} value={card.id}>{card.name} · {card.rarityName ?? "Unknown"}</option>)}</select></Field>
                <Button busy={assign.isPending} disabled={!assignmentCardId} onClick={() => assign.mutate()} tone="secondary">Assign to card</Button>
                <div className="admin-assigned-list"><small>Assigned to {assignedCards.length} cards</small>{assignedCards.map((card) => <Link key={card.id} to={`/admin/cards/${card.id}`}>{card.name}<span>→</span></Link>)}</div>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  );
}
