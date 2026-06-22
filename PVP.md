# PvP Battle Rules

This document describes intended PvP rules that are important for engine work.
Phoenix is the gameplay source of truth for live matches. Shared TypeScript
combat helpers, mobile rule references, replay views, and legacy code should be
updated to match Phoenix when they disagree.

## Status Duration Model

Status duration should be counted by the affected unit owner's turn cycle, not
by raw global turn increments and not by whether the status is a buff or debuff.

The core question at application time is:

```text
Was this status applied during the affected unit owner's turn?
```

If yes, the status expires after start-of-turn status processing on that
owner's Nth future turn.

If no, the status expires after end-of-turn status processing on that owner's
Nth future turn.

`N` is the status duration. A `duration` of `1` means the next relevant owner
turn. A `duration` of `2` means the second relevant owner turn, and so on.

This rule is intentionally not status-specific. It applies the same way to
buffs, debuffs, neutral statuses, self-applied statuses, enemy-applied statuses,
and statuses applied by passive effects.

### Terms

`target owner`
: The player who owns the affected unit.

`current player`
: The player whose turn is currently being resolved when the status is applied.

`target-owner turn`
: A turn where `currentPlayerId == targetOwnerId`.

`future target-owner turn`
: A target-owner turn that begins after the status was applied. The target
owner's current in-progress turn does not count as a future turn.

`after start effects`
: The phase immediately after statuses that were already active at turn start
have had their start-of-turn effects resolved.

`after end effects`
: The phase immediately after end-of-turn effects for the target owner have
resolved.

## Generic Rule

When a timed status is applied, the engine should record enough metadata to
answer these questions later:

```text
targetOwnerId
appliedDuringPlayerId
appliedDuringTargetOwnerTurn
duration
expiresAt
ownerTurnsRemaining or expiresOnOwnerTurnIndex
```

The derived fields are:

```text
appliedDuringTargetOwnerTurn =
  appliedDuringPlayerId == targetOwnerId

expiresAt =
  appliedDuringTargetOwnerTurn
    ? afterOwnerTurnStartEffects
    : afterOwnerTurnEndEffects
```

The rule is:

```text
If appliedDuringTargetOwnerTurn:
  Count future target-owner turn starts.
  Expire after start-of-turn status effects on the Nth future target-owner turn.

If not appliedDuringTargetOwnerTurn:
  Count future target-owner turn ends.
  Expire after end-of-turn status effects on the Nth future target-owner turn.
```

## Examples

### Enemy Applies A 1-Turn Status To Me

Player A applies `Silence(duration: 1)` to Player B's unit during Player A's
turn.

At application time:

```text
targetOwnerId = Player B
appliedDuringPlayerId = Player A
appliedDuringTargetOwnerTurn = false
expiresAt = afterOwnerTurnEndEffects
```

Result:

1. Player B's unit is silenced immediately.
2. Player A ends their turn.
3. Player B's turn starts.
4. Player B's unit is still silenced during Player B's action phase.
5. Player B ends their turn.
6. The status expires after Player B's end-of-turn effects.

This makes a one-turn enemy-applied action restriction useful for the afflicted
player's next turn.

### I Apply A 1-Turn Status To My Own Unit

Player A applies `GuardUp(duration: 1)` to Player A's own unit during Player A's
turn.

At application time:

```text
targetOwnerId = Player A
appliedDuringPlayerId = Player A
appliedDuringTargetOwnerTurn = true
expiresAt = afterOwnerTurnStartEffects
```

Result:

1. Player A's unit has GuardUp immediately.
2. Player A ends their turn.
3. Player B takes their turn while Player A's unit still has GuardUp.
4. Player B ends their turn.
5. Player A's next turn starts.
6. Start-of-turn status effects resolve while GuardUp still exists.
7. GuardUp expires after start-of-turn status processing and before Player A's
   action phase.

This makes a one-turn self-applied status protect or affect the unit through the
opponent's next turn while still allowing start-of-turn behavior to happen.

### Enemy Applies A 2-Turn Status To Me

Player A applies `Silence(duration: 2)` to Player B's unit during Player A's
turn.

Result:

1. Player B is affected during Player B's next turn.
2. The status does not expire at the end of that first affected turn.
3. Player B is affected again during Player B's second future turn.
4. The status expires after Player B's second affected turn ends.

### I Apply A 2-Turn Status To My Own Unit

Player A applies `GuardUp(duration: 2)` to Player A's own unit during Player A's
turn.

Result:

1. The status is active immediately.
2. It is active during Player B's next turn.
3. It survives Player A's next turn start effects, then remains active because
   only one future target-owner turn has been counted.
4. It is active during Player B's following turn.
5. It survives Player A's second future turn start effects.
6. It expires after those start effects and before Player A's action phase.

