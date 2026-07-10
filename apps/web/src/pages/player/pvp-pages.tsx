import {
  type FormEvent,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import type {
  PvpAction,
  PvpEndTurnInput,
  PvpMatch,
  PvpMatchDetailResponse,
  PvpParticipantBattleState,
  PvpPlayerState,
  PvpSpectateBattleState,
  PvpUnitState,
} from "@adventure-time/api-client";
import { pvpStatusNameValues } from "@adventure-time/api-client";
import {
  applyEventsToState,
  type BattleState,
} from "@adventure-time/game-engine";

import { useAuth } from "@/auth";
import { CardArt } from "@/components/game-art";
import {
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SwordsIcon,
  TrophyIcon,
  UserPlusIcon,
  ZapIcon,
} from "@/components/icons";
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
  QueryState,
  SectionHeader,
  SegmentedControl,
  StatCard,
} from "@/components/ui";
import { webApiClient } from "@/lib/api";
import { normalizeMediaUrl } from "@/lib/assets";
import { formValues, readErrorMessage } from "@/lib/form-utils";
import {
  buildPvpAction,
  getBattleActionOptions,
  prepareCopyFollowUp,
  type BattleActionOption,
  type PreparedBattleAction,
} from "@/pages/player/pvp-actions";

function matchOpponent(match: PvpMatch, userId?: string) {
  if (userId === match.inviterId) return match.inviteeName || "Invited player";
  return match.inviterName || "Inviting player";
}

function matchResult(match: PvpMatch, userId?: string) {
  if (!match.winnerId) return match.completionReason === "DRAW" ? "Draw" : match.status.replaceAll("_", " ");
  return match.winnerId === userId ? "Victory" : "Defeat";
}

function invalidatePvp(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pvp-invites"] }),
    queryClient.invalidateQueries({ queryKey: ["pvp-matches"] }),
    queryClient.invalidateQueries({ queryKey: ["pvp-history"] }),
  ]);
}

export function replayStateAtCursor(
  replay: NonNullable<PvpMatchDetailResponse["replay"]>,
  eventCount: number,
): BattleState | null {
  const initialState = replay.initialState;
  if (!initialState || typeof initialState !== "object" || Array.isArray(initialState)) {
    return null;
  }

  const candidate = initialState as unknown as BattleState;
  if (!Array.isArray(candidate.players) || candidate.players.length !== 2) {
    return null;
  }

  return applyEventsToState(
    { ...candidate, log: [] },
    replay.log.slice(0, eventCount) as BattleState["log"],
  );
}

