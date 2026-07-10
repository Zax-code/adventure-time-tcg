import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import type {
  CollectionResponse,
  GiftsResponse,
  OpenPackResponse,
} from "@adventure-time/api-client";

import { CardArt, PackArt } from "@/components/game-art";
import {
  CardsIcon,
  CheckCircleIcon,
  CoinIcon,
  GiftHeartIcon,
  PackIcon,
  QuestIcon,
  SearchIcon,
  SparklesIcon,
} from "@/components/icons";
import { CardGrid, CardTile, CollectionEntry } from "@/components/cards";
import {
  Button,
  ButtonLink,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FormStatus,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  ProgressBar,
  QueryState,
  SectionHeader,
  SegmentedControl,
  StatCard,
} from "@/components/ui";
import { webApiClient } from "@/lib/api";
import { useAuth } from "@/auth";
import { formValues, readErrorMessage } from "@/lib/form-utils";
import { getQuestDescription, getQuestTitle } from "@/lib/quest-copy";

type CollectionCard = CollectionResponse["cards"][number];

const rarityOrder: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
};

function cardSlug(card: CollectionCard) {
  return card.card.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function invalidatePlayerData(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["home"] }),
    queryClient.invalidateQueries({ queryKey: ["collection"] }),
    queryClient.invalidateQueries({ queryKey: ["packs"] }),
    queryClient.invalidateQueries({ queryKey: ["gifts"] }),
    queryClient.invalidateQueries({ queryKey: ["quests"] }),
  ]);
}

export function HomePage() {
  const { restore } = useAuth();
  const queryClient = useQueryClient();
  const home = useQuery({ queryKey: ["home"], queryFn: () => webApiClient.home() });
  const daily = useQuery({ queryKey: ["daily-claim"], queryFn: () => webApiClient.getDailyClaimStatus() });
  const quests = useQuery({ queryKey: ["quests"], queryFn: () => webApiClient.quests() });
  const featured = useQuery({ queryKey: ["featured-cards"], queryFn: () => webApiClient.featuredCards() });
  const claim = useMutation({
    mutationFn: () => webApiClient.claimDailyReward(),
    onSuccess: async () => {
      await restore();
      void queryClient.invalidateQueries({ queryKey: ["daily-claim"] });
      void queryClient.invalidateQueries({ queryKey: ["home"] });
    },
  });

  if (home.isPending) return <LoadingState label="Opening today's story…" />;
  if (home.isError) return <ErrorState error={home.error} onRetry={() => void home.refetch()} />;

  const completedQuests = quests.data?.quests.filter((quest) => quest.completed).length ?? 0;
  const claimableQuests = quests.data?.quests.filter((quest) => quest.completed && !quest.claimed).length ?? 0;

  return (
    <div className="page-stack home-page">
      <PageHeader
        actions={<ButtonLink to="/collection">Browse collection</ButtonLink>}
        eyebrow="Today's story"
        lede="A calm view of what is ready, what is growing, and where the next small adventure lives."
        title={<>Welcome back, {home.data.user.displayName || "adventurer"}.</>}
      />

      <section className="home-hero panel">
        <div className="home-hero-copy">
          <span className="eyebrow">Daily reward</span>
          <h2>{daily.data?.canClaim ? "A fresh pouch is waiting." : "Today's pouch is already tucked away."}</h2>
          <p>
            {daily.data?.canClaim
              ? `Claim ${daily.data.dailyReward} coins, then choose the chapter you want to play.`
              : "Return after the daily reset for another reward. Your other quests stay open."}
          </p>
          {claim.isError ? <FormStatus message={readErrorMessage(claim.error)} /> : null}
          <div className="button-row">
            <Button
              busy={claim.isPending}
              disabled={!daily.data?.canClaim}
              onClick={() => claim.mutate()}
            >
              <CoinIcon /> Claim {daily.data?.dailyReward ?? "daily"} coins
            </Button>
            <ButtonLink to="/quests" tone="secondary">See today's quests</ButtonLink>
          </div>
        </div>
        <div className="reward-orb" aria-hidden="true">
          <CoinIcon />
          <strong>+{daily.data?.dailyReward ?? 0}</strong>
          <span>coins</span>
        </div>
      </section>

      <div className="stat-grid">
        <StatCard label="Cards collected" value={home.data.collectionStats.totalCards} note="including duplicates" />
        <StatCard label="Unique discoveries" value={home.data.collectionStats.uniqueOwned} tone="secondary" />
        <StatCard label="Catalog complete" value={`${home.data.collectionStats.completionPercentage}%`} tone="accent" />
        <StatCard label="Quests ready" value={claimableQuests} note={`${completedQuests} completed today`} tone="success" />
      </div>

      <Panel>
        <SectionHeader
          action={<Link className="text-link" to="/quests">View all quests →</Link>}
          lede="Choose one thread; progress is saved by the server."
          title="Today's rhythm"
        />
        {quests.isPending ? <LoadingState label="Gathering quests…" /> : null}
        {quests.isError ? <ErrorState error={quests.error} onRetry={() => void quests.refetch()} /> : null}
        {quests.data ? (
          <div className="quest-preview-grid">
            {quests.data.quests.slice(0, 4).map((quest) => (
              <Link className={`quest-preview ${quest.completed ? "complete" : ""}`} key={quest.id} to={quest.actionPath || "/quests"}>
                <span className="quest-preview-icon"><QuestIcon /></span>
                <div><b>{getQuestTitle(quest)}</b><small>{getQuestDescription(quest)}</small></div>
                <ProgressBar label={`${getQuestTitle(quest)} progress`} max={quest.target} value={quest.progress} />
                <strong>+{quest.reward}</strong>
              </Link>
            ))}
          </div>
        ) : null}
      </Panel>

      <Panel>
        <SectionHeader
          action={<Link className="text-link" to="/collection">Browse catalog →</Link>}
          lede="Featured cards are inspiration; ownership is always shown separately."
          title="Catalog spotlights"
        />
        <QueryState query={featured} empty={(data) => data.cards.length === 0}>
          {(data) => <CardGrid>{data.cards.slice(0, 5).map((entry) => <CardTile entry={entry} key={entry.cardId} />)}</CardGrid>}
        </QueryState>
      </Panel>

      <section className="action-grid" aria-label="Quick actions">
        <Link to="/packs"><PackIcon /><span><b>Open a pack</b><small>Turn coins into discoveries</small></span></Link>
        <Link to="/collection"><CardsIcon /><span><b>Fill a collection gap</b><small>{home.data.user.dust} dust available</small></span></Link>
        <Link to="/gifts"><GiftHeartIcon /><span><b>Answer a gift</b><small>Share cards with friends</small></span></Link>
        <Link to="/quests/daily-numbers"><SparklesIcon /><span><b>Play Daily Numbers</b><small>A new puzzle every day</small></span></Link>
      </section>
    </div>
  );
}

