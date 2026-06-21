# Adventure Time TCG

Domain language for Adventure Time TCG gameplay and product concepts.

## Language

**PvP Battle Rules**:
The canonical rules that determine PvP match setup, valid actions, turn flow, combat resolution, statuses, abilities, passives, and win conditions.
_Avoid_: Mobile reference rules, legacy combat rules, display-only rules

**PvP Effect**:
A gameplay consequence produced during PvP battle resolution, including status changes, ability outcomes, passive triggers, targeting redirects, damage, healing, revival, prevention of fatal damage, cooldown changes, energy changes, copy behavior, and turn processing.
_Avoid_: Status-only effect, visual effect

**Cleanse**:
A PvP Effect that removes statuses from one or more units. Cleanse is not itself a PvP status.
_Avoid_: Cleanse status

**Regeneration**:
A PvP status that heals its unit at the start of that unit owner's turn.
_Avoid_: Regen

**PvP Type Matchup**:
A relationship between an attacking unit's type and a defending unit's type that changes damage dealt in PvP.
_Avoid_: Type special modifier, hidden type passive

**Legendary Passive Slot**:
The PvP ability slot that allows a Legendary card to use one passive ability in battle. Non-Legendary cards do not have a passive slot.
_Avoid_: Passive on every rarity, extra passive for non-Legendary cards

**PvP Ability Visibility**:
Assigned skill, ultimate, and passive abilities are public battle information. Both players should be able to inspect an opponent unit's assigned abilities, cooldowns, and used-ultimate state during battle for transparency.
_Avoid_: Hidden opponent abilities, hidden cooldowns, reveal-on-trigger passives

**PvP Energy Visibility**:
Both players' exact current energy totals are public battle information. Energy should be visible to both sides during battle.
_Avoid_: Hidden opponent energy, obfuscated energy

**PvP Combat Log Visibility**:
The full combat log is public battle information for both players. This includes passive triggers, cooldown reductions, status ticks, formation shifts, energy changes, mitigation, retaliation, and other resolved battle events.
_Avoid_: Hidden log events, private passive triggers, private cooldown ticks

**PvP Randomness Visibility**:
Random rolls are private while an action is being chosen or resolved, then public once the result resolves. The combat log should expose roll outcomes and roll/chance or choice details for misses, crits, passive chance checks, status chance checks, and random status choices.
_Avoid_: Hidden resolved rolls, outcome-only chance events

**PvP Draw**:
A valid PvP match result where both players reach a terminal no-living-units state in the same resolution window. The match should end with no winner instead of applying a deterministic tiebreaker.
_Avoid_: Forced winner for simultaneous KO, arbitrary tie breaker

**PvP Turn Timeout**:
A disconnect does not by itself change match outcome. If the current player leaves the match inactive for 24 hours after their turn starts, that player loses by timeout and the opponent wins. The exact timeout deadline is public match information and should be visible before it resolves. Timeout losers keep normal access to the replay and combat log after the match.
_Avoid_: Disconnect-as-loss, timeout draw, sub-24-hour timeout loss, hidden timeout deadline, hiding timeout replay from the loser

**PvP Result Reason**:
The match-level reason a completed PvP match ended: KO, draw, concession, or timeout. History may show a distinct player-relative label such as Win, Loss, Draw, Conceded, or Timed Out, but aggregate player stats remain normalized to wins, losses, and draws. Concession and timeout are loss reasons, not separate stats buckets.
_Avoid_: Separate concession/timeout stats, hiding special result labels in history, deriving result labels only from replay logs

**PvP Bench Visibility**:
Opponent bench card details are public battle information before those cards enter the active row. Players should be able to inspect bench HP, statuses, assigned abilities, cooldowns, used-ultimate state, and passives during battle.
_Avoid_: Hidden bench cards, concealed bench abilities

**PvP Swap Intent**:
A player's queued swap choice is private until it resolves at end turn. The resolved swap is public through battle state changes and the combat log.
_Avoid_: Revealing pending swaps, opponent-visible queued swap intent

**PvP Targeting Intent**:
A player's in-progress target selection does not need to be private. Showing target highlights or targeting previews to the opponent before action submission is acceptable because the opponent cannot interrupt that choice.
_Avoid_: Treating target hover/selection preview as secret information
