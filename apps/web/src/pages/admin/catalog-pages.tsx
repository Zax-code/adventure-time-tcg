import { type FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import type {
  AdminPackDetail,
  AdminPackEditInput,
} from "@adventure-time/api-client";

import { PackIcon, SparklesIcon } from "../../components/icons";
import { Button, EmptyState, Field, FormStatus } from "../../components/ui";
import {
  CARD_RARITY_NAMES,
  getBundledPackArtSource,
  getCardBackSource,
  getCatalogMediaUrl,
  getPackArtSource,
  normalizeMediaUrl,
  type CardRarityName,
} from "../../lib/assets";
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

const GUARANTEED_RARITIES = ["", ...CARD_RARITY_NAMES] as const;

function packArtSource(pack: AdminPackDetail) {
  return getPackArtSource({
    guaranteedRarity: pack.guaranteedRarity,
    name: pack.name,
    packArtAssetId: pack.packArtAssetId,
  }) ?? getBundledPackArtSource({
    guaranteedRarity: pack.guaranteedRarity,
    name: pack.name,
  });
}

export function AdminPacksPage() {
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.packs,
    queryFn: () => webApiClient.adminPacks(),
  });
  const packs = query.data?.packs ?? [];

  return (
    <>
      <AdminPageHeader
        actions={
          <Link className="button button-primary" to="/admin/packs/new">
            Create pack
          </Link>
        }
        eyebrow="Pack economy"
        lede="Price, card count, rarity guarantees, availability, and catalog art stay together as one player-facing promise."
        title="Curate the pack shelf."
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
          <section className="admin-metrics" aria-label="Pack summary">
            <AdminMetric
              label="Active packs"
              note="Available through the pack endpoint"
              tone="success"
              value={packs.filter((pack) => pack.isActive).length}
            />
            <AdminMetric
              label="Inactive"
              note="Draft or seasonal inventory"
              tone="info"
              value={packs.filter((pack) => !pack.isActive).length}
            />
            <AdminMetric
              label="Guaranteed Legendary"
              note="Highest rarity promise"
              tone="accent"
              value={packs.filter((pack) => pack.guaranteedRarity === "Legendary").length}
            />
            <AdminMetric
              label="Custom artwork"
              note="Backed by catalog assets"
              tone="secondary"
              value={packs.filter((pack) => pack.packArtAssetId).length}
            />
          </section>
          <AdminSection
            description="Phoenix exposes create and patch operations; there is no pack-delete endpoint."
            title="Pack records"
          >
            {packs.length ? (
              <div className="admin-pack-list">
                {packs.map((pack) => (
                  <Link
                    aria-label={`Edit ${pack.name}`}
                    className="admin-record admin-pack-record"
                    key={pack.id}
                    to={`/admin/packs/${pack.id}`}
                  >
                    <img alt={`${pack.name} artwork`} src={packArtSource(pack)} />
                    <div className="admin-record-copy">
                      <small>{pack.cardCount} cards · {pack.cost} coins</small>
                      <h3>{pack.name}</h3>
                      <p>{pack.description}</p>
                    </div>
                    <dl className="admin-pack-facts">
                      <div><dt>Guarantee</dt><dd>{pack.guaranteedRarity ?? "None"}</dd></div>
                      <div><dt>Color</dt><dd>{pack.color}</dd></div>
                    </dl>
                    {pack.isActive ? (
                      <AdminStatus tone="active">Active</AdminStatus>
                    ) : (
                      <AdminStatus tone="inactive">Inactive</AdminStatus>
                    )}
                    <span className="admin-record-arrow" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                action={<Link className="button button-primary" to="/admin/packs/new">Create pack</Link>}
                copy="Create the first player-facing pack definition."
                title="No packs yet"
              />
            )}
          </AdminSection>
        </>
      ) : null}
    </>
  );
}

type PackDraft = {
  name: string;
  description: string;
  cardCount: string;
  cost: string;
  color: string;
  isActive: boolean;
  guaranteedRarity: string;
  packArtAssetId: string;
};

const blankPack: PackDraft = {
  name: "",
  description: "",
  cardCount: "5",
  cost: "100",
  color: "#F472B6",
  isActive: true,
  guaranteedRarity: "",
  packArtAssetId: "",
};

