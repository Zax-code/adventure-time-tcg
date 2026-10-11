# Kick-off prompt for the implementation session

Paste the block below into a new Claude Code session opened in
`/Users/zax/Develop/adventure-time-tcg`.

```text
Implement the Adventure Time TCG design system, lot by lot, from these sources:

- Plan: docs/design/design-system-implementation-plan.md (read it fully first; it defines lots 0 to 7, acceptance criteria, verification and metrics).
- Spec: docs/design/design-system-proposal.pen, summarized in docs/design/design-system-proposal.md. Board 01 = tokens, board 02 = component anatomy and variants, board 03 = rules (surface taxonomy, screen anatomy, tone semantics, button hierarchy), board 04 = the target design of each screen. Read the .pen only through the Pencil MCP tools; never Read or grep it. Before the first Pencil call check get_app_state: the execute tool's filePath does not switch documents, it edits whatever is active. Open a file with `open -a Pen <path>` if needed, and never save over docs/design/view-inventory.pen.
- Current state: docs/design/view-inventory.pen and the captures in docs/design/view-inventory/mobile/.
- Code audit facts are in the plan's metrics table and lot descriptions; the main component files are apps/mobile/src/components/*, apps/mobile/src/components/admin/admin-ui.tsx, apps/mobile/src/features/quests/*, apps/web/src/components/ui.tsx, apps/web/src/styles.css, apps/web/src/theme/theme.css and packages/theme/src/index.ts.

Rules:
- Follow CLAUDE.md: fresh branch from main per lot named codex/ds-<lot>, commit each logical change, push, open a pull request per lot; the user merges. Do not merge.
- No behavior, route, copy, contract, backend or data change. Only chrome, hierarchy and controls move to shared components. Keep every test id.
- Collectible cards are never wrapped in a Card or a captioned tile; CardTile, pack reveal and gift cards keep their art and rarity outline.
- NativeWind className first; style props only for gradients, blur, animation, measured sizes, safe-area math and contentContainerStyle. Command buttons only through the shared Button. Direct Pressable stays for cards, rows, chips, segments, game keys, board controls and backdrops.
- Values come from the spec, not from memory: radius 12/16/24/28/pill, spacing 4-point, type display 34 / h1 28 / h2 22 / h3 17 / body 15 / sm 13 / caption 12 / overline 11, weights 400/600/700/800, controls 52/44/36, icon button 40, input 48, headers 56, tab bar 68, tab label 11.
- Tone semantics: primary = brand and selection; secondary = coins, rewards, Legendary, warnings inside a Notice; accent = admin, Epic, themes, Daily Numbers; success = ready, live, Uncommon, Steps; info = system guidance, stats, Rare, Speed Calculus; danger = destructive and penalties. Never uppercase except the overline role.

Work order and gates:
1. Start with lot 0 (tokens). Do not start lot 1 until lot 0's acceptance criteria pass and its pull request is open.
2. Then lot 1 (mobile primitives, with the dev-only kit route), lot 2 (headers, sheets, tab bar), lot 3 (tab screens, one commit per screen), lot 4 (stack screens and games), lot 5 (admin), lot 6 (web parity), lot 7 (icons).
3. For every lot run npm run typecheck, npm run doctor and cd apps/mobile && npx expo-doctor; for lots 2 to 5 rebuild and reinstall the iOS E2E app and re-run .maestro/view-inventory-screenshots.yaml and .maestro/view-inventory-overlays.yaml through scripts/maestro.sh (MOBILE_TEST_PASSWORD required), export the captures to a timestamped folder, compare them with the proposal's board 04 and with docs/design/view-inventory/mobile/, and attach the new captures to the pull request. For lot 4 also run .maestro/wordle-scroll-keyboard.yaml and the PvP smoke flow.
4. At the end of each lot update docs/PROJECT_STATE.md (status, branch, commit) and refresh the metrics table in the plan with measured numbers.
5. Report per lot: what changed, what was verified with output, what could not be verified, and any place where the spec and the code disagreed and how you resolved it.

If a screen in the spec conflicts with existing behavior or a test id, keep the behavior, note the conflict in the pull request, and move on. If signing material, simulators or the E2E build are missing, say exactly what is missing instead of skipping verification silently.

Begin with lot 0 now.
```
