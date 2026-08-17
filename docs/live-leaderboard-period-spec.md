# Live Leaderboard Period Specification

Status: Approved for implementation on 2026-08-17

## Purpose

Make Daily and Weekly leaderboards useful while competition is still underway. Accepted
results become public through regularly refreshed provisional standings. Relative-period
selectors compare the viewer's current and immediately preceding date or week, while the
History archive is the place to find finalized periods.

This specification supersedes the existing delayed-comparison behavior wherever it
conflicts with the rules below. Existing quest gameplay, result validation, scoring
formulas, tie handling, moderation, audited corrections, and reward amounts remain
unchanged unless this document says otherwise.

## Approved Product Decisions

1. The global closure time for a civil competition date is **13:00 UTC on the following
   day**.
2. The 13:00 UTC closure consists of the worldwide UTC-12 date boundary at 12:00 UTC
   followed by one hour for final Step synchronization. There is no additional
   publication buffer after 13:00 UTC.
3. An accepted ranked result enters the relevant Live Leaderboard immediately after the
   result transaction commits. It does not wait for a worldwide date closure or a
   periodic snapshot lifecycle job.
4. A player becomes a Leaderboard Participant after at least one accepted ranked result
   for the selected board and period. Playing another quest, PvP, training, or another
   board does not place the player on the selected leaderboard.
5. A valid accepted result worth zero points still counts as participation. Rejected,
   excluded, ineligible, and training results do not. Quest-specific settlement rules
   still determine whether an abandoned attempt becomes an accepted zero-point result.
6. Daily and Weekly are separate leaderboard views. Each defaults to its current period
   and provides a selector for the viewer's immediately preceding period.
7. The Daily selector labels are **Today** and **Yesterday**. `Today` is the default.
8. The Weekly selector labels are **This week** and **Last week**. `This week` is the
   default.
9. `Yesterday` means the Competition Date immediately before the viewer's current
   Competition Date. It may remain provisional until its 13:00 UTC worldwide closure.
10. `Last week` means the Competition Week immediately before the viewer's current
    Competition Week. It may remain provisional until the prior Sunday closes worldwide
    at 13:00 UTC on Monday.
11. The leaderboard surface always displays the authoritative date being viewed. Daily
    displays one full date; Weekly displays its full Monday-through-Sunday date range.
    The date display removes any ambiguity created by the conversational selector labels.
12. Live standings are clearly provisional and may change whenever players in any
    timezone submit or synchronize results.
13. Weekly provisional ranking begins with a player's first accepted result. The player
    does not wait for three closed dates before appearing.
14. Weekly provisional scoring uses the best accepted results currently available, up
    to the configured best-three limit.
15. One accepted ranked result is sufficient for Live and Final Weekly participation,
    placement, and prize eligibility. There is no three-result qualification threshold.
    Players with no accepted ranked result for the selected board remain absent, clearly
    separating participants from non-participants.
16. Final Weekly placements, achievements, and Crowns are awarded only after the full
    Competition Week closes.
17. `Today` and `Yesterday` can both be provisional at the same time. Around the weekly
    boundary, `This week` and `Last week` can also both be provisional.
18. Leaderboard History remains the distinct archive for Final Leaderboards. A player
    looking for the latest closed date or week uses History rather than a relative-period
    selector.
19. Live updates use reasonable periodic refresh and user-initiated pull-to-refresh.
    WebSocket-style pushed standings are not required.

## Canonical Model

### Competition date

A Competition Date is a natural local calendar date in the player's effective,
server-controlled competition timezone. Its gameplay boundaries remain local midnight
to local midnight, including legitimate 23-hour and 25-hour daylight-saving dates.

The shared board for civil date `D` is live while eligible players around the world are
submitting results for `D`. It becomes final at:

```text
D + 1 day at 13:00 UTC
```

At 12:00 UTC, `D` has ended in the fixed supported timezone envelope through UTC-12.
The hour from 12:00 through 13:00 UTC is a Step ingestion grace period, not extra
gameplay time.

### Competition week

A Competition Week is the Monday-through-Sunday sequence of Competition Dates identified
by its Monday date. A player participates in the week associated with the immutable
competition slots created in that player's effective competition timezone.