function toPackDraft(pack: AdminPackDetail): PackDraft {
  return {
    name: pack.name,
    description: pack.description,
    cardCount: String(pack.cardCount),
    cost: String(pack.cost),
    color: pack.color,
    isActive: pack.isActive,
    guaranteedRarity: pack.guaranteedRarity ?? "",
    packArtAssetId: pack.packArtAssetId ?? "",
  };
}

function toPackPayload(draft: PackDraft): AdminPackEditInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    cardCount: Number(draft.cardCount),
    cost: Number(draft.cost),
    color: draft.color.trim(),
    isActive: draft.isActive,
    guaranteedRarity: draft.guaranteedRarity || null,
    packArtAssetId: draft.packArtAssetId || null,
  };
}

export function AdminPackEditorPage() {
  const { id = "new" } = useParams<{ id: string }>();
  const createMode = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initializedId = useRef<string | undefined>(undefined);
  const [draft, setDraft] = useState<PackDraft>(blankPack);
  const [feedback, setFeedback] = useState<string>();
  const packsQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.packs,
    queryFn: () => webApiClient.adminPacks(),
  });
  const assetsQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.imageAssets,
    queryFn: () => webApiClient.adminImageAssets(),
  });
  const pack = packsQuery.data?.packs.find((entry) => entry.id === id);

  useEffect(() => {
    if (!createMode && pack && initializedId.current !== pack.id) {
      initializedId.current = pack.id;
      setDraft(toPackDraft(pack));
    }
  }, [createMode, pack]);

  const saveMutation = useMutation({
    mutationFn: () =>
      createMode
        ? webApiClient.createAdminPack(toPackPayload(draft))
        : webApiClient.updateAdminPack(id, toPackPayload(draft)),
    onSuccess: async (savedPack) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.packs });
      navigate(`/admin/packs/${savedPack.id}`, { replace: true });
      setFeedback("Pack saved.");
    },
  });
  const error = packsQuery.error ?? assetsQuery.error ?? saveMutation.error;
  const loading = packsQuery.isPending || assetsQuery.isPending;
  const previewPack: AdminPackDetail = {
    id,
    name: draft.name || "Untitled Pack",
    description: draft.description || "A player-facing pack description.",
    cardCount: Number(draft.cardCount) || 0,
    cost: Number(draft.cost) || 0,
    color: draft.color || "#F472B6",
    isActive: draft.isActive,
    guaranteedRarity: draft.guaranteedRarity || null,
    packArtAssetId: draft.packArtAssetId || null,
  };

  function updateDraft<K extends keyof PackDraft>(key: K, value: PackDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(undefined);
    saveMutation.mutate();
  }

  if (loading || (error && !saveMutation.error)) {
    return (
      <AdminDataState
        error={error}
        loading={loading}
        onRetry={() => {
          void packsQuery.refetch();
          void assetsQuery.refetch();
        }}
      />
    );
  }
  if (!createMode && !pack) {
    return (
      <EmptyState
        action={<Link className="button button-secondary" to="/admin/packs">Back to packs</Link>}
        copy="This pack may have been removed from the current catalog source."
        title="Pack not found"
      />
    );
  }

  return (
    <>
      <AdminBackLink to="/admin/packs">Back to packs</AdminBackLink>
      <AdminPageHeader
        actions={<Button busy={saveMutation.isPending} form="admin-pack-form" type="submit">{createMode ? "Create pack" : "Save pack"}</Button>}
        eyebrow={createMode ? "New pack" : draft.isActive ? "Active pack" : "Inactive pack"}
        lede="Everything here maps directly to the pack create or patch endpoint."
        title={createMode ? "Create a pack." : `Edit ${draft.name}.`}
      />
      <FormStatus
        message={error ? getErrorMessage(error) : feedback}
        success={Boolean(feedback) && !error}
      />
      <div className="admin-editor-layout admin-pack-editor">
        <form className="admin-editor-main" id="admin-pack-form" onSubmit={handleSubmit}>
          <AdminSection description="The promise players see on the pack shelf." title="01 · Pack identity">
            <div className="form-grid admin-form-grid">
              <Field label="Name">
                <input onChange={(event) => updateDraft("name", event.currentTarget.value)} required value={draft.name} />
              </Field>
              <Field label="Color">
                <input onChange={(event) => updateDraft("color", event.currentTarget.value)} required value={draft.color} />
              </Field>
              <div className="full">
                <Field label="Description">
                  <textarea onChange={(event) => updateDraft("description", event.currentTarget.value)} required value={draft.description} />
                </Field>
              </div>
            </div>
          </AdminSection>
          <AdminSection description="Price, contents, and guarantee are validated by Phoenix." title="02 · Economy">
            <div className="form-grid admin-form-grid">
              <Field label="Card count">
                <input min="1" onChange={(event) => updateDraft("cardCount", event.currentTarget.value)} required type="number" value={draft.cardCount} />
              </Field>
              <Field label="Cost in coins">
                <input min="0" onChange={(event) => updateDraft("cost", event.currentTarget.value)} required type="number" value={draft.cost} />
              </Field>
              <Field label="Guaranteed rarity">
                <select onChange={(event) => updateDraft("guaranteedRarity", event.currentTarget.value)} value={draft.guaranteedRarity}>
                  {GUARANTEED_RARITIES.map((rarity) => <option key={rarity || "none"} value={rarity}>{rarity || "No guarantee"}</option>)}
                </select>
              </Field>
              <label className="admin-check-field">
                <input checked={draft.isActive} onChange={(event) => updateDraft("isActive", event.currentTarget.checked)} type="checkbox" />
                <span><b>Active</b><small>Show this pack to players.</small></span>
              </label>
            </div>
          </AdminSection>
          <AdminSection description="Choose a reusable catalog asset or keep the bundled fallback." title="03 · Artwork">
            <Field label="Pack art asset">
              <select onChange={(event) => updateDraft("packArtAssetId", event.currentTarget.value)} value={draft.packArtAssetId}>
                <option value="">Bundled themed pack art</option>
                {assetsQuery.data?.imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.id} · {asset.mimeType}</option>)}
              </select>
            </Field>
            <p className="admin-muted-copy"><Link className="text-link" to="/admin/image-assets">Upload a new reusable asset →</Link></p>
          </AdminSection>
          <AdminSection description="Phoenix exposes activation changes, but no pack deletion." title="04 · Lifecycle">
            <div className="admin-notice-row">
              <span className="admin-unavailable-icon" aria-hidden="true"><PackIcon /></span>
              <div><h3>{draft.isActive ? "Players can open this pack" : "This pack is hidden"}</h3><p>Use the Active control above for reversible availability changes.</p></div>
            </div>
          </AdminSection>
        </form>
        <aside className="admin-editor-aside">
          <section className="panel admin-sticky-preview">
            <span className="eyebrow">Pack shelf preview</span>
            <img className="admin-pack-preview-art" alt={`${previewPack.name} artwork`} src={packArtSource(previewPack)} />
            <div className="admin-preview-copy">
              <small>{previewPack.guaranteedRarity ? `${previewPack.guaranteedRarity} guaranteed` : "Standard odds"}</small>
              <h2>{previewPack.name}</h2>
              <p>{previewPack.description}</p>
              <dl>
                <div><dt>Cards</dt><dd>{previewPack.cardCount}</dd></div>
                <div><dt>Coins</dt><dd>{previewPack.cost}</dd></div>
              </dl>
              {previewPack.isActive ? <AdminStatus tone="active">Active</AdminStatus> : <AdminStatus tone="inactive">Inactive</AdminStatus>}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