type CollectionView = "all" | "owned" | "missing";

export function CollectionPage() {
  const collection = useQuery({ queryKey: ["collection"], queryFn: () => webApiClient.collection() });
  const [view, setView] = useState<CollectionView>("all");
  const [rarity, setRarity] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");

  const filtered = useMemo(() => {
    const cards = collection.data?.cards ?? [];
    const normalizedSearch = search.trim().toLowerCase();
    return [...cards]
      .filter((entry) => (
        (view === "all" || (view === "owned" ? entry.quantity > 0 : entry.quantity === 0))
        && (rarity === "all" || entry.card.rarity.name === rarity)
        && `${entry.card.name} ${entry.card.character} ${entry.card.type}`.toLowerCase().includes(normalizedSearch)
      ))
      .sort((left, right) => {
        if (sort === "quantity") return right.quantity - left.quantity;
        if (sort === "rarity") return (rarityOrder[right.card.rarity.name] ?? 0) - (rarityOrder[left.card.rarity.name] ?? 0);
        return left.card.name.localeCompare(right.card.name);
      });
  }, [collection.data, rarity, search, sort, view]);

  return (
    <div className="page-stack collection-page">
      <PageHeader
        eyebrow="The living catalog"
        lede="Every card is visible. Ownership, duplicates, and collection gaps stay unmistakably separate."
        title="Your collection"
      />
      <QueryState query={collection}>
        {(data) => (
          <>
            <div className="stat-grid compact-stats">
              <StatCard label="Total cards" value={data.stats.totalCards} />
              <StatCard label="Unique owned" value={data.stats.uniqueOwned} tone="success" />
              <StatCard label="Completion" value={`${data.stats.completionPercentage}%`} tone="accent" />
              <StatCard label="Crafting dust" value={data.dust} tone="secondary" />
            </div>
            <Panel className="catalog-toolbar">
              <label className="search-field">
                <SearchIcon />
                <span className="sr-only">Search cards</span>
                <input onChange={(event) => setSearch(event.target.value)} placeholder="Search name, character, or type" type="search" value={search} />
              </label>
              <SegmentedControl
                label="Ownership filter"
                onChange={setView}
                options={[{ label: "All", value: "all" }, { label: "Owned", value: "owned" }, { label: "Missing", value: "missing" }]}
                value={view}
              />
              <label className="compact-select"><span>Rarity</span><select onChange={(event) => setRarity(event.target.value)} value={rarity}><option value="all">All rarities</option>{["Common", "Uncommon", "Rare", "Epic", "Legendary"].map((name) => <option key={name}>{name}</option>)}</select></label>
              <label className="compact-select"><span>Sort</span><select onChange={(event) => setSort(event.target.value)} value={sort}><option value="name">Name</option><option value="rarity">Rarity</option><option value="quantity">Quantity</option></select></label>
            </Panel>
            <div className="result-count"><b>{filtered.length}</b> cards match this view</div>
            {filtered.length ? <CardGrid>{filtered.map((entry) => <CardTile entry={entry} key={entry.cardId} />)}</CardGrid> : <EmptyState title="No cards match" copy="Clear a filter or try a different search." />}
          </>
        )}
      </QueryState>
    </div>
  );
}

