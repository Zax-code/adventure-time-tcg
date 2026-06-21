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