type CardBackMutationInput = {
  themeName: "candy" | "ice" | "nightosphere";
  rarityName: CardRarityName;
  imageAssetId: string | null;
};

const CARD_BACK_THEMES = ["candy", "ice", "nightosphere"] as const;

export function AdminCardBacksPage() {
  const queryClient = useQueryClient();
  const visualsQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.cardBacks,
    queryFn: () => webApiClient.adminCardBackVisuals(),
  });
  const assetsQuery = useQuery({
    queryKey: ADMIN_QUERY_KEYS.imageAssets,
    queryFn: () => webApiClient.adminImageAssets(),
  });
  const mutation = useMutation({
    mutationFn: (input: CardBackMutationInput) =>
      webApiClient.upsertAdminCardBackVisual(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.cardBacks });
    },
  });
  const error = visualsQuery.error ?? assetsQuery.error ?? mutation.error;
  const loading = visualsQuery.isPending || assetsQuery.isPending;

  if (loading || (error && !mutation.error)) {
    return <AdminDataState error={error} loading={loading} onRetry={() => { void visualsQuery.refetch(); void assetsQuery.refetch(); }} />;
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Theme assets"
        lede="Each theme and rarity can use a catalog upload while retaining the exact bundled fallback from the mobile app."
        title="Curate every card back."
      />
      <FormStatus message={mutation.error ? getErrorMessage(mutation.error) : mutation.isSuccess ? "Card back saved." : undefined} success={mutation.isSuccess} />
      <div className="admin-card-back-themes">
        {CARD_BACK_THEMES.map((themeName) => (
          <AdminSection description="Common through Legendary" key={themeName} title={`${themeName[0].toUpperCase()}${themeName.slice(1)} theme`}>
            <div className="admin-card-back-grid">
              {CARD_RARITY_NAMES.map((rarityName) => {
                const visual = visualsQuery.data?.cardBackVisuals.find((entry) => entry.themeName === themeName && entry.rarityName === rarityName);
                return (
                  <article className="admin-card-back-cell" key={rarityName}>
                    <img alt={`${themeName} ${rarityName} card back`} src={getCardBackSource(themeName, rarityName, visual?.imageAssetId)} />
                    <h3>{rarityName}</h3>
                    <label>
                      <span>Catalog asset</span>
                      <select
                        aria-label={`${themeName} ${rarityName} catalog asset`}
                        disabled={mutation.isPending}
                        onChange={(event) => mutation.mutate({ themeName, rarityName, imageAssetId: event.currentTarget.value || null })}
                        value={visual?.imageAssetId ?? ""}
                      >
                        <option value="">Bundled fallback</option>
                        {assetsQuery.data?.imageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.id}</option>)}
                      </select>
                    </label>
                  </article>
                );
              })}
            </div>
          </AdminSection>
        ))}
      </div>
    </>
  );
}