export function CardDetailPage() {
  const { restore } = useAuth();
  const { cardId = "" } = useParams();
  const queryClient = useQueryClient();
  const collection = useQuery({ queryKey: ["collection"], queryFn: () => webApiClient.collection() });
  const rarities = useQuery({ queryKey: ["rarities"], queryFn: () => webApiClient.rarities() });
  const [message, setMessage] = useState<string>();
  const card = collection.data?.cards.find((entry) => entry.cardId === cardId || entry.card.id === cardId || cardSlug(entry) === cardId);
  const action = useMutation({
    mutationFn: ({ kind, id }: { kind: "craft" | "recycle"; id: string }) => kind === "craft" ? webApiClient.craftCard(id) : webApiClient.recycleCard(id),
    onSuccess: async (result, variables) => {
      setMessage(variables.kind === "craft" ? "Card crafted and added to your collection." : "Duplicate recycled into dust.");
      await restore();
      await invalidatePlayerData(queryClient);
      void result;
    },
  });

  if (collection.isPending) return <LoadingState label="Finding that card…" />;
  if (collection.isError) return <ErrorState error={collection.error} onRetry={() => void collection.refetch()} />;
  if (!card) return <EmptyState title="Card not found" copy="This card may have moved out of the active catalog." action={<ButtonLink to="/collection">Back to collection</ButtonLink>} />;

  const rarity = rarities.data?.rarities.find((item) => item.name === card.card.rarity.name);
  const canRecycle = card.quantity > 1;
  const canCraft = typeof rarity?.craftCost === "number" && collection.data.dust >= rarity.craftCost;

  return (
    <div className="page-stack card-detail-page">
      <Link className="back-link" to="/collection">← Back to collection</Link>
      <div className="card-detail-grid">
        <div className="card-detail-art"><CardArt card={card.card} /></div>
        <div className="card-detail-copy">
          <span className="rarity-label">{card.card.rarity.name} · {card.card.type}</span>
          <h1>{card.card.name}</h1>
          <p className="card-character">{card.card.character}</p>
          <p>{card.card.description}</p>
          <div className="combat-stat-grid">
            <StatCard label="Health" value={card.card.hp} tone="danger" />
            <StatCard label="Attack" value={card.card.attack} tone="accent" />
            <StatCard label="Defense" value={card.card.defense} tone="info" />
            <StatCard label="Speed" value={card.card.speed} tone="success" />
          </div>
          <Notice title={card.quantity ? `${card.quantity} in your collection` : "Not owned yet"} tone={card.quantity ? "success" : "info"}>
            {card.quantity > 1 ? `${card.quantity - 1} duplicate${card.quantity === 2 ? "" : "s"} can be recycled without losing the card.` : "Crafting spends dust; recycling is available once you have a duplicate."}
          </Notice>
          <FormStatus message={action.isError ? readErrorMessage(action.error) : message} success={!action.isError && Boolean(message)} />
          <div className="button-row">
            <Button busy={action.isPending} disabled={!canCraft} onClick={() => action.mutate({ kind: "craft", id: card.cardId })}>
              Craft for {rarity?.craftCost ?? "—"} dust
            </Button>
            <Button busy={action.isPending} disabled={!canRecycle} onClick={() => action.mutate({ kind: "recycle", id: card.cardId })} tone="secondary">
              Recycle for {rarity?.dustValue ?? "—"} dust
            </Button>
            <ButtonLink to={`/gifts?card=${encodeURIComponent(card.cardId)}`} tone="ghost">Gift this card</ButtonLink>
          </div>
        </div>
      </div>
      <Panel>
        <SectionHeader lede="Abilities are part of the canonical combat definition used by live battles." title="Abilities" />
        <div className="ability-grid">
          {(["passive", "skill", "ultimate"] as const).map((kind) => {
            const ability = card.card.abilities?.[kind];
            return <article key={kind}><span>{kind}</span><h3>{ability?.name || `No ${kind}`}</h3><p>{ability?.description || "This slot is intentionally empty."}</p>{ability && "cost" in ability ? <small>{ability.cost} energy</small> : null}</article>;
          })}
        </div>
      </Panel>
    </div>
  );
}

