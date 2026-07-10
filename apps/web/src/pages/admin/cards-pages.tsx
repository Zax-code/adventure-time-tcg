import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  cardTypeValues,
  type AdminAbilitiesResponse,
  type AdminCardsResponse,
  type CardType,
} from "@adventure-time/api-client";

import { CardsIcon, SearchIcon } from "../../components/icons";
import { Button, EmptyState, Field, FormStatus } from "../../components/ui";
import {
  getCardMediaUrl,
  getCardOutlineSource,
  normalizeCardRarityName,
} from "../../lib/assets";
import { getErrorMessage, webApiClient } from "../../lib/api";
import { useOptionalTheme } from "../../theme/theme-provider";
import { ADMIN_QUERY_KEYS } from "./admin-data";
import {
  AdminBackLink,
  AdminDataState,
  AdminMetric,
  AdminPageHeader,
  AdminSection,
  AdminStatus,
} from "./admin-common";

type AdminCard = AdminCardsResponse["cards"][number];
type AdminAbility = AdminAbilitiesResponse["abilities"][number];
type CardFilter = "all" | "active" | "archived" | "featured";
const EMPTY_ADMIN_CARDS: AdminCard[] = [];
const EMPTY_ADMIN_ABILITIES: AdminAbility[] = [];

function AdminCardArtwork({ card }: { card: AdminCard }) {
  return (
    <div className="admin-card-art" aria-label={`${card.name} artwork`}>
      {card.imageAssetId ? (
        <img
          alt={`${card.name} card illustration`}
          decoding="async"
          loading="lazy"
          src={getCardMediaUrl(card.imageAssetId)}
        />
      ) : (
        <span className="admin-art-placeholder" role="img" aria-label="Artwork missing">
          <CardsIcon />
          <b>{card.name.slice(0, 1).toUpperCase()}</b>
        </span>
      )}
    </div>
  );
}

