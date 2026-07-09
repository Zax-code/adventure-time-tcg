import {
  type FormEvent,
  useMemo,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import type {
  PvpMatch,
  PvpParticipantBattleState,
  PvpPlayerState,
  PvpSpectateBattleState,
  PvpUnitState,
} from "@adventure-time/api-client";

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
import { formValues, readErrorMessage } from "@/lib/form-utils";

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

export function PvpLobbyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invites = useQuery({ queryKey: ["pvp-invites"], queryFn: () => webApiClient.pvpInvites() });
  const matches = useQuery({ queryKey: ["pvp-matches"], queryFn: () => webApiClient.pvpMatches() });
  const loadouts = useQuery({ queryKey: ["pvp-loadouts"], queryFn: () => webApiClient.pvpLoadouts() });
  const [inviteOpen, setInviteOpen] = useState(false);
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
    onSuccess: async () => invalidatePvp(queryClient),
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
        {invites.isPending ? <LoadingState label="Checking invitations…" /> : pendingInvites.length ? <div className="invite-list">{pendingInvites.map((match) => { const incoming = match.inviteeId === user?.id; const chosen = loadouts.data?.loadouts[0]; return <article key={match.id}><div><span>{incoming ? "From" : "To"}</span><h3>{matchOpponent(match, user?.id)}</h3><small>{new Date(match.createdAt).toLocaleString()}</small></div><div className="button-row">{incoming ? <><Button busy={response.isPending} disabled={!chosen} onClick={() => response.mutate({ match, action: "accept", cards: chosen?.cardIds })}>Accept{chosen ? ` with ${chosen.name}` : ""}</Button><Button busy={response.isPending} onClick={() => response.mutate({ match, action: "decline" })} tone="ghost">Decline</Button></> : <Button busy={response.isPending} onClick={() => response.mutate({ match, action: "cancel" })} tone="ghost">Withdraw</Button>}</div></article>; })}</div> : <p className="quiet-copy">No invitations are waiting.</p>}
      </Panel>
      <section className="pvp-link-grid"><Link to="/pvp/spectate"><EyeIcon /><b>Watch live matches</b><span>Read-only spectator view</span></Link><Link to="/pvp/mechanics"><SwordsIcon /><b>Learn the mechanics</b><span>Turns, energy, swaps, and targeting</span></Link><Link to="/pvp/reference"><ZapIcon /><b>Open combat reference</b><span>Types, statuses, and terminology</span></Link></section>

      <Dialog description="Invitations are private and require a saved six-card team." onClose={() => setInviteOpen(false)} open={inviteOpen} title="Invite a friend">
        <form className="stack-form" onSubmit={submitInvite}>
          <Field label="Friend's email"><input autoComplete="email" name="email" required type="email" /></Field>
          <Field hint="Create or repair a loadout if this list is empty." label="Loadout"><select name="loadoutId" required><option disabled value="">Choose six cards</option>{loadouts.data?.loadouts.flatMap((loadout) => loadout.invalidCardIds.length ? [] : [<option key={loadout.id} value={loadout.id}>{loadout.name}</option>])}</select></Field>
          <Button busy={invite.isPending} type="submit">Send invitation</Button>
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

function UnitCard({ onClick, selected, unit }: { onClick?: () => void; selected?: boolean; unit: PvpUnitState }) {
  const content = <><div className="battle-unit-art">{unit.imageUrl ? <img alt="" src={unit.imageUrl} /> : <span>{unit.name.slice(0, 1)}</span>}</div><div className="battle-unit-copy"><span>{unit.rarity} · {unit.type}</span><b>{unit.name}</b><div className="hp-bar"><progress max={unit.maxHp} value={Math.max(0, unit.hp)} /><small>{unit.hp}/{unit.maxHp} HP</small></div><div className="unit-stats"><span>ATK {unit.attack}</span><span>DEF {unit.defense}</span><span>SPD {unit.speed}</span></div>{unit.statuses.length ? <div className="status-stack">{unit.statuses.map((status, index) => <i key={`${status.name}-${index}`}>{status.name} · {status.duration}</i>)}</div> : null}</div></>;
  return onClick ? <button aria-pressed={selected} className={`battle-unit ${unit.knockedOut ? "ko" : ""}`} disabled={unit.knockedOut} onClick={onClick} type="button">{content}</button> : <article className={`battle-unit ${unit.knockedOut ? "ko" : ""}`}>{content}</article>;
}

function BattleSide({ label, onBench, onUnit, player, selectedBenchId, selectedId }: { label: string; onBench?: (unit: PvpUnitState) => void; onUnit?: (unit: PvpUnitState) => void; player: PvpPlayerState; selectedBenchId?: string; selectedId?: string }) {
  return <section className="battle-side"><header><div><span>{label}</span><h2>{player.name}</h2></div><div className="energy-pips" aria-label={`${player.energy} of ${player.maxEnergy} energy`}>{Array.from({ length: player.maxEnergy }, (_, index) => <i className={index < player.energy ? "filled" : ""} key={index} />)}</div></header><div className="active-units">{player.units.map((unit) => <UnitCard key={unit.instanceId} onClick={onUnit ? () => onUnit(unit) : undefined} selected={selectedId === unit.instanceId} unit={unit} />)}</div>{player.bench.length ? <div className="bench"><span>Bench</span>{player.bench.map((unit) => <UnitCard key={unit.instanceId} onClick={onBench ? () => onBench(unit) : undefined} selected={selectedBenchId === unit.instanceId} unit={unit} />)}</div> : null}</section>;
}

function BattleLog({ state }: { state: PvpParticipantBattleState | PvpSpectateBattleState }) {
  return <Panel className="battle-log"><SectionHeader lede={`${state.log.length} server-recorded events`} title="Battle log" />{state.log.length ? <ol>{state.log.slice(-24).reverse().map((event) => <li key={event.seq}><span>#{event.seq} · turn {event.turn}</span><b>{event.type.replaceAll("_", " ")}</b><code>{JSON.stringify(event.payload)}</code></li>)}</ol> : <p>The first action will appear here.</p>}</Panel>;
}

export function PvpMatchPage() {
  const { matchId = "" } = useParams();
  const queryClient = useQueryClient();
  const match = useQuery({ queryKey: ["pvp-match", matchId], queryFn: () => webApiClient.pvpMatch(matchId), refetchInterval: 4_000 });
  const [actorId, setActorId] = useState<string>();
  const [targetId, setTargetId] = useState<string>();
  const [benchId, setBenchId] = useState<string>();
  const [confirmConcede, setConfirmConcede] = useState(false);
  const action = useMutation<unknown, Error, "basic" | "skill" | "ultimate" | "pass" | "end" | "concede">({
    mutationFn: (kind) => {
      const currentState = match.data?.battleState;
      const currentActor = currentState?.players.flatMap((player) => player.units).find((unit) => unit.instanceId === actorId);
      if (kind === "basic") return webApiClient.actPvpMatch(matchId, { kind: "basic", actorInstanceId: actorId!, targetInstanceId: targetId! });
      if (kind === "skill") {
        if (!currentActor?.skill) throw new Error("The selected unit has no active skill.");
        return webApiClient.actPvpMatch(matchId, { kind: "skill", actorInstanceId: currentActor.instanceId, abilityKey: currentActor.skill, ...(targetId ? { targetInstanceId: targetId } : {}) });
      }
      if (kind === "ultimate") {
        if (!currentActor?.ultimate) throw new Error("The selected unit has no ultimate ability.");
        return webApiClient.actPvpMatch(matchId, { kind: "ultimate", actorInstanceId: currentActor.instanceId, abilityKey: currentActor.ultimate, ...(targetId ? { targetInstanceId: targetId } : {}) });
      }
      if (kind === "pass") return webApiClient.actPvpMatch(matchId, { kind: "pass" });
      if (kind === "end") return webApiClient.endTurnPvpMatch(matchId, actorId && benchId ? { swap: { activeInstanceId: actorId, benchInstanceId: benchId } } : {});
      return webApiClient.concedePvpMatch(matchId);
    },
    onSuccess: async () => { setActorId(undefined); setTargetId(undefined); setBenchId(undefined); setConfirmConcede(false); await queryClient.invalidateQueries({ queryKey: ["pvp-match", matchId] }); await queryClient.invalidateQueries({ queryKey: ["pvp-matches"] }); },
  });

  if (match.isPending) return <LoadingState label="Reconstructing the battle…" />;
  if (match.isError) return <ErrorState error={match.error} onRetry={() => void match.refetch()} />;
  if (!match.data.battleState) return <EmptyState action={<ButtonLink to="/pvp">Back to lobby</ButtonLink>} copy="The invitation may still need to be accepted, or this battle has no active state." title="Battle board unavailable" />;
  const state = match.data.battleState;
  const me = state.players.find((player) => player.userId === state.myUserId) ?? state.players[0];
  const opponent = state.players.find((player) => player.userId !== state.myUserId) ?? state.players[1];

  return (
    <div className="page-stack battle-page">
      <PageHeader actions={<div className="turn-indicator"><ClockIcon /><span>Turn {state.turn}</span><b>{state.phase === "ended" ? "Battle complete" : state.isMyTurn ? "Your turn" : `${opponent.name}'s turn`}</b></div>} eyebrow="Live battle" lede="Every action is validated and persisted by the combat server." title={`${me.name} vs ${opponent.name}`} />
      <div className="battle-board"><BattleSide label="Opponent" onUnit={state.isMyTurn ? (unit) => setTargetId(unit.instanceId) : undefined} player={opponent} selectedId={targetId} /><div className="battle-divider"><SwordsIcon /><span>Turn {state.turn}</span></div><BattleSide label="Your team" onBench={state.isMyTurn ? (unit) => setBenchId(unit.instanceId) : undefined} onUnit={state.isMyTurn ? (unit) => setActorId(unit.instanceId) : undefined} player={me} selectedBenchId={benchId} selectedId={actorId} /></div>
      <Panel className="battle-actions"><div><span className="eyebrow">Command bar</span><h2>{state.phase === "ended" ? state.winnerId === state.myUserId ? "Victory" : "Battle complete" : state.isMyTurn ? "Choose an active ally and a legal target." : "Waiting for the opponent."}</h2><p>{actorId ? "Active unit selected." : "Select one of your active units."} {targetId ? "Enemy target selected." : "Choose an enemy when the action needs a target."} {benchId ? "A bench swap will happen when you end the turn." : "Select a bench unit if you want to swap."}</p></div><div className="button-row"><Button busy={action.isPending} disabled={!state.isMyTurn || !actorId || !targetId || state.phase === "ended"} onClick={() => action.mutate("basic")}><SwordsIcon /> Basic attack</Button><Button busy={action.isPending} disabled={!state.isMyTurn || !actorId || !me.units.find((unit) => unit.instanceId === actorId)?.skill || state.phase === "ended"} onClick={() => action.mutate("skill")} tone="secondary">Use skill</Button><Button busy={action.isPending} disabled={!state.isMyTurn || !actorId || !me.units.find((unit) => unit.instanceId === actorId)?.ultimate || state.phase === "ended"} onClick={() => action.mutate("ultimate")} tone="secondary">Use ultimate</Button><Button busy={action.isPending} disabled={!state.isMyTurn || state.phase === "ended"} onClick={() => action.mutate("pass")} tone="ghost">Pass action</Button><Button busy={action.isPending} disabled={!state.isMyTurn || state.phase === "ended"} onClick={() => action.mutate("end")} tone="ghost">{benchId && actorId ? "Swap and end turn" : "End turn"}</Button><Button disabled={state.phase === "ended"} onClick={() => setConfirmConcede(true)} tone="danger">Concede</Button></div><FormStatus message={action.isError ? readErrorMessage(action.error) : undefined} /></Panel>
      <BattleLog state={state} />
      <Dialog description="This immediately ends the match and records a loss." onClose={() => setConfirmConcede(false)} open={confirmConcede} title="Concede this battle?"><div className="button-row"><Button busy={action.isPending} onClick={() => action.mutate("concede")} tone="danger">Yes, concede</Button><Button onClick={() => setConfirmConcede(false)} tone="ghost">Keep battling</Button></div></Dialog>
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
  const replay = useQuery({ queryKey: ["pvp-replay", matchId], queryFn: () => webApiClient.pvpHistoryDetail(matchId) });
  const [cursor, setCursor] = useState(0);
  if (replay.isPending) return <LoadingState label="Loading replay journal…" />;
  if (replay.isError) return <ErrorState error={replay.error} onRetry={() => void replay.refetch()} />;
  const events = replay.data.replay?.log ?? [];
  const visible = events.slice(0, cursor);
  return (
    <div className="page-stack replay-page">
      <PageHeader actions={<ButtonLink to="/pvp/history" tone="ghost">Back to history</ButtonLink>} eyebrow="Battle replay" lede="Replay transport walks through the immutable combat event journal." title={`${replay.data.match.inviterName || "Player one"} vs ${replay.data.match.inviteeName || "Player two"}`} />
      {events.length ? <><Panel className="replay-stage"><div className="replay-score"><TrophyIcon /><span>{matchResult(replay.data.match)}</span><b>{replay.data.match.completionReason}</b></div><div className="replay-current">{visible.length ? <><span>Event {visible.length} of {events.length} · turn {visible.at(-1)?.turn}</span><h2>{visible.at(-1)?.type.replaceAll("_", " ")}</h2><code>{JSON.stringify(visible.at(-1)?.payload, null, 2)}</code></> : <><span>Opening state</span><h2>The teams enter the field.</h2></>}</div></Panel><Panel className="replay-transport"><button aria-label="Previous event" disabled={cursor === 0} onClick={() => setCursor((value) => Math.max(0, value - 1))} type="button"><SkipBackIcon /></button><button aria-label="Next event" disabled={cursor === events.length} onClick={() => setCursor((value) => Math.min(events.length, value + 1))} type="button"><PlayIcon /></button><button aria-label="Last event" disabled={cursor === events.length} onClick={() => setCursor(events.length)} type="button"><SkipForwardIcon /></button><input aria-label="Replay position" max={events.length} min="0" onChange={(event) => setCursor(Number(event.target.value))} type="range" value={cursor} /><span>{cursor}/{events.length}</span></Panel><div className="replay-timeline">{events.map((event, index) => <button aria-current={cursor === index + 1} key={event.seq} onClick={() => setCursor(index + 1)} type="button"><span>#{event.seq}</span><b>{event.type.replaceAll("_", " ")}</b><small>Turn {event.turn}</small></button>)}</div></> : <EmptyState copy="This completed match does not include an event journal." title="Replay unavailable" />}
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

const statuses = ["STUNNED", "POISONED", "BURNING", "FROZEN", "SHIELDED", "TAUNT", "SILENCED", "WEAKENED", "HASTED", "MARKED"];
const types = ["Hero", "Tech", "Royalty", "Candy", "Undead", "Ice", "Fire", "Magic", "Demon", "Cosmic"];

export function PvpReferencePage() {
  const [view, setView] = useState<"statuses" | "types" | "terms">("statuses");
  return <div className="page-stack combat-reference-page"><PageHeader actions={<ButtonLink to="/pvp" tone="ghost">Back to lobby</ButtonLink>} eyebrow="Combat reference" lede="A quick field guide to the canonical words used by cards, abilities, event logs, and the battle board." title="Read the battlefield" /><SegmentedControl label="Reference section" onChange={setView} options={[{ label: "Statuses", value: "statuses" }, { label: "Types", value: "types" }, { label: "Terms", value: "terms" }]} value={view} />{view === "statuses" ? <div className="reference-grid">{statuses.map((status) => <article key={status}><ZapIcon /><h2>{status.toLowerCase().replaceAll("_", " ")}</h2><p>A timed combat modifier. Duration and magnitude are shown on the affected unit when the payload provides them.</p></article>)}</div> : view === "types" ? <div className="reference-grid">{types.map((type) => <article key={type}><SwordsIcon /><h2>{type}</h2><p>A canonical card identity used by abilities, team effects, and conditional combat payloads.</p></article>)}</div> : <div className="reference-grid">{[["Active unit", "One of up to three units currently able to act and be targeted."], ["Bench", "Reserve units available for a legal end-of-turn swap."], ["Cooldown", "Owner turns remaining before an ability becomes available again."], ["Ultimate", "A powerful ability that may be limited to once per match."], ["Combat event", "An ordered server record describing one resolved part of an action."], ["Replay", "A read-only walk through the event journal and saved battle snapshots."]].map(([term, copy]) => <article key={term}><CheckCircleIcon /><h2>{term}</h2><p>{copy}</p></article>)}</div>}</div>;
}