The Weekly Live Leaderboard changes throughout the week. The week becomes final at
13:00 UTC on the Monday following its Sunday, after Sunday has closed globally under the
same Daily cutoff rule.

### Accepted ranked result

An accepted ranked result is a server-validated, active result whose integrity and
eligibility statuses allow ranking on the selected board. It may carry positive or zero
points.

For a source board, participation requires a result on that board. For a derived family
board, participation begins when the player has an accepted result for at least one
member board; the established family formula continues to supply the values for missing
members.

### Live leaderboard

A Live Leaderboard is public, provisional, and readable from committed results. Every
accepted change that affects the current active result must be reflected without waiting
for period closure. This includes:

- a player's first accepted result;
- a later result that replaces the active result under that quest's existing rules;
- a newer accepted Step synchronization;
- a result exclusion or eligibility change; and
- a correction made before closure.

“Immediately” means that once the write transaction commits, a fresh leaderboard read
must include it. Clients use a reasonable automatic polling interval and retain
pull-to-refresh for an explicit fresh read. WebSockets, server-sent events, Phoenix
channels, and other pushed-standings transports are not required. The backend must not
wait for period closure or a five-minute lifecycle snapshot before serving the result.

### Final leaderboard

A Final Leaderboard is the immutable closed snapshot of one Daily or Weekly period.
Ordinary late submissions and Step synchronizations cannot rewrite it. A documented,
audited administrative correction may create a superseding revision under the existing
correction rules.

## Navigation And Display

The Rankings experience has three distinct destinations:

1. **Daily**
2. **Weekly**
3. **History**

Daily and Weekly remember or default their own board/mode selection according to the
existing Rankings behavior. Entering Daily defaults to `Today`; entering Weekly defaults
to `This week`.

### Daily

Daily contains a two-option selector:

| Selector label | Meaning | State |
| --- | --- | --- |
| `Today` | The viewer's current Competition Date | Live and provisional |
| `Yesterday` | The Competition Date immediately before the viewer's `Today` | Provisional or final |

The surface always displays the selected Competition Date separately from the selector.
For example:

```text
Today      Yesterday

Monday, August 17, 2026
Live provisional standings
```

Before yesterday closes globally at 13:00 UTC, its board remains live and provisional.
The displayed full date and status are always authoritative.

### Weekly

Weekly contains a two-option selector:

| Selector label | Meaning | State |
| --- | --- | --- |
| `This week` | The viewer's current Competition Week | Live and provisional |
| `Last week` | The Competition Week immediately before the viewer's `This week` | Provisional or final |

The surface always displays the selected Monday-through-Sunday range separately from the
selector. For example:

```text
This week      Last week

August 17–23, 2026
Live provisional standings
```

On Monday before the prior week closes globally at 13:00 UTC, `Last week` opens that
immediately preceding week as a live provisional board. The displayed date range and
status are always authoritative.

### Localization

Selector and status copy is localized at render time. English canonical labels are
`Daily`, `Weekly`, `History`, `Today`, `Yesterday`, `This week`, and `Last week`.
French and future locales use natural equivalents while preserving the same period
semantics. Dates and ranges use the viewer's locale, but their underlying Competition
Date or Competition Week keys remain unchanged.

### History

History contains only Final Leaderboards. It remains the archive for closed competition
weeks and their daily drill-downs, including discovery of the latest closed Daily or
Weekly period.

History never contains an open provisional period and never substitutes for the default
live Daily or Weekly views. Relative selectors do not skip an open period to find a
finalized one; that is History's role.

## Daily Live Standings

The `Today` board is keyed to the viewer's current Competition Date. It includes every
Leaderboard Participant who has an accepted ranked result for that same civil date,
regardless of whether all supported timezones have reached or completed that date.

This intentionally means the board fills progressively:

- players in early timezones may appear before the date opens in later timezones;
- later-timezone players join when they submit for the same civil date;
- ranks may move in either direction throughout the live period; and
- two viewers on different local dates can be looking at different `Today` boards at the
  same instant.

The UI must communicate this with persistent copy such as:

```text
Live provisional standings — results appear as players compete across timezones.
```