export function PvpLobbyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invites = useQuery({ queryKey: ["pvp-invites"], queryFn: () => webApiClient.pvpInvites() });
  const matches = useQuery({ queryKey: ["pvp-matches"], queryFn: () => webApiClient.pvpMatches() });
  const loadouts = useQuery({ queryKey: ["pvp-loadouts"], queryFn: () => webApiClient.pvpLoadouts() });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState<PvpMatch>();
  const [acceptLoadoutId, setAcceptLoadoutId] = useState("");
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const invite = useMutation({
    mutationFn: ({ email, cardIds }: { email: string; cardIds: string[] }) => webApiClient.createPvpInvite(email, cardIds),
    onSuccess: async () => {
      setInviteOpen(false);
      setSuccess(true);
      setMessage("Battle invitation sent.");
      await invalidatePvp(queryClient);
    },
    onError: (error) => { setSuccess(false); setMessage(readErrorMessage(error)); },
  });
  const response = useMutation<unknown, Error, { match: PvpMatch; action: "accept" | "decline" | "cancel"; cards?: string[] }>({
    mutationFn: ({ match, action, cards }: { match: PvpMatch; action: "accept" | "decline" | "cancel"; cards?: string[] }) => action === "accept" ? webApiClient.acceptPvpMatch(match.id, cards ?? []) : action === "decline" ? webApiClient.declinePvpMatch(match.id) : webApiClient.cancelPvpInvite(match.id),
    onSuccess: async () => {
      setAcceptingInvite(undefined);
      setAcceptLoadoutId("");
      await invalidatePvp(queryClient);
    },
  });

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event);
    const selected = loadouts.data?.loadouts.find((loadout) => loadout.id === values.loadoutId);
    if (!selected) { setMessage("Choose a valid six-card loadout first."); return; }
    invite.mutate({ email: String(values.email), cardIds: selected.cardIds });
  }

  const pendingInvites = invites.data?.invites ?? [];
  const activeMatches = matches.data?.matches.filter((match) => match.status === "IN_PROGRESS") ?? [];
  const validLoadouts = loadouts.data?.loadouts.filter((loadout) => loadout.invalidCardIds.length === 0) ?? [];

  function openAcceptDialog(match: PvpMatch) {
    setAcceptingInvite(match);
    setAcceptLoadoutId(validLoadouts[0]?.id ?? "");
  }

  function submitAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptingInvite) return;
    const selected = validLoadouts.find((loadout) => loadout.id === acceptLoadoutId);
    if (!selected) {
      setMessage("Repair or create a valid six-card loadout before accepting this invitation.");
      return;
    }
    response.mutate({ match: acceptingInvite, action: "accept", cards: selected.cardIds });
  }

  return (
    <div className="page-stack pvp-lobby-page">
      <PageHeader
        actions={<div className="button-row"><Button onClick={() => setInviteOpen(true)}><UserPlusIcon /> Invite a friend</Button><ButtonLink to="/pvp/loadouts" tone="secondary">Build loadouts</ButtonLink></div>}
        eyebrow="Friendly battles"
        lede="Invite people you know, return to live matches, or watch another duel. There is no public ladder."
        title="PvP lobby"
      />
      <FormStatus message={message || (response.isError ? readErrorMessage(response.error) : undefined)} success={success} />
      <div className="stat-grid compact-stats"><StatCard label="Active battles" value={activeMatches.length} tone="accent" /><StatCard label="Pending invites" value={pendingInvites.length} tone="secondary" /><StatCard label="Saved loadouts" value={loadouts.data?.loadouts.length ?? "—"} tone="info" /><StatCard label="Completed" value={matches.data?.matches.filter((match) => match.status === "COMPLETED").length ?? "—"} tone="success" /></div>
      <Panel>
        <SectionHeader action={<Link className="text-link" to="/pvp/history">Full history →</Link>} lede="The server remains the authority on turns and battle state." title="Live battles" />
        {matches.isPending ? <LoadingState label="Looking for active battles…" /> : activeMatches.length ? <div className="battle-list">{activeMatches.map((match) => <article key={match.id}><span className="battle-avatar"><SwordsIcon /></span><div><span>Turn {match.currentTurn ?? "—"}</span><h3>{matchOpponent(match, user?.id)}</h3><small>{match.currentPlayerId === user?.id ? "Your turn" : "Waiting for opponent"}</small></div><ButtonLink to={`/pvp/match/${match.id}`}>Continue battle</ButtonLink></article>)}</div> : <EmptyState action={<Button onClick={() => setInviteOpen(true)}>Invite a friend</Button>} copy="Active battles will stay here until they are completed." title="No battle needs your attention" />}
      </Panel>
      <Panel>
        <SectionHeader lede="Incoming invites can be accepted with any valid saved loadout. Outgoing invites can be withdrawn." title="Invitations" />
        {invites.isPending ? <LoadingState label="Checking invitations…" /> : pendingInvites.length ? <div className="invite-list">{pendingInvites.map((match) => { const incoming = match.inviteeId === user?.id; return <article key={match.id}><div><span>{incoming ? "From" : "To"}</span><h3>{matchOpponent(match, user?.id)}</h3><small>{new Date(match.createdAt).toLocaleString()}</small></div><div className="button-row">{incoming ? <><Button busy={response.isPending} disabled={!validLoadouts.length} onClick={() => openAcceptDialog(match)}>Accept{validLoadouts.length ? " with a loadout" : " · repair a loadout first"}</Button><Button busy={response.isPending} onClick={() => response.mutate({ match, action: "decline" })} tone="ghost">Decline</Button></> : <Button busy={response.isPending} onClick={() => response.mutate({ match, action: "cancel" })} tone="ghost">Withdraw</Button>}</div></article>; })}</div> : <p className="quiet-copy">No invitations are waiting.</p>}
      </Panel>
      <section className="pvp-link-grid"><Link to="/pvp/spectate"><EyeIcon /><b>Watch live matches</b><span>Read-only spectator view</span></Link><Link to="/pvp/mechanics"><SwordsIcon /><b>Learn the mechanics</b><span>Turns, energy, swaps, and targeting</span></Link><Link to="/pvp/reference"><ZapIcon /><b>Open combat reference</b><span>Types, statuses, and terminology</span></Link></section>

      <Dialog description="Invitations are private and require a saved six-card team." onClose={() => setInviteOpen(false)} open={inviteOpen} title="Invite a friend">
        <form className="stack-form" onSubmit={submitInvite}>
          <Field label="Friend's email"><input autoComplete="email" name="email" required type="email" /></Field>
          <Field hint="Create or repair a loadout if this list is empty." label="Loadout"><select name="loadoutId" required><option disabled value="">Choose six cards</option>{loadouts.data?.loadouts.flatMap((loadout) => loadout.invalidCardIds.length ? [] : [<option key={loadout.id} value={loadout.id}>{loadout.name}</option>])}</select></Field>
          <Button busy={invite.isPending} type="submit">Send invitation</Button>
        </form>
      </Dialog>
      <Dialog description="Choose the six-card team that will enter this battle." onClose={() => setAcceptingInvite(undefined)} open={Boolean(acceptingInvite)} title="Accept invitation">
        <form className="stack-form" onSubmit={submitAccept}>
          <Field hint={validLoadouts.length ? "Only valid, currently owned teams are shown." : "Repair an existing team or build a new one before accepting."} label="Battle loadout">
            <select aria-label="Battle loadout" onChange={(event) => setAcceptLoadoutId(event.target.value)} required value={acceptLoadoutId}>
              <option disabled value="">Choose six cards</option>
              {validLoadouts.map((loadout) => <option key={loadout.id} value={loadout.id}>{loadout.name}</option>)}
            </select>
          </Field>
          <div className="button-row">
            <Button busy={response.isPending} disabled={!validLoadouts.length || !acceptLoadoutId} type="submit">Accept invitation</Button>
            <Button onClick={() => setAcceptingInvite(undefined)} tone="ghost" type="button">Cancel</Button>
          </div>
          {!validLoadouts.length ? <ButtonLink to="/pvp/loadouts" tone="secondary">Repair loadouts</ButtonLink> : null}
        </form>
      </Dialog>
    </div>
  );
}