## Turn Phase Ordering

The duration model depends on precise phase ordering. The engine should treat a
turn transition as a sequence of phases, even if the current implementation
stores them in one function.

### Owner Turn Start

For the player whose turn is beginning:

1. Mark or derive that this owner turn has started.
2. Resolve start-of-turn status effects for statuses that were already active
   when this phase began.
3. Resolve other start-of-turn systems that are currently defined to happen in
   this phase, such as cooldown reduction, energy grant, and start-turn passives.
4. Expire statuses scheduled for `afterOwnerTurnStartEffects` whose target-owner
   turn count has reached the requested duration.
5. Enter the action phase.

The important invariant is that statuses expiring at start do so after
start-of-turn status processing, not before it.

### Owner Turn End

For the player whose turn is ending:

1. Resolve explicit end-turn choices such as queued swaps.
2. Resolve end-turn passives and other end-turn effects.
3. Expire statuses scheduled for `afterOwnerTurnEndEffects` whose target-owner
   turn count has reached the requested duration.
4. Switch to the next player.

The important invariant is that enemy-applied one-turn statuses remain active
through the afflicted player's action phase and expire only after that player has
finished the turn.

## Technical Implementation Shape

The engine should avoid manually decrementing `duration` in many places. Status
duration should be managed by one lifecycle module or one small cluster of
private lifecycle helpers inside the Phoenix battle engine.

At status application time:

1. Find the target unit owner.
2. Read the current player from battle state.
3. Compute the expiration boundary:

```elixir
expires_at =
  if current_player_id == target_owner_id do
    "afterOwnerTurnStartEffects"
  else
    "afterOwnerTurnEndEffects"
  end
```

4. Store lifecycle metadata on the status entry.

Recommended status fields:

```json
{
  "name": "Silence",
  "duration": 1,
  "magnitude": null,
  "sourceInstanceId": "p1u1",
  "appliedAt": 7,
  "appliedDuringPlayerId": "player1",
  "targetOwnerId": "player2",
  "expiresAt": "afterOwnerTurnEndEffects",
  "ownerTurnsSeen": 0
}
```

`appliedAt` may remain as the global battle turn for replay/debugging, but it
should not be the only source of duration truth.

### Owner Turn Counting

There are two reasonable implementation strategies.

#### Counter Strategy

Store `ownerTurnsSeen` on each timed status.

At the relevant boundary:

```text
if status.targetOwnerId == boundaryPlayerId
and status.expiresAt == currentBoundary
and status existed before this boundary began:
  status.ownerTurnsSeen += 1

  if status.ownerTurnsSeen >= status.duration:
    expire status
```

This is easy to reason about and works even if global turn numbering changes.

#### Absolute Index Strategy

Store a per-player owner-turn index in battle state, for example:

```json
{
  "ownerTurnIndexByPlayerId": {
    "player1": 3,
    "player2": 2
  }
}
```

At application time, compute:

```text
expiresOnOwnerTurnIndex =
  currentOwnerTurnIndexForTarget + duration
```

At the relevant boundary:

```text
if boundaryOwnerTurnIndex >= status.expiresOnOwnerTurnIndex:
  expire status
```

This is compact, but it requires introducing and preserving an owner-turn index
in snapshots, replays, and reconstruction.

The counter strategy is likely easier to retrofit into the current Phoenix
state shape because statuses already carry per-status metadata.

## Phase Snapshot Rule

Expiration sweeps must operate on the statuses that existed before the sweep
began.

If a status is applied during start-of-turn processing, it must not immediately
expire during that same start-of-turn expiration sweep. Likewise, if a status is
applied during end-of-turn processing, it must not immediately expire during that
same end-of-turn expiration sweep.

Technically, this can be handled by either:

1. Capturing the list of status identities present at the beginning of the phase.
2. Storing an `appliedAtSequence` or `appliedAtPhaseId` and skipping statuses
   applied in the current phase.

This avoids subtle bugs where a passive applies a one-turn status during the
same phase that would otherwise expire it.

## Reapplication And Refreshing

When the same non-stackable status is reapplied, the lifecycle should refresh
from the new application context.

For example:

1. Player A applies `Silence(duration: 1)` to Player B during Player A's turn.
2. Before Player B's turn ends, Player B somehow receives `Silence(duration: 2)`
   again.
3. The existing status should refresh duration and lifecycle from the second
   application context.

Recommended behavior:

```text
new duration = max(remaining effective duration, incoming duration)
appliedDuringPlayerId = currentPlayerId from the refresh event
targetOwnerId = target owner at refresh time
expiresAt = recomputed from the refresh event
ownerTurnsSeen = 0 for the refreshed lifecycle
```

For stackable statuses, such as Poison, stack count and duration refresh should
be handled together. The lifecycle should still be derived from the latest
application event unless a future design explicitly says stacks can carry
separate expiration timelines.