The Daily board retains its established board-specific scoring and tie behavior. It does
not require a minimum number of results beyond the single accepted result that creates
participation.

## Weekly Live Standings

The `This week` board includes every Leaderboard Participant with at least one accepted
ranked result for the selected board in that Competition Week.

For each participant:

1. Gather the player's active accepted results in the selected Competition Week.
2. Sort them under the existing weekly best-result rules.
3. Select up to the configured best-three limit.
4. Calculate the provisional score as the average of the selected available results.
5. Assign a provisional rank using the existing competition-tie rule.

Examples:

| Valid results | Weekly treatment | Final eligibility if the week ended now |
| ---: | --- | --- |
| 0 | Absent from the selected leaderboard | Not a participant |
| 1 | Visible and ranked from that result | Eligible |
| 2 | Visible and ranked from the best two | Eligible |
| 3 | Visible and ranked from the best three | Eligible |
| 4–7 | Visible and ranked from the best three | Eligible |

The result count may be displayed as context, but it is not qualification progress and
does not restrict ranking or rewards. Final placement remains subject to the established
integrity, eligibility, moderation, and board-prize rules.

## Step Handling And The 13:00 UTC Cutoff

HealthKit, Health Connect, the device pedometer, and Fitbit may record or settle Step data
outside Phoenix. The competitive activity boundary remains the player's local midnight:
walking after midnight belongs to the new Competition Date.

For civil date `D`:

- Step samples must belong to `D` in the player's locked competition timezone.
- Accepted synchronizations can update the Daily and Weekly Live Leaderboards while `D`
  remains open globally.
- At 12:00 UTC on `D + 1`, `D` has ended throughout the supported UTC+14 through UTC-12
  envelope.
- The final global ingestion grace runs from 12:00 through 13:00 UTC.
- At exactly 13:00 UTC, `D` closes and final snapshots are published.
- There is no additional 15-minute processing delay.
- A later ordinary Step sync may update the quest's own display under existing quest
  behavior, but it cannot alter the Final Leaderboard.
- A documented system incident may still use the existing audited correction process.

The one-hour grace is a product tradeoff, not a guarantee that every offline or
OS-delayed device will synchronize. Competitive participation requires a result to reach
Phoenix before closure.

## Status And Reward Rules

Every leaderboard response and screen must distinguish live from final state.

### Live

- Status is provisional.
- Rows and ranks may change.
- The exact Daily date or Weekly range is visible.
- No medal, achievement, Crown, or other final-placement reward is granted.
- The player must not be told or visually led to believe that a provisional placement is
  secured.

### Final

- Status is closed or corrected.
- The exact Daily date or Weekly range is visible.
- Daily ranks are final subject only to audited correction.
- Weekly ranks require at least one accepted ranked result for the selected board.
- Weekly medals, achievements, and Crowns are awarded from the final eligible snapshot.

Existing competition rank semantics (`1, 1, 3`), tie prize expansion, reward caps,
profile visibility, deleted-player tombstones, moderation, and audited corrections remain
unchanged.

## Timezone Scenarios

### Same Daily board opens progressively

On civil date August 17, a UTC+14 player can submit before August 17 begins for a UTC-12
player. Both results belong to the August 17 Daily board. The early result is immediately
public and provisional; the later player joins after their own August 17 slot opens.

### Viewers can have different Today boards

At one instant, a UTC+14 viewer may have August 18 as `Today`, while a UTC-12 viewer has
August 17. Each screen displays its actual date, so neither relies on the selector label
alone.

### Today and Yesterday can both be provisional

For a viewer whose current Competition Date is August 18, `Today` opens August 18 and
`Yesterday` opens August 17. At 10:00 UTC, August 17 has not yet closed globally, so both
boards are provisional and both continue to refresh.

At 13:00 UTC, the August 17 board becomes final. `Yesterday` continues to open August 17;
only its status changes.

### This week and Last week can both be provisional

On Monday at 10:00 UTC, the immediately preceding Sunday has not passed the global
13:00 UTC cutoff. `This week` opens the new week and `Last week` opens the immediately
preceding week. Both are provisional.