export function PacksPage() {
  const { restore } = useAuth();
  const queryClient = useQueryClient();
  const packs = useQuery({ queryKey: ["packs"], queryFn: () => webApiClient.packs() });
  const [opened, setOpened] = useState<OpenPackResponse | null>(null);
  const [message, setMessage] = useState<string>();
  const openPack = useMutation({
    mutationFn: (packId: string) => webApiClient.openPack({ packId }),
    onSuccess: async (data) => {
      setOpened(data);
      setMessage(undefined);
      await restore();
      await invalidatePlayerData(queryClient);
    },
    onError: (error) => setMessage(readErrorMessage(error)),
  });

  return (
    <div className="page-stack packs-page">
      <PageHeader
        eyebrow="The pack shelf"
        lede="See the price, contents, guarantee, limits, and availability before spending a single coin."
        title="Choose your next discovery"
      />
      <FormStatus message={message} />
      <QueryState query={packs} empty={(data) => data.packs.length === 0}>
        {(data) => (
          <div className="pack-grid">
            {data.packs.map((pack) => (
              <article className={`pack-card ${pack.isActive ? "" : "inactive"}`} key={pack.id}>
                <div className="pack-visual"><PackArt pack={pack} /></div>
                <div className="pack-copy">
                  <span className="eyebrow">{pack.cardCount} card{pack.cardCount === 1 ? "" : "s"}</span>
                  <h2>{pack.name}</h2>
                  <p>{pack.description}</p>
                  <dl><div><dt>Guarantee</dt><dd>{pack.guaranteedRarity || "Open odds"}</dd></div><div><dt>Availability</dt><dd>{pack.availability?.reason || (pack.availability?.limit ? `${pack.availability.opensRemaining ?? 0} of ${pack.availability.limit} left` : "Always available")}</dd></div></dl>
                  <Button
                    busy={openPack.isPending && openPack.variables === pack.id}
                    disabled={!pack.isActive || pack.availability?.canOpen === false}
                    onClick={() => openPack.mutate(pack.id)}
                  >
                    <CoinIcon /> Open for {pack.cost} coins
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </QueryState>
      <Panel>
        <SectionHeader lede="The server rolls each card and applies the pack guarantee. Recycle values use the same rarity economy as crafting." title="Transparent rarity system" />
        <div className="rarity-strip">{["Common", "Uncommon", "Rare", "Epic", "Legendary"].map((name, index) => <span className={`rarity-${name.toLowerCase()}`} key={name}><i /><b>{name}</b><small>{index === 0 ? "Most frequent" : index === 4 ? "Most scarce" : "Rarer pull"}</small></span>)}</div>
      </Panel>

      <Dialog description="These cards are already saved to your collection." onClose={() => setOpened(null)} open={Boolean(opened)} title={`${opened?.pack.name ?? "Pack"} opened`}>
        {opened ? <div className="pack-result"><div className="pack-result-summary"><CheckCircleIcon /><div><b>{opened.cards.filter((card) => card.isNewForUser).length} new discoveries</b><small>{opened.newBalance} coins remain</small></div></div><CardGrid>{opened.cards.map((card, index) => <article className="revealed-card" key={`${card.id}-${index}`}><CardArt card={card} /><span>{card.isNewForUser ? "New" : "Duplicate"}</span></article>)}</CardGrid><div className="button-row"><Button onClick={() => { const id = opened.pack.id; setOpened(null); openPack.mutate(id); }}>Open another</Button><ButtonLink to="/collection" tone="secondary">View collection</ButtonLink></div></div> : null}
      </Dialog>
    </div>
  );
}

type GiftView = "pending" | "received" | "sent" | "all";

export function GiftsPage() {
  const { restore, user } = useAuth();
  const queryClient = useQueryClient();
  const gifts = useQuery({ queryKey: ["gifts"], queryFn: () => webApiClient.gifts() });
  const users = useQuery({ queryKey: ["gift-users"], queryFn: () => webApiClient.users() });
  const collection = useQuery({ queryKey: ["collection"], queryFn: () => webApiClient.collection() });
  const [view, setView] = useState<GiftView>("pending");
  const [composerOpen, setComposerOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const process = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" }) => webApiClient.processGift({ giftId: id, action }),
    onSuccess: async () => {
      await restore();
      await invalidatePlayerData(queryClient);
    },
  });
  const send = useMutation({
    mutationFn: (input: { cardId: string; toUserId: string; quantity: number; message?: string }) => webApiClient.sendGift(input),
    onSuccess: async () => {
      setSuccess(true);
      setMessage("Gift sent. It will remain pending until your friend answers.");
      setComposerOpen(false);
      await restore();
      await invalidatePlayerData(queryClient);
    },
    onError: (error) => {
      setSuccess(false);
      setMessage(readErrorMessage(error));
    },
  });

  function submitGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event);
    send.mutate({ cardId: String(values.cardId), toUserId: String(values.toUserId), quantity: Number(values.quantity || 1), message: String(values.message || "") || undefined });
  }

  function visibleGifts(data: GiftsResponse) {
    return data.gifts.filter((gift) => {
      if (view === "all") return true;
      if (view === "pending") return gift.status.toLowerCase() === "pending";
      return view === "received" ? gift.toUser.id === user?.id : gift.fromUser.id === user?.id;
    });
  }

  return (
    <div className="page-stack gifts-page">
      <PageHeader
        actions={<Button onClick={() => setComposerOpen(true)}><GiftHeartIcon /> Send a card</Button>}
        eyebrow="Shared discoveries"
        lede="Gifts are explicit, traceable, and reversible until the recipient accepts."
        title="Gifts"
      />
      <FormStatus message={message || (process.isError ? readErrorMessage(process.error) : undefined)} success={success} />
      <SegmentedControl label="Gift view" onChange={setView} options={[{ label: `Pending${gifts.data?.pendingCount ? ` (${gifts.data.pendingCount})` : ""}`, value: "pending" }, { label: "Received", value: "received" }, { label: "Sent", value: "sent" }, { label: "All", value: "all" }]} value={view} />
      <QueryState query={gifts}>
        {(data) => {
          const list = visibleGifts(data);
          return list.length ? <div className="gift-list">{list.map((gift) => <article className="gift-row" key={gift.id}><div className="gift-art"><CardArt card={gift.card} /></div><div className="gift-copy"><span className={`status-chip status-${gift.status.toLowerCase()}`}>{gift.status}</span><h2>{gift.card.name}</h2><p>{gift.quantity} card{gift.quantity === 1 ? "" : "s"} · from <b>{gift.fromUser.displayName || gift.fromUser.email}</b> to <b>{gift.toUser.displayName || gift.toUser.email}</b></p>{gift.message ? <blockquote>“{gift.message}”</blockquote> : null}<small>Sent {new Date(gift.createdAt).toLocaleString()}</small></div>{gift.status.toLowerCase() === "pending" && gift.toUser.id === user?.id ? <div className="gift-actions"><Button busy={process.isPending} onClick={() => process.mutate({ id: gift.id, action: "accept" })}>Accept</Button><Button busy={process.isPending} onClick={() => process.mutate({ id: gift.id, action: "reject" })} tone="ghost">Reject</Button></div> : null}</article>)}</div> : <EmptyState action={<Button onClick={() => setComposerOpen(true)}>Send the first gift</Button>} copy="There are no gifts in this view." title="A quiet mailbox" />;
        }}
      </QueryState>

      <Dialog description="Only owned cards can be sent. The recipient chooses whether to accept." onClose={() => setComposerOpen(false)} open={composerOpen} title="Send a card">
        <form className="stack-form" onSubmit={submitGift}>
          <Field label="Card"><select defaultValue={new URLSearchParams(location.search).get("card") ?? ""} name="cardId" required><option disabled value="">Choose an owned card</option>{collection.data?.cards.flatMap((entry) => entry.quantity > 0 ? [<option key={entry.cardId} value={entry.cardId}>{entry.card.name} · {entry.quantity} owned</option>] : [])}</select></Field>
          <Field label="Recipient"><select name="toUserId" required><option disabled value="">Choose a player</option>{users.data?.users.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email}</option>)}</select></Field>
          <Field hint="You cannot send more copies than you own." label="Quantity"><input defaultValue="1" min="1" name="quantity" required type="number" /></Field>
          <Field hint="Optional · visible only to the recipient" label="Message"><textarea maxLength={280} name="message" placeholder="A note for this card's next chapter" /></Field>
          <Button busy={send.isPending} type="submit">Send gift</Button>
        </form>
      </Dialog>
    </div>
  );
}