export function PvpLoadoutsPage() {
  const queryClient = useQueryClient();
  const loadouts = useQuery({ queryKey: ["pvp-loadouts"], queryFn: () => webApiClient.pvpLoadouts() });
  const collection = useQuery({ queryKey: ["collection"], queryFn: () => webApiClient.collection() });
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const save = useMutation({
    mutationFn: () => editingId ? webApiClient.updatePvpLoadout(editingId, name, selected) : webApiClient.createPvpLoadout(name, selected),
    onSuccess: async () => { setMessage("Loadout saved."); setName(""); setSelected([]); setEditingId(undefined); await queryClient.invalidateQueries({ queryKey: ["pvp-loadouts"] }); },
  });
  const remove = useMutation({ mutationFn: (id: string) => webApiClient.deletePvpLoadout(id), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pvp-loadouts"] }) });

  const owned = collection.data?.cards.filter((entry) => entry.quantity > 0) ?? [];
  function toggle(cardId: string) { setSelected((current) => current.includes(cardId) ? current.filter((id) => id !== cardId) : current.length < 6 ? [...current, cardId] : current); }

  return (
    <div className="page-stack loadouts-page">
      <PageHeader actions={<ButtonLink to="/pvp" tone="ghost">Back to lobby</ButtonLink>} eyebrow="Team builder" lede="A legal loadout contains six distinct owned cards. The server validates every team before a battle begins." title="PvP loadouts" />
      <div className="loadout-layout">
        <Panel className="loadout-builder">
          <SectionHeader lede={`${selected.length} of 6 cards selected`} title={editingId ? "Edit loadout" : "Build a loadout"} />
          <Field label="Loadout name"><input maxLength={48} onChange={(event) => setName(event.target.value)} placeholder="A memorable team name" value={name} /></Field>
          {collection.isPending ? <LoadingState label="Loading owned cards…" /> : <div className="loadout-card-picker">{owned.map((entry) => <button aria-pressed={selected.includes(entry.cardId)} key={entry.cardId} onClick={() => toggle(entry.cardId)} type="button"><CardArt card={entry.card} /><span><b>{entry.card.name}</b><small>{entry.card.type} · {entry.card.rarity.name}</small></span>{selected.includes(entry.cardId) ? <i>{selected.indexOf(entry.cardId) + 1}</i> : null}</button>)}</div>}
          <FormStatus message={save.isError ? readErrorMessage(save.error) : message} success={save.isSuccess} />
          <div className="button-row"><Button busy={save.isPending} disabled={selected.length !== 6 || !name.trim()} onClick={() => save.mutate()}>{editingId ? "Update loadout" : "Save loadout"}</Button>{editingId ? <Button onClick={() => { setEditingId(undefined); setSelected([]); setName(""); }} tone="ghost">Cancel edit</Button> : null}</div>
        </Panel>
        <aside className="saved-loadouts">
          <SectionHeader title="Saved teams" />
          {loadouts.isPending ? <LoadingState /> : loadouts.data?.loadouts.length ? loadouts.data.loadouts.map((loadout) => <article className={loadout.invalidCardIds.length ? "invalid" : ""} key={loadout.id}><div><span>{loadout.invalidCardIds.length ? "Needs repair" : "Ready"}</span><h3>{loadout.name}</h3><small>{loadout.cards.length} cards · updated {new Date(loadout.updatedAt).toLocaleDateString()}</small></div><div className="loadout-mini-cards">{loadout.cards.map((card) => <CardArt card={card} key={card.id} />)}</div><div className="button-row"><Button onClick={() => { setEditingId(loadout.id); setName(loadout.name); setSelected(loadout.cardIds); }} tone="secondary">Edit</Button><Button busy={remove.isPending} onClick={() => remove.mutate(loadout.id)} tone="ghost">Delete</Button></div></article>) : <EmptyState copy="Your first valid six-card team will appear here." title="No saved loadouts" />}
        </aside>
      </div>
    </div>
  );
}

function UnitCard({
  disabled,
  onClick,
  selected,
  targetable = false,
  unit,
}: {
  disabled?: boolean;
  onClick?: () => void;
  selected?: boolean;
  targetable?: boolean;
  unit: PvpUnitState;
}) {
  const imageSource = normalizeMediaUrl(unit.imageUrl, { kind: "card" });
  const content = <><div className="battle-unit-art">{imageSource ? <img alt="" src={imageSource} /> : <span>{unit.name.slice(0, 1)}</span>}</div><div className="battle-unit-copy"><span>{unit.rarity} · {unit.type}</span><b>{unit.name}</b><div className="hp-bar"><progress max={unit.maxHp} value={Math.max(0, unit.hp)} /><small>{unit.hp}/{unit.maxHp} HP</small></div><div className="unit-stats"><span>ATK {unit.attack}</span><span>DEF {unit.defense}</span><span>SPD {unit.speed}</span></div>{unit.statuses.length ? <div className="status-stack">{unit.statuses.map((status, index) => <i key={`${status.name}-${index}`}>{status.name} · {status.duration}</i>)}</div> : null}</div></>;
  return onClick ? <button aria-label={`${unit.name}${targetable ? ", legal selection" : ""}`} aria-pressed={selected} className={`battle-unit ${unit.knockedOut ? "ko" : ""} ${targetable ? "targetable" : ""}`.trim()} disabled={disabled ?? unit.knockedOut} onClick={onClick} type="button">{content}</button> : <article className={`battle-unit ${unit.knockedOut ? "ko" : ""}`}>{content}</article>;
}

function BattleSide({
  benchSelectableIds,
  label,
  onBench,
  onUnit,
  player,
  selectedIds,
  unitSelectableIds,
}: {
  benchSelectableIds?: ReadonlySet<string>;
  label: string;
  onBench?: (unit: PvpUnitState) => void;
  onUnit?: (unit: PvpUnitState) => void;
  player: PvpPlayerState;
  selectedIds?: ReadonlySet<string>;
  unitSelectableIds?: ReadonlySet<string>;
}) {
  return <section className="battle-side"><header><div><span>{label}</span><h2>{player.name}</h2></div><div className="energy-pips" aria-label={`${player.energy} of ${player.maxEnergy} energy`}>{Array.from({ length: player.maxEnergy }, (_, index) => <i className={index < player.energy ? "filled" : ""} key={index} />)}</div></header><div className="active-units">{player.units.map((unit) => { const selectable = Boolean(onUnit) && (!unitSelectableIds || unitSelectableIds.has(unit.instanceId)); return <UnitCard disabled={selectable && unitSelectableIds ? false : undefined} key={unit.instanceId} onClick={selectable ? () => onUnit?.(unit) : undefined} selected={selectedIds?.has(unit.instanceId)} targetable={Boolean(unitSelectableIds?.has(unit.instanceId))} unit={unit} />; })}</div>{player.bench.length ? <div className="bench"><span>Bench</span>{player.bench.map((unit) => { const selectable = Boolean(onBench) && (!benchSelectableIds || benchSelectableIds.has(unit.instanceId)); return <UnitCard disabled={selectable && benchSelectableIds ? false : undefined} key={unit.instanceId} onClick={selectable ? () => onBench?.(unit) : undefined} selected={selectedIds?.has(unit.instanceId)} targetable={Boolean(benchSelectableIds?.has(unit.instanceId))} unit={unit} />; })}</div> : null}</section>;
}

function BattleLog({ state }: { state: PvpParticipantBattleState | PvpSpectateBattleState }) {
  return <Panel className="battle-log"><SectionHeader lede={`${state.log.length} server-recorded events`} title="Battle log" />{state.log.length ? <ol>{state.log.slice(-24).reverse().map((event) => <li key={event.seq}><span>#{event.seq} · turn {event.turn}</span><b>{event.type.replaceAll("_", " ")}</b><code>{JSON.stringify(event.payload)}</code></li>)}</ol> : <p>The first action will appear here.</p>}</Panel>;
}

function livingUnitIds(units: PvpUnitState[]) {
  const ids = new Set<string>();
  for (const unit of units) {
    if (unit.hp > 0) ids.add(unit.instanceId);
  }
  return ids;
}

type BattleMutation =
  | { type: "action"; action: PvpAction }
  | { type: "end-turn"; input?: PvpEndTurnInput }
  | { type: "concede" };

interface BattleSelectionState {
  actorId?: string;
  targeting?: PreparedBattleAction;
  swapMode: boolean;
  swapActiveId?: string;
  swapBenchId?: string;
}

function emptyBattleSelection(): BattleSelectionState {
  return { swapMode: false };
}

function BattleActionChoice({
  busy,
  onChoose,
  option,
}: {
  busy: boolean;
  onChoose: (option: BattleActionOption) => void;
  option: BattleActionOption;
}) {
  return (
    <div className="battle-action-choice">
      <Button
        aria-label={`${option.label}, ${option.cost} energy`}
        busy={busy}
        className="battle-action-button"
        disabled={Boolean(option.disabledReason)}
        onClick={() => onChoose(option)}
        title={option.disabledReason ?? option.description}
        tone={option.slot === "basic" ? "primary" : "secondary"}
      >
        {option.slot === "basic" ? <SwordsIcon /> : <ZapIcon />}
        <b>{option.label}</b>
        <i>{option.cost} EN</i>
      </Button>
      <small>{option.disabledReason ?? option.description}</small>
    </div>
  );
}

export function PvpMatchPage() {
  const { matchId = "" } = useParams();
  const queryClient = useQueryClient();
  const match = useQuery({ queryKey: ["pvp-match", matchId], queryFn: () => webApiClient.pvpMatch(matchId), refetchInterval: 4_000 });
  const [selection, setSelection] = useState<BattleSelectionState>(emptyBattleSelection);
  const { actorId, targeting, swapMode, swapActiveId, swapBenchId } = selection;
  const [confirmEndTurn, setConfirmEndTurn] = useState(false);
  const [confirmConcede, setConfirmConcede] = useState(false);
  const command = useMutation<unknown, Error, BattleMutation>({
    mutationFn: (input) => {
      if (input.type === "action") return webApiClient.actPvpMatch(matchId, input.action);
      if (input.type === "end-turn") return webApiClient.endTurnPvpMatch(matchId, input.input);
      return webApiClient.concedePvpMatch(matchId);
    },
    onSuccess: async () => {
      setSelection(emptyBattleSelection());
      setConfirmEndTurn(false);
      setConfirmConcede(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pvp-match", matchId] }),
        queryClient.invalidateQueries({ queryKey: ["pvp-matches"] }),
      ]);
    },
  });

  function submitPrepared(prepared: PreparedBattleAction, targetInstanceId?: string) {
    const action = buildPvpAction(prepared, targetInstanceId);
    if (action) command.mutate({ type: "action", action });
  }

  function chooseTarget(instanceId: string) {
    const state = match.data?.battleState;
    if (!state || !targeting || command.isPending) return;

    if (targeting.stage === "copy-source") {
      const followUp = prepareCopyFollowUp(state, targeting, instanceId);
      if (!followUp) return;
      if (followUp.requiresTargetSelection) {
        setSelection((current) => ({ ...current, targeting: followUp }));
      } else {
        submitPrepared(followUp);
      }
      return;
    }

    submitPrepared(targeting, instanceId);
  }

  function chooseAction(option: BattleActionOption) {
    if (!option.prepared || option.disabledReason || command.isPending) return;
    setSelection((current) => ({
      ...current,
      targeting: option.prepared?.requiresTargetSelection
        ? option.prepared
        : undefined,
      swapMode: false,
      swapActiveId: undefined,
      swapBenchId: undefined,
    }));
    if (option.prepared.requiresTargetSelection) {
      return;
    } else {
      submitPrepared(option.prepared);
    }
  }

  function submitSwap(activeInstanceId: string, benchInstanceId: string) {
    command.mutate({
      type: "end-turn",
      input: { swap: { activeInstanceId, benchInstanceId } },
    });
  }

  function chooseSwapActive(instanceId: string) {
    if (swapBenchId) submitSwap(instanceId, swapBenchId);
    else setSelection((current) => ({ ...current, swapActiveId: instanceId }));
  }

  function chooseSwapBench(instanceId: string) {
    if (swapActiveId) submitSwap(swapActiveId, instanceId);
    else setSelection((current) => ({ ...current, swapBenchId: instanceId }));
  }

  if (match.isPending) return <LoadingState label="Reconstructing the battle…" />;
  if (match.isError) return <ErrorState error={match.error} onRetry={() => void match.refetch()} />;
  if (!match.data.battleState) return <EmptyState action={<ButtonLink to="/pvp">Back to lobby</ButtonLink>} copy="The invitation may still need to be accepted, or this battle has no active state." title="Battle board unavailable" />;
  const state = match.data.battleState;
  const me = state.players.find((player) => player.userId === state.myUserId) ?? state.players[0];
  const opponent = state.players.find((player) => player.userId !== state.myUserId) ?? state.players[1];
  const actor = me.units.find((unit) => unit.instanceId === actorId);
  const actionOptions = getBattleActionOptions(state, actorId);
  const isActiveTurn = state.isMyTurn && state.phase === "active";
  const canAct = isActiveTurn && !command.isPending;
  const legalTargetIds = new Set(targeting?.validTargetIds ?? []);
  const livingActiveIds = livingUnitIds(me.units);
  const livingBenchIds = livingUnitIds(me.bench);
  const selectedIds = new Set([
    actorId,
    targeting?.sourceInstanceId,
    swapActiveId,
    swapBenchId,
  ].filter((value): value is string => Boolean(value)));
  const copiedAbilityName = targeting?.copiedAbilityKey
    ? state.abilityDefinitions?.[targeting.copiedAbilityKey]?.name
    : undefined;

  function selectActor(unit: PvpUnitState) {
    setSelection({ actorId: unit.instanceId, swapMode: false });
  }

  function beginSwap() {
    setSelection({
      swapMode: true,
      swapActiveId: actor && actor.hp > 0 ? actor.instanceId : undefined,
    });
  }

  function cancelSelection() {
    setSelection({
      actorId: swapMode ? swapActiveId : actorId,
      swapMode: false,
    });
  }

  const commandTitle = state.phase === "ended"
    ? state.winnerId === state.myUserId ? "Victory" : "Battle complete"
    : !state.isMyTurn
      ? "Waiting for the opponent."
      : targeting
        ? `Choose ${targeting.targetLabel}.`
        : swapMode
          ? swapActiveId
            ? "Choose a living bench unit to swap in."
            : swapBenchId
              ? "Choose a living active unit to swap out."
              : "Choose one active unit and one bench unit."
          : actor
            ? `Choose ${actor.name}'s action.`
            : "Choose an active ally.";

  const commandCopy = targeting
    ? `${targeting.validTargetIds.length} legal selection${targeting.validTargetIds.length === 1 ? "" : "s"} glow on the board.${copiedAbilityName ? ` Copying ${copiedAbilityName}.` : ""}`
    : swapMode
      ? "A legal swap ends the turn immediately. Knocked-out units cannot swap."
      : actor
        ? "Actions without a manual target resolve immediately. Targeted actions highlight every legal active, bench, enemy, revive, or copy-source choice."
        : "Select a living active unit to inspect its legal commands, costs, cooldowns, and targets.";

  return (
    <div className="page-stack battle-page">
      <PageHeader actions={<div className="turn-indicator"><ClockIcon /><span>Turn {state.turn}</span><b>{state.phase === "ended" ? "Battle complete" : state.isMyTurn ? "Your turn" : `${opponent.name}'s turn`}</b></div>} eyebrow="Live battle" lede="Every action is validated and persisted by the combat server." title={`${me.name} vs ${opponent.name}`} />
      <div className={`battle-board ${targeting ? "choosing-target" : ""}`.trim()}>
        <BattleSide
          label="Opponent"
          onUnit={canAct && targeting ? (unit) => chooseTarget(unit.instanceId) : undefined}
          player={opponent}
          selectedIds={selectedIds}
          unitSelectableIds={targeting ? legalTargetIds : undefined}
        />
        <div className="battle-divider"><SwordsIcon /><span>Turn {state.turn}</span></div>
        <BattleSide
          benchSelectableIds={targeting ? legalTargetIds : swapMode ? livingBenchIds : undefined}
          label="Your team"
          onBench={canAct && (targeting || swapMode) ? (unit) => targeting ? chooseTarget(unit.instanceId) : chooseSwapBench(unit.instanceId) : undefined}
          onUnit={canAct ? (unit) => targeting ? chooseTarget(unit.instanceId) : swapMode ? chooseSwapActive(unit.instanceId) : selectActor(unit) : undefined}
          player={me}
          selectedIds={selectedIds}
          unitSelectableIds={targeting ? legalTargetIds : swapMode ? livingActiveIds : undefined}
        />
      </div>
      <Panel className="battle-actions">
        <div className="battle-command-copy"><span className="eyebrow">Command bar</span><h2>{commandTitle}</h2><p>{commandCopy}</p></div>
        <div className="battle-command-stack">
          {isActiveTurn && actor && !targeting && !swapMode ? <div className="battle-action-options">{actionOptions.map((option) => <BattleActionChoice busy={command.isPending && command.variables?.type === "action"} key={option.slot} onChoose={chooseAction} option={option} />)}</div> : null}
          <div className="button-row battle-turn-actions">
            {targeting || swapMode ? <Button disabled={command.isPending} onClick={cancelSelection} tone="ghost">Cancel selection</Button> : <>
              <Button busy={command.isPending && command.variables?.type === "action" && command.variables.action.kind === "pass"} disabled={!canAct} onClick={() => command.mutate({ type: "action", action: { kind: "pass" } })} tone="ghost">Pass action</Button>
              <Button disabled={!canAct || livingActiveIds.size === 0 || livingBenchIds.size === 0} onClick={beginSwap} tone="ghost">Swap &amp; end turn</Button>
              <Button busy={command.isPending && command.variables?.type === "end-turn"} disabled={!canAct} onClick={() => me.energy > 0 ? setConfirmEndTurn(true) : command.mutate({ type: "end-turn" })} tone="ghost">End turn</Button>
            </>}
            <Button disabled={state.phase === "ended" || command.isPending} onClick={() => setConfirmConcede(true)} tone="danger">Concede</Button>
          </div>
          <FormStatus message={command.isError ? readErrorMessage(command.error) : undefined} />
        </div>
      </Panel>
      <BattleLog state={state} />
      <Dialog description={`You still have ${me.energy} energy. Ending the turn now gives up the rest of it.`} onClose={() => setConfirmEndTurn(false)} open={confirmEndTurn} title="End this turn?"><div className="button-row"><Button busy={command.isPending} onClick={() => command.mutate({ type: "end-turn" })}>End turn now</Button><Button onClick={() => setConfirmEndTurn(false)} tone="ghost">Keep acting</Button></div></Dialog>
      <Dialog description="This immediately ends the match and records a loss." onClose={() => setConfirmConcede(false)} open={confirmConcede} title="Concede this battle?"><div className="button-row"><Button busy={command.isPending} onClick={() => command.mutate({ type: "concede" })} tone="danger">Yes, concede</Button><Button onClick={() => setConfirmConcede(false)} tone="ghost">Keep battling</Button></div></Dialog>
    </div>
  );
}

export function PvpHistoryPage() {
  const { user } = useAuth();
  const history = useQuery({ queryKey: ["pvp-history"], queryFn: () => webApiClient.pvpHistory() });
  return (
    <div className="page-stack history-page">
      <PageHeader actions={<ButtonLink to="/pvp" tone="ghost">Back to lobby</ButtonLink>} eyebrow="Battle history" lede="Completed matches remain visible with their outcome, completion reason, and replay availability." title="Your past duels" />
      <QueryState query={history} empty={(data) => data.matches.length === 0}>
        {(data) => <><div className="stat-grid compact-stats"><StatCard label="Wins" value={data.stats?.wins ?? 0} tone="success" /><StatCard label="Losses" value={data.stats?.losses ?? 0} tone="danger" /><StatCard label="Draws" value={data.stats?.draws ?? 0} tone="secondary" /><StatCard label="Win rate" value={`${data.stats?.winRate ?? 0}%`} tone="accent" /></div><div className="match-history-list">{data.matches.map((match) => <article key={match.id}><span className={`match-result result-${matchResult(match, user?.id).toLowerCase()}`}>{matchResult(match, user?.id)}</span><div><h2>{matchOpponent(match, user?.id)}</h2><p>{match.completionReason || match.status.replaceAll("_", " ")} · {new Date(match.updatedAt).toLocaleString()}</p></div>{match.hasReplayData ? <ButtonLink to={`/pvp/history/${match.id}`} tone="secondary">Watch replay</ButtonLink> : <span className="quiet-copy">No replay data</span>}</article>)}</div></>}
      </QueryState>
    </div>
  );
}

export function PvpReplayPage() {
  const { matchId = "" } = useParams();
  const { user } = useAuth();
  const replay = useQuery({ queryKey: ["pvp-replay", matchId], queryFn: () => webApiClient.pvpHistoryDetail(matchId) });
  const [cursor, setCursor] = useState(0);
  if (replay.isPending) return <LoadingState label="Loading replay journal…" />;
  if (replay.isError) return <ErrorState error={replay.error} onRetry={() => void replay.refetch()} />;
  const events = replay.data.replay?.log ?? [];
  const visible = events.slice(0, cursor);
  const replayState = replay.data.replay ? replayStateAtCursor(replay.data.replay, cursor) : null;
  const currentEvent = visible.at(-1);
  return (
    <div className="page-stack replay-page">
      <PageHeader actions={<ButtonLink to="/pvp/history" tone="ghost">Back to history</ButtonLink>} eyebrow="Battle replay" lede="Replay transport walks through the immutable combat event journal." title={`${replay.data.match.inviterName || "Player one"} vs ${replay.data.match.inviteeName || "Player two"}`} />
      {events.length ? <><Panel className="replay-stage"><div className="replay-score"><TrophyIcon /><span>{matchResult(replay.data.match, user?.id)}</span><b>{replay.data.match.completionReason}</b></div><div className="replay-current">{currentEvent ? <><span>Event {visible.length} of {events.length} · turn {currentEvent.turn}</span><h2>{currentEvent.type.replaceAll("_", " ")}</h2><p>{replayState ? "The board below is reconstructed from the canonical event journal." : "The event was recorded, but its opening state is unavailable."}</p></> : <><span>Opening state</span><h2>The teams enter the field.</h2><p>{replayState ? "No combat event has been applied yet." : "The replay opening state is unavailable."}</p></>}</div>{replayState ? <div className="replay-board" aria-label="Reconstructed battle board">{replayState.players.map((player) => <article className="replay-player" key={player.userId}><div className="replay-player-head"><h3>{player.name}</h3><span>{player.energy}/{player.maxEnergy} energy</span></div><div className="replay-unit-grid">{[...player.units, ...player.bench].map((unit) => <div className={`replay-unit ${unit.hp <= 0 ? "ko" : ""}`} key={unit.instanceId}><b>{unit.name}</b><span>{Math.max(0, unit.hp)}/{unit.maxHp} HP</span>{unit.statuses.length ? <small>{unit.statuses.map((status) => status.name).join(" · ")}</small> : <small>Clear</small>}</div>)}</div></article>)}</div> : null}</Panel><Panel className="replay-transport"><button aria-label="Previous event" disabled={cursor === 0} onClick={() => setCursor((value) => Math.max(0, value - 1))} type="button"><SkipBackIcon /></button><button aria-label="Next event" disabled={cursor === events.length} onClick={() => setCursor((value) => Math.min(events.length, value + 1))} type="button"><PlayIcon /></button><button aria-label="Last event" disabled={cursor === events.length} onClick={() => setCursor(events.length)} type="button"><SkipForwardIcon /></button><input aria-label="Replay position" max={events.length} min="0" onChange={(event) => setCursor(Number(event.target.value))} type="range" value={cursor} /><span>{cursor}/{events.length}</span></Panel><div className="replay-timeline">{events.map((event, index) => <button aria-current={cursor === index + 1} key={event.seq} onClick={() => setCursor(index + 1)} type="button"><span>#{event.seq}</span><b>{event.type.replaceAll("_", " ")}</b><small>Turn {event.turn}</small></button>)}</div></> : <EmptyState copy="This completed match does not include an event journal." title="Replay unavailable" />}
    </div>
  );
}

export function PvpSpectatePage() {
  const spectate = useQuery({ queryKey: ["pvp-spectate"], queryFn: () => webApiClient.pvpSpectate(), refetchInterval: 8_000 });
  return (
    <div className="page-stack spectate-page">
      <PageHeader actions={<ButtonLink to="/pvp" tone="ghost">Back to lobby</ButtonLink>} eyebrow="Live gallery" lede="Spectating is read-only. Player emails, private loadouts, and command controls are never exposed here." title="Watch a battle unfold" />
      <QueryState query={spectate} empty={(data) => data.matches.length === 0}>
        {(data) => <div className="spectate-grid">{data.matches.map((match) => <article key={match.id}><div className="spectate-orb"><EyeIcon /></div><span>Turn {match.currentTurn}</span><h2>{match.inviterName || "Adventurer"} <small>vs</small> {match.inviteeName || "Adventurer"}</h2><p>Live since {new Date(match.createdAt).toLocaleTimeString()}</p><ButtonLink to={`/pvp/spectate/${match.id}`}>Watch live</ButtonLink></article>)}</div>}
      </QueryState>
    </div>
  );
}

export function PvpSpectateMatchPage() {
  const { matchId = "" } = useParams();
  const match = useQuery({ queryKey: ["pvp-spectate", matchId], queryFn: () => webApiClient.pvpSpectateMatch(matchId), refetchInterval: 4_000 });
  if (match.isPending) return <LoadingState label="Joining the spectator rail…" />;
  if (match.isError) return <ErrorState error={match.error} onRetry={() => void match.refetch()} />;
  if (!match.data.battleState) return <EmptyState action={<ButtonLink to="/pvp/spectate">Other live matches</ButtonLink>} copy="The match may have ended before the spectator board loaded." title="No live board" />;
  const [left, right] = match.data.battleState.players;
  return <div className="page-stack battle-page spectator-board"><PageHeader actions={<ButtonLink to="/pvp/spectate" tone="ghost">Leave spectator view</ButtonLink>} eyebrow="Read-only live battle" lede="The board refreshes from the canonical server state. No player commands are available." title={`${left.name} vs ${right.name}`} /><Notice title={`Turn ${match.data.battleState.turn}`}>{match.data.battleState.phase === "ended" ? "This match has ended." : `${match.data.battleState.players.find((player) => player.userId === match.data.battleState?.currentPlayerId)?.name || "A player"} is choosing an action.`}</Notice><div className="battle-board"><BattleSide label="Player one" player={left} /><div className="battle-divider"><EyeIcon /><span>Live</span></div><BattleSide label="Player two" player={right} /></div><BattleLog state={match.data.battleState} /></div>;
}

const mechanicSections = [
  ["01", "Build a six-card team", "Choose six distinct cards you own. Three begin active and three wait on the bench; invalid or archived cards are rejected before acceptance."],
  ["02", "Spend energy deliberately", "Basic attacks, skills, and ultimates are resolved by the server. Energy refreshes through the turn system, and a free basic attack may be available."],
  ["03", "Target, act, then end", "Select an active ally, choose a legal enemy or ally target, resolve the command, and end the turn when you are finished."],
  ["04", "Swap with the bench", "A turn may end with a valid active-to-bench swap. Knocked-out units cannot act and battle ends when a side has no legal survivors."],
  ["05", "Trust the combat journal", "Every accepted command creates ordered events. Replays, reconnection, and spectating reconstruct the same canonical battle state."],
] as const;

export function PvpMechanicsPage() {
  return <div className="page-stack reference-page"><PageHeader actions={<ButtonLink to="/pvp" tone="ghost">Back to lobby</ButtonLink>} eyebrow="PvP mechanics" lede="A plain-language map of team building, turn flow, energy, targeting, swaps, and completion." title="How a friendly battle works" /><div className="mechanic-list">{mechanicSections.map(([number, title, copy]) => <article key={number}><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></article>)}</div><Notice title="The game server makes the final call">The interface previews choices, but the backend validates ownership, action cost, target legality, turn ownership, cooldowns, statuses, and victory conditions.</Notice></div>;
}

const statusDescriptions: Record<(typeof pvpStatusNameValues)[number], string> = {
  Burn: "Damage-over-time effect that resolves during the affected unit's turns.",
  Freeze: "Ice effect that can prevent or constrain an affected unit's action.",
  Shield: "Absorbs incoming damage until its magnitude is depleted.",
  GuardUp: "Raises the unit's defensive guard for the recorded duration.",
  Vulnerable: "Makes the affected unit take increased incoming damage.",
  Weakened: "Reduces the affected unit's offensive output.",
  Haste: "Improves the unit's turn-order or speed advantage.",
  Taunt: "Draws eligible enemy targeting toward the affected unit.",
  Regeneration: "Restores health over the recorded duration.",
  Silence: "Prevents the affected unit from using its silenced abilities.",
  SummoningSickness: "Newly deployed unit restriction before it can act normally.",
  Cover: "Protective effect that changes how allied damage is directed.",
  Stunned: "Temporarily prevents the affected unit from acting.",
  Poison: "Damage-over-time effect applied by poison abilities.",
  Thorns: "Returns damage when the affected unit is hit.",
  Stealth: "Hides the unit from targeting rules that require visibility.",
  Empower: "Increases the affected unit's offensive effect or output.",
  Counter: "Prepares a response when the affected unit is attacked.",
  Mark: "Marks the unit for abilities with mark-aware conditions.",
  Barrier: "Protective barrier that absorbs or limits incoming effects.",
  Doom: "A delayed fatal condition when its recorded duration expires.",
};
const types = ["Hero", "Tech", "Royalty", "Candy", "Undead", "Ice", "Fire", "Magic", "Demon", "Cosmic"];

export function PvpReferencePage() {
  const [view, setView] = useState<"statuses" | "types" | "terms">("statuses");
  return <div className="page-stack combat-reference-page"><PageHeader actions={<ButtonLink to="/pvp" tone="ghost">Back to lobby</ButtonLink>} eyebrow="Combat reference" lede="A quick field guide to the canonical words used by cards, abilities, event logs, and the battle board." title="Read the battlefield" /><SegmentedControl label="Reference section" onChange={setView} options={[{ label: "Statuses", value: "statuses" }, { label: "Types", value: "types" }, { label: "Terms", value: "terms" }]} value={view} />{view === "statuses" ? <div className="reference-grid">{pvpStatusNameValues.map((status) => <article key={status}><ZapIcon /><h2>{status}</h2><p>{statusDescriptions[status]}</p></article>)}</div> : view === "types" ? <div className="reference-grid">{types.map((type) => <article key={type}><SwordsIcon /><h2>{type}</h2><p>A canonical card identity used by abilities, team effects, and conditional combat payloads.</p></article>)}</div> : <div className="reference-grid">{[["Active unit", "One of up to three units currently able to act and be targeted."], ["Bench", "Reserve units available for a legal end-of-turn swap."], ["Cooldown", "Owner turns remaining before an ability becomes available again."], ["Ultimate", "A powerful ability that may be limited to once per match."], ["Combat event", "An ordered server record describing one resolved part of an action."], ["Replay", "A read-only walk through the event journal and saved battle snapshots."]].map(([term, copy]) => <article key={term}><CheckCircleIcon /><h2>{term}</h2><p>{copy}</p></article>)}</div>}</div>;
}