At 13:00 UTC, the just-ended week becomes final. `Last week` continues to open that same
week; only its status changes.

## Current-System Changes Required

The existing implementation does not satisfy this specification:

- `Yesterday` currently resolves to the latest closed Daily snapshot rather than the
  viewer's immediately preceding Competition Date, and there is no `Today` live option.
- `This week` currently ranks only globally closed Competition Dates.
- The current player's newer result is shown separately while other players' pending
  results remain hidden.
- Weekly rows are currently omitted until a player has three qualifying closed results;
  the new rule ranks a participant from the first accepted result.
- There is no `Last week` relative-period view that can remain provisional through the
  Monday closure window.
- Weekly snapshots refresh through a five-minute lifecycle job rather than directly from
  committed accepted results.
- Mobile already refetches approximately once per minute; this is an acceptable live
  delivery mechanism when combined with pull-to-refresh and a backend fresh-read model.
- The current global closure is 20:15 UTC rather than 13:00 UTC.

Implementation must introduce a live read projection or equivalent write-through model
that is distinct from immutable final snapshots. The transport used to notify clients is
an implementation choice, but a fresh read after commit must return the new standings.

## API And Data Requirements

The API must let clients request these concepts without inferring them from wall-clock
labels:

- the viewer's current Daily period;
- the viewer's immediately preceding Daily period;
- the viewer's current Weekly period;
- the viewer's immediately preceding Weekly period; and
- finalized History.

Every response includes:

- authoritative period type;
- Daily Competition Date or Weekly start and end dates;
- live/final status;
- provisional boolean;
- authoritative server time;
- global close time where applicable;
- current revision or live projection version;
- rows and current-player row;
- board identity and scoring version; and
- Weekly valid-result count where available as informational context only.

Period selection is viewer-relative and must not depend on whether the selected period is
closed. The response's actual date keys and status are authoritative. Finalized-period
discovery belongs to History rather than to the Daily or Weekly relative selectors.

## Acceptance Criteria

1. Submitting the first accepted result for a selected Daily board makes that player
   visible on a fresh `Today` read immediately after commit.
2. Submitting the first accepted result for a selected Weekly board makes that player
   visible and provisionally ranked on a fresh `This week` read immediately after commit.
3. A player with one accepted ranked result is shown and ranked on both Live and Final
   Weekly leaderboards.
4. A player with no accepted ranked result for the selected board and week is absent.
5. Results from other players and timezones appear publicly before global closure; they
   are not limited to a private pending-current-player callout.
6. A newer accepted Step sync changes the relevant live rankings before closure.
7. Civil date `D` closes at exactly 13:00 UTC on `D + 1`.
8. A normal result or Step sync accepted after closure does not rewrite the final
   snapshot for `D`.
9. Daily defaults to `Today`; Weekly defaults to `This week`.
10. The Daily comparison selector says `Yesterday`; the Weekly comparison selector says
    `Last week`.
11. Every Daily surface displays its actual full date, and every Weekly surface displays
    its actual Monday-through-Sunday range.
12. `Yesterday` always selects the viewer's immediately preceding Competition Date,
    including while that date is provisional.
13. `Last week` always selects the viewer's immediately preceding Competition Week,
    including while that week is provisional.
14. `Today` and `Yesterday`, or `This week` and `Last week`, may be provisional
    simultaneously and refresh independently.
15. History contains finalized periods only and is the place to find the latest closed
    Daily or Weekly period.
16. Live standings update through reasonable automatic polling and pull-to-refresh;
    pushed WebSocket-style delivery is not required.
17. Pull-to-refresh performs a fresh read that includes all accepted results committed
    before the request.
18. Live status and provisional ranking are accessible without relying on color alone.
19. English and French selector/date/status copy preserve identical semantics.

## Non-goals

- Changing quest gameplay, rewards, reset behavior, or result-replacement rules.
- Allowing activity after a player's local midnight to improve the prior date.
- Guaranteeing ingestion from a phone or provider that remains offline through closure.
- Awarding prizes from provisional standings.
- Replacing immutable final snapshots with the live projection.
- Removing audited corrections for documented incidents.
- Combining activity from unrelated boards merely because the player used another part
  of the game.