## Consumed And Permanent Statuses

This duration model applies to timed statuses.

Some statuses can still be removed earlier by gameplay consumption:

```text
Shield: consumed by damage or depleted magnitude
Barrier: consumed by blocking a debuff
Freeze: consumed when it prevents an action
Stunned: consumed when it taxes an action
Empower: consumed when it modifies an attack
Counter: consumed when it counters
```

Consumption is not a separate duration-counting rule. It is an early removal
condition. If the status is not consumed, the generic duration boundary still
decides when it expires.

Permanent or indefinite statuses should use an explicit representation such as
`duration: -1` and should be skipped by duration expiration. They can still be
removed by consumption, cleanse, source death, replacement, or other explicit
effects.

## Start-Of-Turn Effects

Start-of-turn status effects should trigger before start-boundary expiration.

For a status applied during the target owner's own turn:

```text
duration: 1
expiresAt: afterOwnerTurnStartEffects
```

The next time that owner turn starts, the status is still present while
start-of-turn status effects run. Then it expires before the owner takes
actions.

This prevents self-applied statuses with start-of-turn behavior from being
deleted before they can ever matter.

## Statuses Applied Outside Normal Actions

Statuses may be applied by passives, start-turn hooks, end-turn hooks, swaps,
copy effects, retaliation, or future systems.

The same generic rule should apply:

```text
appliedDuringPlayerId = state.currentPlayerId at the moment of application
targetOwnerId = owner of the affected unit
```

If a future system applies statuses outside any active player turn, it must pass
an explicit `appliedDuringPlayerId` or choose a documented default. The preferred
default is the battle state's current player, because that preserves the same
mental model used during normal turn resolution.

## Cleansing

Cleanse removes statuses immediately. It should not alter duration counters for
statuses that remain.

If a status is cleansed and later reapplied, it receives fresh lifecycle metadata
from the new application event.

## KO, Bench, And Source Death

Duration counting is tied to the target owner, not to whether the affected unit
is active, benched, knocked out, or temporarily unable to act.

Open implementation decision:

```text
Should timed statuses continue counting down while the affected unit is knocked
out?
```

The current engine skips some status ticking for knocked-out units. For this new
model, the recommended rule is:

```text
Duration expiration should still advance for knocked-out units, but damaging,
healing, or action-restricting effects should not resolve on units that are not
valid recipients for those effects.
```

That prevents dead units from preserving expired statuses forever while still
avoiding nonsense effects like Burn damaging an already knocked-out unit.

Source death should remove statuses only when the status explicitly depends on a
source. For example, Cover or aura-like effects may end when their source leaves
battle. Ordinary timed statuses should continue until their generic expiration
boundary unless cleansed or consumed.

## Replay And Persistence

The lifecycle metadata should be persisted in battle snapshots and replay state.

Required event/log behavior:

```text
statusApply should include enough payload to explain duration and lifecycle.
statusExpire should state whether expiration happened at owner turn start or end.
Replay reconstruction must preserve lifecycle fields, not infer them from UI text.
```

Suggested `statusApply` payload fields:

```json
{
  "status": "Silence",
  "duration": 1,
  "targetOwnerId": "player2",
  "appliedDuringPlayerId": "player1",
  "expiresAt": "afterOwnerTurnEndEffects"
}
```

Suggested `statusExpire` payload fields:

```json
{
  "status": "Silence",
  "expiredAt": "afterOwnerTurnEndEffects",
  "ownerTurnsSeen": 1
}
```

## Compatibility Notes

The older model decremented most ticking statuses at the start of the owner turn.
That made enemy-applied one-turn action restrictions expire before the afflicted
player could act, which made statuses like Silence ineffective.

The new model should replace ad hoc status-specific expiration branches with one
generic lifecycle calculation at application time and two generic expiration
sweeps:

```text
expire_after_owner_turn_start_effects(player_id)
expire_after_owner_turn_end_effects(player_id)
```

Any implementation should include regression tests for:

1. Enemy applies `duration: 1` status to my unit; it expires after my next turn
   ends.
2. I apply `duration: 1` status to my own unit; it expires after my next turn
   start effects.
3. Enemy applies `duration: 2` status to my unit; it expires after my second
   future turn ends.
4. I apply `duration: 2` status to my own unit; it expires after my second
   future turn start effects.
5. A start-of-turn status applied during my own turn gets one start-of-turn
   trigger before expiring.
6. A status applied during start-turn or end-turn passive processing does not
   expire in the same phase where it was applied.
7. Reapplying a non-stackable status refreshes both duration and lifecycle
   metadata.
8. Consuming, cleansing, replacing, and source-death removal still remove
   statuses immediately when their own rules say so.
