# ADR 0002: Local-First Step Quest Widget

## Status

Accepted.

## Context

The step quest widget and step quest card need to feel as close to real time as
the device platform allows. Server sync is still valuable, but it must not be
the gate for showing step progress, showing local completion, or sending the
step-goal notification.

The app already has the right broad shape:

- native widgets render from local snapshots
- the mobile app can read HealthKit, CMPedometer, and Health Connect
- iOS native background delivery can write a local widget snapshot before
  attempting network sync
- Phoenix remains the authority for persistence, rewards, and claims

This ADR defines the local-first contract that implementation must follow.
When implementation details are unclear, prefer this document over ad hoc
server-first behavior.

## Decision

Device-health step progress is local-first for display and notifications.
Server state remains authoritative for coin rewards and claim success.

The contract only applies when the selected step source is `device_health`.
When the selected source is `fitbit`, the widget and app must use Fitbit/server
data or a fallback state.

## Authority Rules

For the phone-local current day:

- Local device steps are the display authority for the step quest widget.
- Local device steps are also the display authority for the in-app step quest
  card.
- Progress is monotonic for the current local day. If a new local read is lower
  than the stored local snapshot, keep the higher value.
- Server responses may fill metadata such as quest id, target, reward, title,
  description, and action path.
- Server responses may override `claimed` and `failed`.
- Server responses must not visually downgrade current-day local progress while
  `device_health` is selected.
- Date rollover, logout, or switching away from `device_health` clears the
  applicable local-first state.

The app/server timezone should follow the phone timezone, but local-first
display follows the phone-local day because HealthKit and Health Connect expose
daily device totals that way.

## Completion And Claiming

When local device steps reach the quest target:

- the widget may show the quest as completed or reward-ready immediately
- the app step quest card may show completed immediately
- the claim button should keep the normal `Claim` label
- tapping `Claim` performs a single sync-then-claim flow

The sync-then-claim flow is:

1. Disable the claim button and show the normal loading state.
2. Read fresh local steps.
3. Persist the local snapshot using the monotonic current-day rule.
4. Post steps to Phoenix.
5. Refetch quests.
6. If Phoenix confirms completion, claim the quest.
7. If Phoenix still reports incomplete or the network fails, re-read local
   steps and retry the step sync once.
8. If it still cannot claim, re-enable `Claim` and show a small sync warning
   near the claim action.

The user should not need to tap a separate `Sync now` action to claim a
locally completed quest.

## Notifications

The step-goal notification is local-first:

- Send it when a trusted local read first observes `>= 10,000` steps for the
  current local day.
- Do not require server confirmation before sending it.
- Send it even if the app did not observe the exact threshold-crossing event.
- Respect the existing `notificationPreferences.stepGoal` setting.
- Track notification delivery once per user per local date.
- JS foreground code, iOS native background code, and Android native background
  code must share equivalent notification ledger semantics so the user is not
  double-notified.
- Native paths use the latest locally stored notification preference. They
  should not call the server only to re-check the preference before sending.

## Local Persistence

Persist the local device-health step snapshot so cold starts and widgets can
render local-first progress before a new device read completes.

The persisted snapshot should include:

- `userId`
- `source`
- `recordedFor`
- `stepCount`
- `updatedAt`

Use the snapshot only when:

- the selected step source is `device_health`
- the snapshot belongs to the current user
- the snapshot is for the current phone-local date

On logout, clear the widget snapshot, the persisted local step snapshot, and
enough notification ledger state to prevent old-user notifications or widget
data from leaking after logout.

## Update Frequency

Local updates should be as fresh as the platform reasonably allows. Network
sync should be throttled for battery.

Foreground app behavior:

- In-app step progress updates every 5 pedometer callback events.
- Persisted widget snapshot writes are lightly coalesced while incomplete.
- Completion bypasses coalescing and writes immediately.

iOS native background behavior:

- HealthKit observer updates write a local widget snapshot on every observer
  update.
- Completion sends the local-first notification once.

Android native background behavior:

- Use a native Health Connect `WorkManager` path so the widget can refresh more
  independently while the app is not running.
- Android background reads are best-effort and periodic, not truly real time.
- Enqueue a one-time worker when the widget is added, the app starts with
  `device_health`, permissions are granted, or the step source switches to
  `device_health`.
- Keep foreground behavior near real time even if Android background-read
  permission/capability is unavailable.
- If Android background-read permission or capability is denied/unavailable,
  degrade background freshness rather than blocking foreground local-first step
  tracking.

## Server Sync

Server sync is best-effort reconciliation, not the display gate.

Background paths may attempt server sync after local snapshot and notification
work, but network attempts must be battery-conscious:

- while incomplete, try server sync at most once every 15 minutes
- when local progress first reaches the target, try one immediate server sync
- after that completion sync attempt, return to the 15-minute throttle

Server fetches after sync may update metadata and authoritative terminal states,
but must preserve higher current-day local progress.

## Platform Scope

This work should ship as one PR covering:

- shared JS local snapshot and quest overlay behavior
- widget snapshot reconciliation
- local-first notification ledger
- sync-then-claim behavior
- iOS local-first guardrails
- Android native Health Connect worker and notification delivery

## Validation

Minimum validation for this change:

- `npm run typecheck`
- `cd apps/mobile && npx expo-doctor`
- targeted Android build/type validation sufficient to compile Kotlin changes
- targeted iOS build/type validation sufficient to compile Swift changes where
  feasible
- focused simulator/device validation for the step quest widget if local build
  artifacts are available

When runtime validation is limited by HealthKit/Health Connect device
availability, report that explicitly.