export function AdminImageAssetsPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const query = useQuery({
    queryKey: ADMIN_QUERY_KEYS.imageAssets,
    queryFn: () => webApiClient.adminImageAssets(),
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose an image before uploading.");
      const body = new FormData();
      body.append("file", file, file.name);
      return webApiClient.uploadAdminImageAsset(body);
    },
    onSuccess: async () => {
      setFile(undefined);
      await queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.imageAssets });
    },
  });
  const assets = query.data?.imageAssets ?? [];

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    upload.mutate();
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Reusable media"
        lede="Upload PNG, JPEG, WEBP, or SVG once, then reuse it for packs and themed card backs."
        title="Manage catalog assets."
      />
      <AdminSection description="The current Phoenix contract supports upload and list; it does not expose delete." title="Upload an asset">
        <FormStatus message={upload.error ? getErrorMessage(upload.error) : upload.isSuccess ? "Image asset uploaded." : undefined} success={upload.isSuccess} />
        <form className="admin-upload-form" onSubmit={handleUpload}>
          <Field hint={file ? `${file.name} · ${Math.ceil(file.size / 1024)} KB` : "Maximum request size is 16 MB."} label="Image file">
            <input
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => setFile(event.currentTarget.files?.[0])}
              required
              type="file"
            />
          </Field>
          <Button busy={upload.isPending} disabled={!file} type="submit">Upload asset</Button>
        </form>
      </AdminSection>
      {query.isPending || query.error ? <AdminDataState error={query.error} loading={query.isPending} onRetry={() => void query.refetch()} /> : null}
      {query.data ? (
        <AdminSection description={`${assets.length} reusable files`} title="Asset catalog">
          {assets.length ? (
            <div className="admin-asset-grid">
              {assets.map((asset) => (
                <article className="admin-asset-card" key={asset.id}>
                  <div className="admin-asset-preview">
                    <img alt={`Catalog asset ${asset.id}`} loading="lazy" src={normalizeMediaUrl(asset.previewUrl, { kind: "catalog" }) ?? getCatalogMediaUrl(asset.id)} />
                  </div>
                  <div><h3>{asset.id}</h3><p>{asset.mimeType}</p><small>{formatAdminDate(asset.insertedAt)}</small></div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState action={<span className="admin-unavailable-icon"><SparklesIcon /></span>} copy="Upload a reusable file above." title="No catalog assets yet" />
          )}
        </AdminSection>
      ) : null}
    </>
  );
}