export function AdminCardsPage() {
  const [filter, setFilter] = useState<CardFilter>("all");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.cards,
    queryFn: () => webApiClient.adminCards(),
  });
  const cards = query.data?.cards ?? EMPTY_ADMIN_CARDS;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleCards = useMemo(
    () =>
      cards.filter((card) => {
        const matchesFilter =
          filter === "all" ||
          (filter === "active" && !card.isArchived) ||
          (filter === "archived" && card.isArchived) ||
          (filter === "featured" && card.isFeatured);
        const matchesSearch =
          !normalizedSearch ||
          `${card.name} ${card.character} ${card.type} ${card.rarityName}`
            .toLowerCase()
            .includes(normalizedSearch);
        return matchesFilter && matchesSearch;
      }),
    [cards, filter, normalizedSearch],
  );
  const state = (
    <AdminDataState
      error={query.error}
      loading={query.isPending}
      onRetry={() => void query.refetch()}
    />
  );

  return (
    <>
      <AdminPageHeader
        actions={
          <Link className="button button-primary" to="/admin/cards/new">
            Create card
          </Link>
        }
        eyebrow="Catalog operations"
        lede="Search every active and archived definition, then edit only the controls backed by Phoenix."
        title="Shape the card catalog."
      />

      {query.isPending || query.error ? state : null}
      {query.data ? (
        <>
          <section className="admin-metrics" aria-label="Card catalog summary">
            <AdminMetric
              label="Active cards"
              note="Available in the player catalog"
              tone="success"
              value={cards.filter((card) => !card.isArchived).length}
            />
            <AdminMetric
              label="Archived"
              note="Retained without player availability"
              tone="info"
              value={cards.filter((card) => card.isArchived).length}
            />
            <AdminMetric
              label="Featured"
              note="Visible in curated spotlights"
              tone="accent"
              value={cards.filter((card) => card.isFeatured).length}
            />
            <AdminMetric
              label="Missing artwork"
              note="Cards using the themed fallback"
              tone="danger"
              value={cards.filter((card) => !card.imageAssetId).length}
            />
          </section>

          <AdminSection
            description={`${visibleCards.length} of ${cards.length} cards shown`}
            title="Card records"
          >
            <div className="admin-toolbar">
              <label className="admin-search-field">
                <SearchIcon />
                <span className="sr-only">Search cards</span>
                <input
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="Search name, character, type, or rarity"
                  type="search"
                  value={search}
                />
              </label>
              <label>
                <span className="sr-only">Filter cards</span>
                <select
                  onChange={(event) => setFilter(event.currentTarget.value as CardFilter)}
                  value={filter}
                >
                  <option value="all">All cards</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="featured">Featured</option>
                </select>
              </label>
            </div>

            {visibleCards.length ? (
              <div className="admin-record-list">
                {visibleCards.map((card) => (
                  <Link
                    aria-label={`Edit ${card.name}`}
                    className="admin-record admin-card-record"
                    key={card.id}
                    to={`/admin/cards/${card.id}`}
                  >
                    <AdminCardArtwork card={card} />
                    <div className="admin-record-copy">
                      <small>{card.rarityName} · {card.type}</small>
                      <h3>{card.name}</h3>
                      <p>{card.character}</p>
                    </div>
                    <dl className="admin-card-stats">
                      <div><dt>HP</dt><dd>{card.hp}</dd></div>
                      <div><dt>ATK</dt><dd>{card.attack}</dd></div>
                      <div><dt>DEF</dt><dd>{card.defense}</dd></div>
                      <div><dt>SPD</dt><dd>{card.speed}</dd></div>
                    </dl>
                    <div className="admin-record-statuses">
                      {card.isArchived ? (
                        <AdminStatus tone="inactive">Archived</AdminStatus>
                      ) : (
                        <AdminStatus tone="active">Active</AdminStatus>
                      )}
                      {card.isFeatured ? (
                        <AdminStatus tone="featured">Featured</AdminStatus>
                      ) : null}
                    </div>
                    <span className="admin-record-arrow" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                copy="Try another search or catalog filter."
                title="No cards match this view"
              />
            )}
          </AdminSection>
        </>
      ) : null}
    </>
  );
}

type CardDraft = {
  name: string;
  character: string;
  description: string;
  hp: string;
  attack: string;
  defense: string;
  speed: string;
  type: CardType;
  rarityId: string;
};

type AssignmentDraft = {
  passiveId: string;
  skillId: string;
  ultimateId: string;
};

const blankCardDraft: CardDraft = {
  name: "",
  character: "",
  description: "",
  hp: "100",
  attack: "20",
  defense: "20",
  speed: "40",
  type: "Hero",
  rarityId: "",
};

const blankAssignment: AssignmentDraft = {
  passiveId: "",
  skillId: "",
  ultimateId: "",
};

function toCardPayload(draft: CardDraft) {
  return {
    name: draft.name.trim(),
    character: draft.character.trim(),
    description: draft.description.trim(),
    hp: Number(draft.hp),
    attack: Number(draft.attack),
    defense: Number(draft.defense),
    speed: Number(draft.speed),
    type: draft.type,
    rarityId: draft.rarityId,
  };
}

type CardEditorFormProps = {
  abilitiesByType: Record<AdminAbility["type"], AdminAbility[]>;
  allowsPassive: boolean;
  assignment: AssignmentDraft;
  clearAssignmentPending: boolean;
  createMode: boolean;
  currentCard?: Pick<AdminCard, "isArchived">;
  draft: CardDraft;
  effectiveRarityId: string;
  onArchiveStatusChange: () => void;
  onAssignmentChange: (key: keyof AssignmentDraft, value: string) => void;
  onClearAssignments: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpload: (file: File) => void;
  patchPending: boolean;
  rarities: readonly { id: string; name: string }[];
  updateDraft: <Key extends keyof CardDraft>(
    key: Key,
    value: CardDraft[Key],
  ) => void;
  uploadPending: boolean;
};

function AdminCardEditorForm({
  abilitiesByType,
  allowsPassive,
  assignment,
  clearAssignmentPending,
  createMode,
  currentCard,
  draft,
  effectiveRarityId,
  onArchiveStatusChange,
  onAssignmentChange,
  onClearAssignments,
  onSubmit,
  onUpload,
  patchPending,
  rarities,
  updateDraft,
  uploadPending,
}: CardEditorFormProps) {
  return (
    <form className="admin-editor-main" id="admin-card-form" onSubmit={onSubmit}>
      <AdminSection
        description="Player-facing identity and catalog classification."
        title="01 · Identity"
      >
        <div className="form-grid admin-form-grid">
          <Field label="Card name">
            <input
              onChange={(event) => updateDraft("name", event.currentTarget.value)}
              required
              value={draft.name}
            />
          </Field>
          <Field label="Character">
            <input
              onChange={(event) => updateDraft("character", event.currentTarget.value)}
              required
              value={draft.character}
            />
          </Field>
          <Field label="Type">
            <select
              onChange={(event) => updateDraft("type", event.currentTarget.value as CardType)}
              value={draft.type}
            >
              {cardTypeValues.map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Rarity">
            <select
              onChange={(event) => updateDraft("rarityId", event.currentTarget.value)}
              required
              value={effectiveRarityId}
            >
              {rarities.map((rarity) => (
                <option key={rarity.id} value={rarity.id}>{rarity.name}</option>
              ))}
            </select>
          </Field>
          <div className="full">
            <Field label="Description">
              <textarea
                onChange={(event) => updateDraft("description", event.currentTarget.value)}
                required
                value={draft.description}
              />
            </Field>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        description="Positive integer base values used by the battle engine."
        title="02 · Combat statistics"
      >
        <div className="admin-stat-fields">
          {(["hp", "attack", "defense", "speed"] as const).map((key) => (
            <Field key={key} label={key === "hp" ? "HP" : key}>
              <input
                min="1"
                onChange={(event) => updateDraft(key, event.currentTarget.value)}
                required
                type="number"
                value={draft[key]}
              />
            </Field>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        description="A card may have one passive, skill, and ultimate override."
        title="03 · Ability assignments"
      >
        <div className="form-grid admin-form-grid">
          <Field
            hint={allowsPassive ? "Legendary cards may equip a passive." : "Passive slots are Legendary-only."}
            label="Passive"
          >
            <select
              disabled={!allowsPassive}
              onChange={(event) => onAssignmentChange("passiveId", event.currentTarget.value)}
              value={allowsPassive ? assignment.passiveId : ""}
            >
              <option value="">Inherit default</option>
              {abilitiesByType.PASSIVE.map((ability) => (
                <option key={ability.id} value={ability.id}>{ability.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Skill">
            <select
              onChange={(event) => onAssignmentChange("skillId", event.currentTarget.value)}
              value={assignment.skillId}
            >
              <option value="">Inherit default</option>
              {abilitiesByType.SKILL.map((ability) => (
                <option key={ability.id} value={ability.id}>{ability.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Ultimate">
            <select
              onChange={(event) => onAssignmentChange("ultimateId", event.currentTarget.value)}
              value={assignment.ultimateId}
            >
              <option value="">Inherit default</option>
              {abilitiesByType.ULTIMATE.map((ability) => (
                <option key={ability.id} value={ability.id}>{ability.name}</option>
              ))}
            </select>
          </Field>
          {!createMode ? (
            <div className="admin-field-action">
              <Button
                busy={clearAssignmentPending}
                onClick={() => {
                  if (window.confirm("Clear all three custom ability slots for this card?")) {
                    onClearAssignments();
                  }
                }}
                tone="ghost"
              >
                Clear all overrides
              </Button>
            </div>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection
        description="PNG, JPEG, WEBP, or SVG. Save a new card before uploading."
        title="04 · Artwork"
      >
        {createMode ? (
          <p className="admin-muted-copy">Create the record first; artwork attaches to its generated id.</p>
        ) : (
          <Field label="Upload card image">
            <input
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={uploadPending}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) onUpload(file);
                event.currentTarget.value = "";
              }}
              type="file"
            />
          </Field>
        )}
      </AdminSection>

      {!createMode && currentCard ? (
        <AdminSection
          description="Archiving is reversible. Phoenix exposes no hard-delete route for cards."
          title="05 · Catalog status"
        >
          <div className="admin-danger-row">
            <div>
              <h3>{currentCard.isArchived ? "Restore this card" : "Archive this card"}</h3>
              <p>{currentCard.isArchived ? "Return it to the active catalog." : "Hide it from players while retaining its record."}</p>
            </div>
            <Button
              busy={patchPending}
              onClick={onArchiveStatusChange}
              tone={currentCard.isArchived ? "secondary" : "danger"}
            >
              {currentCard.isArchived ? "Restore card" : "Archive card"}
            </Button>
          </div>
        </AdminSection>
      ) : null}
    </form>
  );
}

export function AdminCardEditorPage() {
  const { id = "new" } = useParams<{ id: string }>();
  const createMode = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const themeName = useOptionalTheme()?.themeName ?? "candy";
  const initializedId = useRef<string | undefined>(undefined);
  const [draft, setDraft] = useState<CardDraft>(blankCardDraft);
  const [assignment, setAssignment] =
    useState<AssignmentDraft>(blankAssignment);
  const [feedback, setFeedback] = useState<string>();
  const cardQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.card(id),
    queryFn: () => webApiClient.adminCard(id),
    enabled: !createMode,
  });
  const rarityQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.rarities,
    queryFn: () => webApiClient.rarities(),
  });
  const abilityQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.abilities,
    queryFn: () => webApiClient.adminAbilities(),
  });
  const abilities = abilityQuery.data?.abilities ?? EMPTY_ADMIN_ABILITIES;
  const abilitiesByType = useMemo(() => {
    const grouped: Record<AdminAbility["type"], AdminAbility[]> = {
      PASSIVE: [],
      SKILL: [],
      ULTIMATE: [],
    };
    for (const ability of abilities) grouped[ability.type].push(ability);
    return grouped;
  }, [abilities]);
  const effectiveRarityId = draft.rarityId || (
    createMode ? (rarityQuery.data?.rarities[0]?.id ?? "") : ""
  );
  const selectedRarity = rarityQuery.data?.rarities.find(
    (rarity) => rarity.id === effectiveRarityId,
  );
  const allowsPassive = selectedRarity?.name === "Legendary";

  useEffect(() => {
    if (createMode) return;
    const card = cardQuery.data;
    if (!card || !abilityQuery.data || initializedId.current === card.id) return;
    initializedId.current = card.id;
    setDraft({
      name: card.name,
      character: card.character,
      description: card.description,
      hp: String(card.hp),
      attack: String(card.attack),
      defense: String(card.defense),
      speed: String(card.speed),
      type: card.type,
      rarityId: card.rarityId,
    });
    const currentAssignment = abilityQuery.data?.cardAbilities.find(
      (entry) => entry.cardId === card.id,
    );
    setAssignment({
      passiveId:
        card.rarityName === "Legendary"
          ? (currentAssignment?.passiveId ?? "")
          : "",
      skillId: currentAssignment?.skillId ?? "",
      ultimateId: currentAssignment?.ultimateId ?? "",
    });
  }, [
    abilityQuery.data,
    cardQuery.data,
    createMode,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...toCardPayload(draft),
        rarityId: effectiveRarityId,
      };
      const saved = createMode
        ? await webApiClient.createAdminCard(payload)
        : await webApiClient.saveAdminCard(id, payload);
      const savedId = createMode
        ? typeof saved.id === "string"
          ? saved.id
          : null
        : id;
      if (!savedId) throw new Error("The saved card did not return an id.");
      await webApiClient.assignAdminCardAbility({
        cardId: savedId,
        passiveId: allowsPassive ? assignment.passiveId || null : null,
        skillId: assignment.skillId || null,
        ultimateId: assignment.ultimateId || null,
      });
      return savedId;
    },
    onSuccess: async (savedId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cards }),
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.card(savedId) }),
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.abilities }),
      ]);
      navigate(`/admin/cards/${savedId}`, { replace: true });
      setFeedback("Card and ability assignments saved.");
    },
  });
  const patchMutation = useMutation({
    mutationFn: (input: { isArchived?: boolean; isFeatured?: boolean }) =>
      webApiClient.updateAdminCard(id, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cards }),
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.card(id) }),
      ]);
      setFeedback("Catalog status updated.");
    },
  });
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file, file.name);
      return webApiClient.uploadAdminCardImage(id, body);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cards }),
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.card(id) }),
      ]);
      setFeedback("Card artwork uploaded.");
    },
  });
  const clearAssignmentMutation = useMutation({
    mutationFn: () => webApiClient.deleteAdminCardAbility(id),
    onSuccess: async () => {
      setAssignment(blankAssignment);
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.abilities });
      setFeedback("All custom ability assignments cleared.");
    },
  });
  const currentCard = cardQuery.data;
  const rarityName = normalizeCardRarityName(
    selectedRarity?.name ?? currentCard?.rarityName,
  );
  const imageAssetId = currentCard?.imageAssetId ?? null;
  const pending =
    saveMutation.isPending ||
    patchMutation.isPending ||
    uploadMutation.isPending ||
    clearAssignmentMutation.isPending;
  const error =
    cardQuery.error ??
    rarityQuery.error ??
    abilityQuery.error ??
    saveMutation.error ??
    patchMutation.error ??
    uploadMutation.error ??
    clearAssignmentMutation.error;
  const loading =
    rarityQuery.isPending ||
    abilityQuery.isPending ||
    (!createMode && cardQuery.isPending);

  function updateDraft<K extends keyof CardDraft>(key: K, value: CardDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(undefined);
    saveMutation.mutate();
  }

  if (
    loading ||
    (
      error &&
      !saveMutation.error &&
      !patchMutation.error &&
      !uploadMutation.error &&
      !clearAssignmentMutation.error
    )
  ) {
    return (
      <AdminDataState
        error={error}
        loading={loading}
        onRetry={() => {
          void cardQuery.refetch();
          void rarityQuery.refetch();
          void abilityQuery.refetch();
        }}
      />
    );
  }

  return (
    <>
      <AdminBackLink to="/admin/cards">Back to cards</AdminBackLink>
      <AdminPageHeader
        actions={
          <Button busy={saveMutation.isPending} form="admin-card-form" type="submit">
            {createMode ? "Create card" : "Save card"}
          </Button>
        }
        eyebrow={createMode ? "New catalog record" : `${rarityName} · ${draft.type}`}
        lede="Identity, combat statistics, artwork, and ability slots save through the current Phoenix contracts."
        title={createMode ? "Create a card." : `Edit ${draft.name || "card"}.`}
      />

      <FormStatus
        message={error ? getErrorMessage(error) : feedback}
        success={Boolean(feedback) && !error}
      />

      <div className="admin-editor-layout">
        <AdminCardEditorForm
          abilitiesByType={abilitiesByType}
          allowsPassive={allowsPassive}
          assignment={assignment}
          clearAssignmentPending={clearAssignmentMutation.isPending}
          createMode={createMode}
          currentCard={currentCard}
          draft={draft}
          effectiveRarityId={effectiveRarityId}
          onArchiveStatusChange={() => {
            if (currentCard) {
              patchMutation.mutate({ isArchived: !currentCard.isArchived });
            }
          }}
          onAssignmentChange={(key, value) =>
            setAssignment((current) => ({ ...current, [key]: value }))
          }
          onClearAssignments={() => clearAssignmentMutation.mutate()}
          onSubmit={handleSubmit}
          onUpload={(file) => uploadMutation.mutate(file)}
          patchPending={patchMutation.isPending}
          rarities={rarityQuery.data?.rarities ?? []}
          updateDraft={updateDraft}
          uploadPending={uploadMutation.isPending}
        />

        <aside className="admin-editor-aside">
          <section className="panel admin-sticky-preview">
            <span className="eyebrow">Player-facing preview</span>
            <div className="admin-card-preview">
              {imageAssetId ? (
                <img
                  alt={`${draft.name || "Card"} illustration`}
                  className="admin-card-preview-image"
                  src={getCardMediaUrl(imageAssetId)}
                />
              ) : (
                <span className="admin-art-placeholder" role="img" aria-label="Artwork missing">
                  <CardsIcon />
                  <b>{(draft.name || "?").slice(0, 1).toUpperCase()}</b>
                </span>
              )}
              <img
                alt=""
                aria-hidden="true"
                className="admin-card-preview-frame"
                src={getCardOutlineSource(themeName, rarityName)}
              />
            </div>
            <div className="admin-preview-copy">
              <small>{rarityName} · {draft.type}</small>
              <h2>{draft.name || "Untitled card"}</h2>
              <p>{draft.character || "Character"}</p>
              <dl>
                <div><dt>HP</dt><dd>{draft.hp || "0"}</dd></div>
                <div><dt>ATK</dt><dd>{draft.attack || "0"}</dd></div>
                <div><dt>DEF</dt><dd>{draft.defense || "0"}</dd></div>
                <div><dt>SPD</dt><dd>{draft.speed || "0"}</dd></div>
              </dl>
            </div>
            {!createMode && currentCard ? (
              <Button
                busy={pending}
                onClick={() => patchMutation.mutate({ isFeatured: !currentCard.isFeatured })}
                tone={currentCard.isFeatured ? "ghost" : "secondary"}
              >
                {currentCard.isFeatured ? "Remove from featured" : "Feature this card"}
              </Button>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  );
}

const MAX_FEATURED_CARDS = 5;

export function AdminFeaturedPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.cards,
    queryFn: () => webApiClient.adminCards(),
  });
  const mutation = useMutation({
    mutationFn: ({ cardId, featured }: { cardId: string; featured: boolean }) =>
      webApiClient.updateAdminCard(cardId, { isFeatured: featured }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cards }),
        queryClient.invalidateQueries({ queryKey: ["featured-cards"] }),
      ]);
    },
  });
  const cards = query.data?.cards ?? EMPTY_ADMIN_CARDS;
  const featured = cards.filter((card) => card.isFeatured && !card.isArchived);
  const normalizedSearch = search.trim().toLowerCase();
  const candidates = cards.filter(
    (card) =>
      !card.isFeatured &&
      !card.isArchived &&
      (!normalizedSearch ||
        `${card.name} ${card.character} ${card.rarityName}`
          .toLowerCase()
          .includes(normalizedSearch)),
  );
  const atLimit = featured.length >= MAX_FEATURED_CARDS;

  return (
    <>
      <AdminPageHeader
        eyebrow="Curated discovery"
        lede="Feature up to five active cards on the player home page. Phoenix stores membership, not a manual display order."
        title="Choose the catalog spotlight."
      />
      <FormStatus
        message={
          mutation.error
            ? getErrorMessage(mutation.error)
            : mutation.isSuccess
              ? "Featured catalog updated."
              : undefined
        }
        success={mutation.isSuccess}
      />
      {query.isPending || query.error ? (
        <AdminDataState
          error={query.error}
          loading={query.isPending}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data ? (
        <div className="admin-featured-layout">
          <AdminSection
            description={`${featured.length} of ${MAX_FEATURED_CARDS} interface slots used`}
            title="Featured now"
          >
            {featured.length ? (
              <div className="admin-featured-list">
                {featured.map((card, index) => (
                  <article className="admin-featured-card" key={card.id}>
                    <span className="admin-featured-index">{String(index + 1).padStart(2, "0")}</span>
                    <AdminCardArtwork card={card} />
                    <div><small>{card.rarityName} · {card.type}</small><h3>{card.name}</h3><p>{card.character}</p></div>
                    <Button
                      busy={mutation.isPending}
                      onClick={() => mutation.mutate({ cardId: card.id, featured: false })}
                      tone="ghost"
                    >
                      Remove
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState copy="Add active cards from the catalog browser." title="No cards are featured" />
            )}
            <p className="admin-muted-copy">
              Ordering follows the backend response because there is no feature-order endpoint.
            </p>
          </AdminSection>
          <AdminSection description="Archived cards cannot be featured." title="Active catalog">
            <label className="admin-search-field">
              <SearchIcon />
              <span className="sr-only">Search cards to feature</span>
              <input
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search active cards"
                type="search"
                value={search}
              />
            </label>
            {atLimit ? (
              <div className="notice notice-info" role="status">
                <strong>All five interface slots are used.</strong>
                <p>Remove one featured card before adding another.</p>
              </div>
            ) : null}
            <div className="admin-candidate-list">
              {candidates.map((card) => (
                <article className="admin-candidate-card" key={card.id}>
                  <AdminCardArtwork card={card} />
                  <div><small>{card.rarityName}</small><h3>{card.name}</h3><p>{card.character}</p></div>
                  <Button
                    busy={mutation.isPending}
                    disabled={atLimit}
                    onClick={() => mutation.mutate({ cardId: card.id, featured: true })}
                    tone="secondary"
                  >
                    Feature
                  </Button>
                </article>
              ))}
            </div>
          </AdminSection>
        </div>
      ) : null}
    </>
  );
}
