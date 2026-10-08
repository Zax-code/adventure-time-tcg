# Plan de remédiation — audit du 7 octobre 2026

Ce document accompagne `docs/audit/2026-10-07-audit.md`. Il décrit, pour chaque problème confirmé, **comment** le corriger sans changer le comportement visible par les joueurs, dans quel ordre, et comment vérifier.

Toutes les références de fichiers sont relatives à la racine du repo `/Users/zax/Develop/adventure-time-tcg`.

---

## 0. Principes non négociables

1. **Aucun changement fonctionnel.** Les contrats `@adventure-time/contracts`, les réponses JSON, les règles de jeu, les règles de scoring et de calendrier du leaderboard restent identiques. Si une remédiation exige un changement de contrat, elle est additive (champ optionnel) et documentée dans la PR.
2. **Leaderboard : le fonctionnel multi-fuseaux est intouchable.** Les joueurs sont répartis sur plusieurs fuseaux. Les invariants ci-dessous ne bougent pas, seule la mécanique technique est nettoyée :
   - une « journée de compétition » est une **date locale naturelle** par joueur (`Leaderboards.Calendar.slot/2`, slots persistés avec bornes UTC immuables) ;
   - la publication d'une journée se fait au **cutoff global** `Calendar.publication_cutoff/1` = 13:00 UTC le lendemain de la date de compétition, pour que tous les fuseaux aient fini leur journée ;
   - une période `closed` / `corrected` est **immuable** sauf via le flux de correction audité (`leaderboards/corrections.ex`) ;
   - `finalize_for_read/2` doit continuer à finaliser paresseusement une période échue quand un lecteur arrive avant le cron ;
   - la fenêtre de `QuestResults.reconcile_open_week/1` commence au **lundi − 1 jour** (pour absorber les fuseaux à l'ouest d'UTC) et ne se rétrécit pas ;
   - les résultats arrivés en retard mais avant le cutoff doivent toujours être pris en compte.
3. **Un lot = une branche `codex/…` depuis `main` = une PR.** Chaque lot est indépendant et mergeable seul. L'utilisateur merge manuellement.
4. **Vérification avant chaque PR** : tests Phoenix ciblés + `mix format` + `mix precommit` pour le backend ; `npm run typecheck` + `cd apps/mobile && npx expo-doctor` pour mobile/shared ; `npm run test:web` pour le web ; flow Maestro ciblé quand une surface mobile change.
5. **Pas de suppression de route Phoenix** tant qu'un client publié peut encore l'appeler (cf. `ranked-start`). On retire côté client d'abord, côté serveur à la release mobile suivante.

---

## Lot 1 — Phoenix : charge de fond et chemins chauds

Branche suggérée : `codex/phoenix-hot-paths`.

### 1.1 `LeaderboardLifecycleWorker` : ne retraiter que ce qui peut encore bouger

**Problème.** `Lifecycle.tick/1` (`apps/phoenix/lib/adventure_time_api/leaderboards/lifecycle.ex:35-55`) tourne chaque minute (`config/config.exs:110`). `competition_dates/2` renvoie toutes les dates distinctes depuis le 15 août 2026 ; pour chacune, `finalize_day_if_due/2` ouvre une transaction, prend un lock par board, puis `build_all_snapshots/4` appelle `Projection.rows/3` pour les 11 boards (les boards dérivés récursent) **avant** que `persist_snapshot/5` ne constate via `reusable_snapshot?/3` que rien n'a changé. `refresh_week/2` fait la même chose par semaine et relance `award_week/2`. `reconcile_open_week/1` recharge tous les `step_snapshots` et `daily_numbers_daily_attempts` de la semaine et appelle `sync_safely` ligne par ligne.

**Ce qui est déjà correct et qu'on garde.** `reusable_snapshot?(current, %Period{status: :closed}, _)` renvoie déjà `true` quand `current.source_cutoff >= period.closes_at`. L'idempotence des prix (`grant_prize/5`, clé `snapshot.id:user:tier`, `on_conflict: :nothing`) est bonne. La fenêtre `since` de `reconcile_open_week` est bonne.

**Remédiation.**

1. **Court-circuit des journées réglées.** Dans `finalize_day_if_due/2`, avant d'ouvrir la transaction :
   ```elixir
   if DateTime.compare(now, period.closes_at) == :lt or day_settled?(period) do
     :ok
   else
     ... (code existant inchangé)
   end
   ```
   avec `day_settled?/1` = `period.status in [:closed, :corrected]` **et** pour chaque `Boards.list_enabled()` il existe un `Snapshot` `current: true` dont `source_cutoff >= period.closes_at`. C'est exactement la condition que `reusable_snapshot?/3` teste déjà, remontée avant le calcul de projection. Une seule requête : `count` des snapshots courants satisfaisant la condition, comparé à `length(boards)`.
2. **Court-circuit des semaines réglées.** Dans `refresh_week/2`, même garde : si `period.status == :closed`, que tous les snapshots courants sont postérieurs à `closes_at`, **et** que `award_week/2` a déjà tourné, on sort. Pour « award déjà tourné », deux options : (a) vérifier qu'il existe au moins un `RewardGrant` par snapshot primé, ce qui est fragile si personne n'a de prix ; (b) **ajouter une colonne nullable `settled_at :utc_datetime_usec` sur `leaderboard_periods`** posée à la fin d'un `finalize_day_if_due` / `refresh_week` réussi en statut `closed`. Option (b) recommandée : explicite, indexable, et le flux de correction peut la remettre à `nil` pour forcer un retraitement. Vérifier dans `corrections.ex` comment une correction fait transiter la période (`:corrected`) et poser `settled_at: nil` au même endroit.
3. **Restreindre `competition_dates/2`** aux dates dont la période jour n'est pas réglée : `left_join` sur `Period` (`period_type: :day`, `competition_date`) et `where is_nil(period.settled_at)`. Toujours inclure `today` et `today - 1` (inchangé). Les dates antérieures au lancement restent filtrées.
4. **`reconcile_open_week/1` incrémental.** Garder la borne `since` telle quelle (lundi − 1, borné au lancement). Ajouter un second filtre `updated_at >= ^watermark` sur `step_snapshots` et `daily_numbers_daily_attempts`, avec `watermark = now - 3 minutes` (3× l'intervalle cron pour absorber un tick raté). Conserver **une passe complète** (sans watermark) une fois par heure à la minute 0 et **systématiquement au premier tick après 13:00 UTC** (le cutoff), pour que la finalisation voie tout. Ne pas toucher à `settle_expired_speed_calculus_runs_since/2`.
5. **Garder `finalize_for_read/2` inchangé** : c'est le chemin paresseux qui protège les lecteurs si le cron a du retard. Il bénéficie automatiquement du court-circuit.

**Garde-fous fonctionnels.** Ne pas modifier `Calendar`, `Configuration`, `Scoring`, `Projection`, `Prizes`, `Ranking`. Ne pas changer `@publication_hour`. Ne pas changer `on_conflict` d'`ensure_period/1`. Une période `open` ou `closing` continue d'être projetée à chaque tick.

**Vérification.**
- `mix test test/adventure_time_api/leaderboards/lifecycle_test.exs` (14 tests) et `quest_results_test.exs`.
- Nouveau test : deux ticks consécutifs sur une journée `closed` avec snapshots courants ne doivent produire **aucune** nouvelle ligne `leaderboard_snapshots` et ne pas appeler `Projection.rows` (assert via `Repo` query count ou en comptant les snapshots avant/après).
- Nouveau test : une correction qui remet `settled_at` à `nil` provoque bien un retraitement au tick suivant.
- Nouveau test : un résultat accepté entre 00:00 et 12:59 UTC du lendemain (joueur à l'ouest d'UTC) est inclus dans le snapshot final de la veille.
- En prod après déploiement : `journalctl -u adventure-time-tcg-api.service` et le temps d'exécution du job Oban `LeaderboardLifecycleWorker` (table `oban_jobs`, `completed_at - attempted_at`) doivent chuter d'un ordre de grandeur.

### 1.2 Auth : une requête SQL par requête authentifiée

**Problème.** `RequireAuth` (`apps/phoenix/lib/adventure_time_api_web/plugs/require_auth.ex:10`) → `Accounts.fetch_auth_user_from_access_token/1` → `auth_user_for_id/1` → `build_auth_user/1` → `auth_methods_for_user/1` (`accounts.ex:1246-1266`) = 1 `Repo.get` + 3 `Repo.exists?`. `GET /me` (`app_controller.ex:12`) refait tout → 8 requêtes.

**Remédiation.**
1. Scinder `build_auth_user/1` en `build_auth_user(user, opts)` avec `include_auth_methods: boolean` (défaut `false`). Quand `false`, `authMethods` n'est **pas** présent dans la map interne.
2. Le plug appelle la version légère. `conn.assigns.auth_user` ne contient donc plus `authMethods`.
3. Grep tous les endroits qui sérialisent `auth_user` vers le client (`app_controller.ex` `/me`, `auth_controller.ex` login/register/refresh, `web_session_controller.ex`, `admin_controller.ex` détail utilisateur, `social`/`gifts` si l'un d'eux renvoie l'utilisateur courant). Pour chacun : si la réponse expose `authMethods` dans le contrat (`authUserSchema` ou équivalent dans `packages/contracts/src/index.ts`), appeler explicitement `Accounts.auth_methods_for_user/1` (à rendre `def`) ou `build_auth_user(user, include_auth_methods: true)`. **Le JSON renvoyé reste identique.**
4. `/me` réutilise `conn.assigns.auth_user` + `auth_methods_for_user` au lieu de rappeler `auth_user_for_id/1`.
5. Optionnel : fusionner les 3 `exists?` en une seule requête (`select` de deux `fragment("bool_or(...)")` sur une `union_all`) pour les chemins qui en ont besoin.

**Garde-fous.** Ne pas mettre `auth_user` en cache (le statut d'approbation `ensure_user_approved/1` doit rester vérifié à chaque requête). Ne pas changer la durée de vie des tokens.

**Vérification.** `mix test test/adventure_time_api_web/controllers/{auth,app,web_session,admin}_controller_test.exs` ; ajouter un test qui vérifie que `/me`, login et refresh renvoient toujours `authMethods` ; `npm run typecheck` (les clients parsent avec zod, un champ manquant casserait le parse en runtime, d'où l'importance du grep de l'étape 3).

### 1.3 PvP : persister `current_player_id` et ne reconstruire qu'une fois

**Problème.** `serialize_match/1` (`apps/phoenix/lib/adventure_time_api/pvp.ex:774-781`) → `current_player_id_map/1` (`:927-941`) → `reconstruct_state/1` (`:562-583`), qui lit le dernier snapshot puis rejoue tous les événements via `BattleEngine.simulate_action`. Snapshots seulement tous les 10 tours (`should_snapshot?/2`, `:1147-1153`). Résultat : `get_match`, `accept_match`, `perform_action`, `end_turn`, `get_spectate` reconstruisent deux fois ; `list_spectatable` reconstruit chaque match en cours du système ; `list_matches` chaque match vivant de l'utilisateur.

**Remédiation.**
1. Migration Ecto : `add :current_player_id, :binary_id` (nullable) sur `pvp_matches` ; index non nécessaire.
2. Dans le chemin d'écriture qui met déjà `current_turn` à jour après `append_event` (`pvp.ex` autour de `:1100-1140`), poser aussi `current_player_id: new_state["currentPlayerId"]`. Faire pareil à la création du battle state (`accept_match`) et dans `timeout_match_if_due/…`.
3. `current_player_id_map/1` : utiliser `match.current_player_id` quand non nil ; sinon fallback `reconstruct_state/1` (matchs créés avant la migration). Pas de backfill obligatoire grâce au fallback ; un backfill one-shot `mix` est possible mais optionnel.
4. Ajouter `serialize_match(match, state)` qui prend l'état déjà calculé et l'utiliser dans `get_match`, `accept_match`, `perform_action`, `end_turn`, `get_spectate` à la place de `serialize_match/1`.
5. `perform_action` : après l'append, dériver le `currentPlayerId` du `new_state` au lieu de rappeler `reconstruct_state`.

**Garde-fous.** Ne pas changer la cadence de snapshot ni la structure des événements (`pvp_match_events` est le journal canonique, les snapshots restent dérivés). Ne pas toucher à `BattleEngine`.

**Vérification.** `mix test test/adventure_time_api/pvp_test.exs test/adventure_time_api_web/controllers/pvp_controller_test.exs` ; test de non-régression : la valeur `match.currentPlayerId` renvoyée après une action est identique à celle obtenue par `reconstruct_state`. Flow Maestro `npm run test:mobile:e2e:pvp:ios`.

### 1.4 Daily Numbers : ne plus résoudre à chaque lecture

**Problème.** `build_daily_numbers_state/3` (`quests.ex:1855-1861`) → `DailyNumbersSolutionHunt.get_or_create_puzzle/2` (`daily_numbers_solution_hunt.ex:27-67`) prend un `pg_advisory_xact_lock` puis, même quand le `DailyNumbersSolutionSet` existe, appelle `DailyNumbersEngine.generate_puzzle_at_attempt/3` qui exécute `solve/2` (DP exhaustive, `daily_numbers_engine.ex:54,310-345`). Les joueurs ayant terminé reprennent le même lock via `ensure_solution_set/3` (`quests.ex:1912`).

**Remédiation.**
1. Créer `AdventureTimeApi.Quests.DailyNumbersPuzzleCache` : une table ETS `:named_table, :set, read_concurrency: true` possédée par un petit GenServer dans l'arbre de supervision, clé `{date, mode, generation_attempt, @solution_key_version}`, valeur = le `puzzle` complet renvoyé par `generate_puzzle_at_attempt/3` (il est déterministe). Purge des clés dont la date est antérieure à `today - 2` à chaque insertion.
2. Dans `get_or_create_puzzle/2`, **avant** la transaction : `Repo.get_by(DailyNumbersSolutionSet, date:, mode:)` (lecture sans lock). Si présent **et** `solution_key_version == @solution_key_version` **et** cache hit → retourner `%{puzzle: cached |> Map.put(:solutionCount, set.solution_count), solution_set: set}` sans lock ni solveur. Sinon, chemin existant (lock + génération + `validate_solution_set!` + `upgrade_solution_set!`), puis `put` en cache.
3. `ensure_solution_set/3` : même garde en tête (set présent, version courante, numbers identiques) → retour direct sans lock.
4. Le lock advisory reste le mécanisme de création/upgrade : aucune course possible sur la génération.

**Garde-fous.** Le cache est process-local et déterministe ; après un redémarrage il se repeuple au premier appel (qui prend le lock une fois). Ne pas modifier `DailyNumbersEngine` ni `DailyNumbersSolver`. Ne pas changer `@solution_key_version`.

**Vérification.** `mix test test/adventure_time_api/quests/daily_numbers*` ; test : deux appels consécutifs à `daily_numbers_state` pour le même `{date, mode}` ne doivent exécuter `solve/2` qu'une fois (assert via `:telemetry` ou un `Agent` compteur injecté en test) ; le slow-log `@slow_daily_numbers_ms 150` (`quests.ex:41`) doit disparaître des logs en prod.

### 1.5 GET qui écrivent : rendre les lectures idempotentes et scoper les sweeps

**Problème.** `list_quests_for_user/…` (`quests.ex:269-306`) fait `materialize_daily_quests` (upsert), `sync_steps_quest` (`update_all`) et `QuestResults.sync_safely` à chaque GET ; `perfect_timing_state` et `daily_numbers_state` idem. `Pvp.list_matches` / `list_history` / `list_spectatable` / `get_spectate` lancent des sweeps d'expiration, et `list_spectatable` / `get_spectate` le font **globalement** (`expire_due_in_progress_matches(nil)`).

**Remédiation.**
1. `materialize_daily_quests` : faire précéder l'upsert d'un `select` léger des quêtes existantes pour `{user_id, reset_date}` ; n'insérer que les types manquants. Zéro écriture en régime établi. Même logique pour la matérialisation dans `perfect_timing_state` / `daily_numbers_state`.
2. `sync_steps_quest` : ne faire l'`update_all` que si la valeur calculée diffère de la valeur stockée (comparer en mémoire sur la quête déjà chargée).
3. `QuestResults.sync_safely` depuis un GET : garder (c'est ce qui rend les résultats visibles rapidement), mais le rendre non bloquant si rien n'a changé : `sync` doit sortir tôt quand le `DailyResult` existant a déjà `raw_result` égal et `result_status in [:accepted, :snapshotted]`.
4. Sweeps PvP : `list_matches` / `list_history` → `expire_due_*(user_id)` (déjà scopé, garder). `list_spectatable` / `get_spectate` → **retirer** l'appel global. Ajouter un worker Oban `PvpMatchTimeoutWorker` cron `* * * * *` qui appelle `expire_due_in_progress_matches(nil)` + `expire_due_pending_invites(nil)` (`ExpirePendingInviteWorker` existe déjà : vérifier s'il couvre déjà les invites et n'ajouter que le timeout des matchs en cours). Garder `maybe_expire_match_if_due(match)` sur `get_match` / `get_spectate` (un seul match, feedback immédiat).

**Garde-fous.** Le joueur doit toujours voir ses quêtes du jour dès le premier GET (la création à la demande reste). Un match dont le tour a expiré doit toujours apparaître expiré dès qu'on l'ouvre (le `maybe_expire` unitaire reste).

**Vérification.** `mix test test/adventure_time_api/quests_test.exs test/adventure_time_api/pvp_test.exs` ; test : un second `GET /quests` identique ne produit aucune écriture (assert sur `updated_at` inchangés).

### 1.6 Historique PvP : projeter hors `initial_state` et paginer

**Problème.** `Match.initial_state` (`pvp/match.ex:16`) est un gros blob JSON chargé par toutes les requêtes `Match`. `list_history` (`pvp.ex:191-203`) charge tous les matchs terminés sans `limit` pour poser `hasReplayData` et `totalCount: length(...)`.

**Remédiation.**
1. Créer un helper de requête `match_list_query/0` = `from m in Match, select: %{m | initial_state: nil}, select_merge: %{has_replay_data: not is_nil(m.initial_state)}` (champ virtuel `has_replay_data` à ajouter au schema avec `field :has_replay_data, :boolean, virtual: true`). L'utiliser dans `list_matches`, `list_history`, `list_spectatable`, et les requêtes des sweeps.
2. `serialize_match` lit `match.has_replay_data` au lieu de `not is_nil(match.initial_state)`.
3. `list_history` : ajouter `limit` + `offset` (ou curseur `updated_at`) avec un défaut généreux (par ex. 50) et `totalCount` via `Repo.aggregate(query, :count)`. **Contrat** : ajouter des paramètres de query optionnels `limit`/`offset` dans `packages/contracts` et `api-client` ; sans paramètre, le serveur renvoie les 50 plus récents. Vérifier côté mobile (`app/pvp-history.tsx`) et web que l'UI ne suppose pas « tout l'historique » ; si elle le suppose, ajouter un « charger plus » ou garder la limite assez haute pour les volumes actuels (vérifier en prod : `select count(*) from pvp_matches group by inviter_id order by 1 desc limit 5`).

**Vérification.** tests `pvp_test.exs` ; `npm run typecheck` ; Maestro PvP.

### 1.7 Autres chargements non bornés

- `Social.list_giftable_users/…` (`social.ex:18-22`) et `gifts_for_user/…` (`:30-35`) : ajouter `limit` et, pour les gifts, ne précharger que ce que la sérialisation utilise ; exposer un paramètre `q` (recherche par display name, `ilike`) pour l'écran de composition de gift. Côté clients, brancher la recherche serveur quand la liste dépasse un seuil (voir lot 2 et lot 3).
- `Accounts.list_admin_users/…` (`accounts.ex:586-589`) : pagination + filtre serveur ; l'admin mobile/web affiche déjà une liste scrollable, garder la même réponse avec `limit` par défaut élevé.
- `list_pending_access_requests/…` (`accounts.ex:688-704`) : remplacer le `MapSet` d'emails par `where: not exists(subquery)`.
- `Quests` : introduire `Quests.load_user_context(user_or_id)` qui charge l'utilisateur **une fois** par requête et le fait passer aux helpers (`current_reset_date_for_user/1`, `reset_timezone_for_user/1`, 41 sites). Les controllers ont déjà `conn.assigns.auth_user.id` ; passer un `%User{}` depuis le plug (ajouter `:current_user` aux assigns dans `RequireAuth`, puisque `Repo.get(User)` y est déjà fait).

### 1.8 Battle log : append O(1) et vue allégée

**Problème.** `battle_engine.ex:4348` `Map.update!(state, "log", &(&1 ++ events))` ; ~15 `length(state["log"])` ; `build_view/2` (`:4152-4157`) renvoie tout le log à chaque réponse ; chaque snapshot le stocke.

**Remédiation (interne au moteur, sans changement de contrat).**
1. Stocker `state["logLength"]` maintenu à chaque append et remplacer les `length(state["log"])` par ce compteur (grep des 15 sites).
2. Remplacer `&1 ++ events` par un accumulateur inversé **uniquement si** aucun consommateur ne dépend de l'ordre dans l'état interne ; sinon garder l'ordre et accepter l'append (le gain principal vient de 3.).
3. `build_view/2` : vérifier ce que les clients lisent réellement. Mobile `src/features/pvp/combat-log-modal.tsx` et web `pvp-pages.tsx` : s'ils reconstruisent le log depuis `events` (replay) ou depuis une route dédiée (`get_spectate` expose `state["log"]`), tronquer `log` dans `build_view` aux N derniers tours (par ex. 3) et exposer le log complet via la route de log/spectate existante. **Si un client lit `battleState.log` en entier**, ne pas tronquer : ajouter d'abord un endpoint `GET /pvp/matches/:id/log`, migrer les clients, puis tronquer à la release mobile suivante.

### 1.9 Divers backend

- **Ouverture de pack** (`inventory.ex:212-226`) : grouper `selected_drops` par `card_id`, puis `Repo.insert_all(OwnedCard, rows, on_conflict: [inc: [quantity: ^n]], conflict_target: [:user_id, :card_id])` (une requête par `card_id` distinct au lieu de deux par carte). Garder la transaction et l'ordre des drops dans la réponse.
- **`RateLimit.Store.prune_expired/1`** (`plugs/rate_limit/store.ex:14`) : prune sur un `Process.send_after` toutes les 30 s dans le GenServer propriétaire au lieu d'avant chaque `check_and_increment`.
- **`WebsiteDocumentPlug`** (`:178`) : lire `index.html` une fois dans `:persistent_term` au premier hit, clé incluant le `mtime` ; en dev, relire si le `mtime` change.
- **`RawBodyReader`** (`:18`) : n'activer le `body_reader` personnalisé que pour le chemin du webhook Fitbit (condition sur `conn.request_path` dans le reader, ou pipeline dédié dans `router.ex`).
- **`MediaController`** (`:46-66`) : ajouter `ETag` = `object_key` (ou l'id d'asset + `updated_at`) et répondre `304` sur `if-none-match` avant de télécharger depuis MinIO ; ajouter `cache-control: private, max-age=86400` pour les assets immuables. Les clients continuent de fonctionner sans changement.
- **Projections live** (`leaderboards/query.ex:179-180`) : cache ETS court (30 s) keyé `{board_key, period_id, max_updated_at_des_results}` ; invalidation naturelle par la clé. Ne pas cacher la vue « history » au-delà de la minute.

---

## Lot 2 — Mobile : polling, keychain et re-renders

Branche suggérée : `codex/mobile-polling-and-rerenders`. Aucun changement d'UI ni de contrat.

### 2.1 Gate de focus sur tous les pollers

**Fichiers.** `apps/mobile/app/(tabs)/pvp.tsx:80,317-338`, `app/pvp-history.tsx:57`, `app/pvp-spectate.tsx:44`, `app/pvp-spectate-match.tsx:28`, `app/(tabs)/quests.tsx:613`, `src/features/leaderboards/rankings-screen.tsx:142`, `src/components/app-header.tsx:46-51`.

**Remédiation.**
1. Créer `src/hooks/use-focused-refetch-interval.ts` :
   ```ts
   export function useFocusedRefetchInterval(ms: number) {
     const focused = useIsFocused();
     return useCallback(
       (query: Query) => (focused && query.state.status !== "error" ? ms : false),
       [focused, ms],
     );
   }
   ```
   et l'utiliser partout où `refetchInterval` est posé. Conserver `refetchOnMount: "always"` et le `useFocusEffect` qui invalide au retour (`pvp.tsx:353`) : c'est ce qui garantit la fraîcheur immédiate à la ré-ouverture.
2. `pvp-spectate-match.tsx` : copier la condition d'arrêt sur statut terminal de `src/features/pvp/use-match.ts:114-124`.
3. `app-header.tsx` : le badge gifts ne doit pas poller depuis chaque onglet. Garder la query `["gifts"]` avec `staleTime: 30_000` mais **sans** `refetchInterval` dans le header ; le poll reste dans l'onglet Gifts (focus-gaté). Le badge se met à jour via l'invalidation existante quand un gift est reçu (notification push → `invalidateQueries(["gifts"])`, vérifier dans `src/hooks/use-notification-response-routing.ts` / `app-notifications.ts` qu'elle existe, sinon l'ajouter).
4. `quests.tsx:613` : passer à 60 s focus-gaté ; le canal realtime `quest_reset` (`_layout.tsx:403`) couvre déjà le reset.
5. Lobby PvP : 5 s focus-gaté est acceptable à court terme. Noter en suivi : pousser les changements de lobby via le socket Phoenix (`src/lib/quest-realtime.ts` comme modèle) et reculer à 30 s.

**Vérification.** `npm run typecheck` ; `cd apps/mobile && npx expo-doctor` ; `npm run test:mobile:e2e:pvp:ios` ; vérifier dans les logs Phoenix locaux (`npm run dev:api`) que, l'app étant sur l'onglet Home, il n'y a plus d'appels `/pvp/*` périodiques.

### 2.2 `getAccessToken` sans keychain quand la session est hydratée

**Fichier.** `apps/mobile/src/lib/api.ts:93-110`.

**Remédiation.**
```ts
export async function getAccessToken() {
  const session = useSessionStore.getState();
  if (session.hydrated) return session.accessToken ?? null;
  return (await getSecureStoreValue("accessToken")) ?? session.accessToken;
}
```
Idem `getRefreshToken`. Vérifier que tous les chemins qui écrivent le token (login, refresh, logout, `e2e-auth`) mettent à jour le store **et** SecureStore (grep `setItemAsync("accessToken"` et `useSessionStore.setState`). Si un chemin n'écrit que SecureStore, le corriger pour écrire les deux.

**Vérification.** `npm run test:startup` (mobile) ; smoke Maestro `npm run test:mobile:e2e:ios` ; scénario manuel : kill app, relance, la session doit rester valide.

### 2.3 Step sync : version stable et tick sans travail inutile

**Fichiers.** `src/lib/local-step-snapshot.ts:120-122`, `src/lib/step-sync.ts:829-958`, `src/hooks/use-step-quest-widget-sync.ts:96-105`, `src/hooks/use-step-sync-manager.ts:58-60`.

**Remédiation.**
1. `local-step-snapshot.ts` : extraire la version serveur en retirant tout suffixe `:local:` déjà présent, puis composer `${serverVersion}:local:${recordedFor}:${progress}`. La chaîne ne grandit plus.
2. `applyLocalStepSnapshotToQuests` : si le quest steps courant a déjà `progress === snapshot.stepCount` et `recordedFor` identique, renvoyer `current` tel quel (référence identique → pas de re-render des observers).
3. `syncDeviceStepsNow` : après `readAuthoritativeDeviceStepsToday`, si `steps === store.deviceStepCount && recordedFor === store.lastRecordedFor && !force`, sortir avant `persistLocalStepSnapshot`, l'écriture widget et `setQueryData`. Garder le chemin complet quand `force` est passé (sync manuel depuis Settings) et au changement de jour.
4. `use-step-quest-widget-sync.ts` : filtrer `queryCache.subscribe` sur `event.query.queryKey[0] === "quests"` et ne dépendre que de `userId`, `preferredStepSource`, `locale` (pas de `user` complet).

**Garde-fous.** Le widget natif doit toujours recevoir la mise à jour quand les pas changent, au changement de jour, et au changement de source/locale. Le fallback hors-ligne (snapshot local appliqué sur les quêtes) reste identique.

**Vérification.** `npm run test:quests` (mobile) ; ajouter un test unitaire sur `applyLocalStepSnapshotToQuests` : deux applications successives produisent la même `version` ; flow Maestro `.maestro/settings-sheet-screenshots.yaml` pour le sync manuel.

### 2.4 Re-renders ciblés

- `app/(tabs)/collection.tsx:419-436` : `renderCollectionItem` ne doit plus dépendre de `visibleCardIds`. Mettre les ids visibles dans un petit store zustand (`useVisibleCardsStore`) ; `CardTile` lit `animationsEnabled` via `useVisibleCardsStore((s) => s.ids.has(cardId))`. Passer `onPressCard(cardId)` stable (`useCallback` sans deps changeantes). `CardTile` reste `memo`.
- `app/(tabs)/quests.tsx:452`, `app/settings.tsx:97` : `useStepSyncStore(useShallow((s) => ({ availability: s.availability, healthPermissionStatus: s.healthPermissionStatus, isSyncing: s.isSyncing, lastError: s.lastError })))`.
- `app/(tabs)/index.tsx:211-221` : extraire `<DailyClaimCountdown claimableAt={...} />` qui possède son propre `setInterval`.
- `app/_layout.tsx:162-167` + `src/hooks/use-notification-response-routing.ts:50-51` : déplacer la logique dépendant de `usePathname`/`useGlobalSearchParams` dans un composant feuille `<RouteSideEffects />` rendu **sous** les providers, pour que le root et ses ~20 souscriptions ne re-rendent plus à chaque navigation. L'archive Daily Numbers publie `archiveDate` dans un store au lieu d'être lue via les params globaux.
- `app/(tabs)/packs.tsx:1313-1340` : ne monter la `PackOpeningSequenceDom` de pré-chauffe que si `useIsFocused()` et tant qu'aucune ouverture n'a encore eu lieu dans la session.
- `app/_layout.tsx:565` : `<StatusBar style={getExpoUIColorScheme(themeName) === "dark" ? "light" : "dark"} />`.
- Listes : `app/pvp-history.tsx:184`, `pvp.tsx:2213` (adversaires), `rankings-screen.tsx:739,1032` → `FlatList` avec `keyExtractor` stable et `initialNumToRender` raisonnable. Les listes bornées (cartes de quête, packs, chips de loadout) restent en `.map`.

**Vérification.** `npm run typecheck` ; `npm run test:ui-regressions` (mobile) ; Maestro `smoke`, `pvp-smoke`, `quests-redesign-smoke` ; captures avant/après dans `tmp-*-shots/<timestamp>/` pour la collection et le Home.

---

## Lot 3 — Web : session et cache

Branche suggérée : `codex/web-session-hardening`.

### 3.1 Ne jamais déconnecter sur une erreur transitoire

**Fichiers.** `apps/web/src/auth/session.ts:128-150`, `auth/auth-provider.tsx:57-62`, `pages/player/core-pages.tsx:87,263,332,397,407`, `pages/player/quest-pages.tsx:68`, `pages/player/settings-page.tsx:63,70`, `components/layout.tsx:120-121,168`, `components/game-art.tsx:291-327`.

**Remédiation.**
1. `restoreWebSession` : sur erreur **non** auth, si `snapshot.status === "authenticated"`, conserver le snapshot (ne pas appeler `clearLocalWebSession`), poser seulement `restoreError` ; si le statut était `restoring` (premier chargement), publier `anonymous` avec le message comme aujourd'hui. Les 401/403 continuent de vider la session.
2. Ajouter dans `session.ts` une fonction `refreshCurrentUser()` qui appelle `webApiClient.me()` et fait `publish({ ...snapshot, user })`. Remplacer tous les `await restore()` post-mutation par `await refreshCurrentUser()`. `restore()` ne reste appelé qu'au montage de `AuthProvider`.
3. Conséquence : le token ne tourne plus à chaque mutation, donc l'avatar n'est plus refetché (`AuthenticatedProfileImage`). Par sécurité, keyer quand même l'effet de `game-art.tsx` sur `imageAssetId` et lire `getAccessToken()` à l'intérieur de l'effet.
4. `auth-provider.tsx` `logout` : `queryClient.clear()` après `destroyWebSession()`.
5. `lib/api.ts:132-142` : `retry: (count, error) => count < 2 && (error instanceof WebApiError || error instanceof ApiClientError) && (error.status === 0 || error.status >= 500)`.

**Vérification.** `npm run test:web` ; tests à ajouter dans `login-page.test.tsx` / un nouveau `session.test.ts` : un refresh qui renvoie 429 pendant que l'utilisateur est authentifié ne change pas le statut ; logout vide le cache react-query.

### 3.2 Daily Numbers, Speed Calculus, uploads

- `quest-pages.tsx:345-348` : `queryFn: () => date ? webApiClient.dailyNumbersArchiveState(date, mode) : webApiClient.dailyNumbersState(mode)` avec la clé `["daily-numbers", mode]` déjà utilisée ligne 124. Supprimer ensuite `startDailyNumbersRanked` de l'api-client (plus aucun client) et, **à la release mobile suivante**, la route Phoenix `ranked-start` (lot 4 décide du sort de `RankedSessions`).
- `quest-pages.tsx:412-427` : deps `[activeRun?.runId, finish.isPending, finish.mutate]`, `finishedRunIdRef` pour ne jamais appeler `finish.mutate` deux fois pour le même `runId`, un seul `setInterval` par `runId`.
- Uploads : dans `packages/api-client/src/index.ts`, `upload()` accepte `{ timeoutMs }` et utilise par défaut `uploadTimeoutMs ?? 120_000` (nouvelle option du constructeur). `apps/web/src/lib/api.ts` et `apps/mobile/src/lib/api.ts` n'ont rien à changer si le défaut est dans l'api-client.

### 3.3 Bundle et rendu

- `main.tsx:13` : déplacer `import "@/styles/admin.css"` dans `pages/admin/index.ts`.
- `styles.css:1-31` : remplacer les 4 TTF par la police variable Nunito en WOFF2 (`@fontsource-variable/nunito`) ou par un subset WOFF2 généré depuis `@expo-google-fonts/nunito` ; garder les mêmes `font-family`/`font-weight` pour ne rien changer visuellement. Conserver `@expo-google-fonts/nunito` dans `apps/web/package.json` tant que `styles.css` le référence.
- `core-pages.tsx:195-210` : `useDeferredValue(search)` + `memo(CardTile)` dans `components/cards.tsx`.
- `core-pages.tsx:388` : `enabled: composerOpen` sur `["gift-users"]`.
- `pvp-pages.tsx:431,555` : `useMemo` sur `getBattleActionOptions` et `replayStateAtCursor`.
- `pvp-pages.tsx:622`, `pvp-actions.ts:48-70`, `catalog-pages.tsx:368` : importer `cardTypeValues`, `pvpStatusNameValues`, `THEME_NAMES` au lieu des copies locales.
- `lib/quest-copy.ts:3,15` : retirer `daily_login` ; `account-deletion-page.tsx:6` : aligner le texte sur l'emplacement réel (`settings-page.tsx:127`).

**Vérification.** `npm run test:web` ; `npm run build:web` et comparer la taille des chunks `index.css` et des polices avant/après.

---

## Lot 4 — Intégrité : scoring ranké, verrou PvP, économie dust

Branche suggérée : `codex/integrity-fixes`. La décision produit du 4.1 a été prise le 7 octobre 2026 : preuve serveur, score inchangé.

### 4.1 `RankedSessions` : preuve serveur, score inchangé (décision prise le 7 octobre 2026)

**État.** `leaderboards/ranked_sessions.ex` (`start_daily_numbers/4` et `settle_daily_numbers/5`, avec `FOR UPDATE`, nonce, deadline sur `slot.ends_at`) n'a aucun appelant hors tests. Le scoring Daily Numbers ranké (`scoring.ex:344-350`) utilise `elapsedMs` fourni par le client (`quests_controller.ex:92`). `POST /quests/daily-numbers/ranked-start` est un no-op. `quest_results.ex` force `ranked_session_id: nil`.

**Fait déterminant.** Le chronomètre mobile (`apps/mobile/app/quests/daily-numbers-play.tsx:700-830`) ne compte que pendant que le plateau est `active` à l'écran, persiste le temps dans SecureStore, et reprend là où il s'était arrêté. Un joueur qui quitte l'app n'est pas pénalisé. **Le score doit donc rester basé sur le temps client** ; un temps serveur strict changerait le gameplay.

**Décision : brancher `RankedSessions` comme preuve d'intégrité, sans toucher à la formule de score.**

1. **`ranked-start` devient réel.** `Quests.start_daily_numbers_ranked/2` appelle `RankedSessions.start_daily_numbers(user, date, mode)` (idempotent : renvoie la session `:started` existante) puis renvoie l'état comme aujourd'hui. Le contrat gagne un champ **optionnel** `rankedSession: { startedAt: string, deadlineAt: string }` dans la réponse d'état Daily Numbers (`packages/contracts`, `dailyNumbersState*Schema`). Aucun client existant ne casse (champ optionnel).
2. **Mobile** : appeler `apiClient.startDailyNumbersRanked(mode)` au moment où le joueur **ouvre le plateau ranké** pour la première fois dans la journée (`daily-numbers-play.tsx`, à l'endroit où le chronomètre démarre pour un `attemptScope` neuf), pas au chargement de l'onglet Quêtes. Pas d'appel pour le mode archive ni pour l'entraînement. Si l'appel échoue (hors ligne), le jeu continue : la soumission se fera sans session (cas 4).
3. **`submit_daily_numbers`** : après l'enregistrement de l'attempt, appeler `RankedSessions.settle_daily_numbers(user_id, date, mode, attempt.id, now)`. Dans `settle_daily_numbers/5`, enrichir l'évaluation d'intégrité (le score n'est pas touché) :
   - `server_elapsed_ms = server_ended_at - server_started_at` stocké dans `client_metadata["serverElapsedMs"]`, avec `client_metadata["clientElapsedMs"] = attempt.elapsed_ms` ;
   - **rejet** (`integrity_status: :rejected`) si `now > server_deadline_at` (déjà codé, `ranked_session_deadline_exceeded`) ou si `client_elapsed_ms > server_elapsed_ms + @tolerance_ms` avec `@tolerance_ms 5_000` (physiquement impossible : le client ne peut pas avoir joué plus longtemps que la fenêtre serveur) → code `client_elapsed_exceeds_server_window` ;
   - sinon `integrity_status: :accepted` avec `server_observed_elapsed`, et en plus un **drapeau non bloquant** `suspicious_elapsed_ratio` quand `client_elapsed_ms < server_elapsed_ms * 0.2` **et** `server_elapsed_ms > 120_000` (le joueur a eu le plateau ouvert plus de 2 min côté serveur mais déclare moins de 20 % de ce temps : compatible avec des pauses légitimes, donc à revoir, pas à rejeter).
4. **Pas de session** (client ancien, ou `ranked-start` jamais appelé) : comportement actuel conservé pendant une release mobile ; `integrity_reason_codes: ["no_ranked_session"]` est posé sur le `DailyResult` via `QuestResults` pour que l'admin voie la différence. À la release mobile suivante, décider si l'absence de session devient un rejet.
5. **`QuestResults.load_source(user, date, :daily_numbers)`** : remplacer `Map.put(:ranked_session_id, nil)` par l'id de la session réglée quand elle existe, et propager `integrity_status` / `integrity_reason_codes` de la session vers le `DailyResult` (`ResultRecorder.record_validated`). `Projection.eligible_results/2` filtre déjà sur `integrity_status == :accepted` (`projection.ex:192`) : un rejet exclut automatiquement le résultat du classement sans autre code.
6. **Admin** : exposer `integrity_reason_codes` et `serverElapsedMs`/`clientElapsedMs` dans la vue admin des résultats de leaderboard, et brancher les méthodes api-client aujourd'hui inutilisées `excludeLeaderboardResult`, `previewLeaderboardCorrection`, `confirmLeaderboardCorrection` sur un écran admin minimal (web d'abord, `apps/web/src/pages/admin/`) pour pouvoir exclure un résultat marqué `suspicious_elapsed_ratio`. Le lot 5.3 **ne supprime donc pas** ces méthodes.
7. **Ne pas changer** `scoring.ex`, la pause du chronomètre mobile, ni `Slots`.

**Vérification.** `mix test test/adventure_time_api/leaderboards/quest_results_test.exs` (adapter les 2 tests existants qui appellent déjà `RankedSessions`) ; nouveaux tests : (a) submit avec session → `ranked_session_id` renseigné et `integrity_status: :accepted` ; (b) `client_elapsed > server + 5 s` → rejeté et absent de `Projection.rows` ; (c) submit sans session → accepté avec `no_ranked_session` ; (d) ratio suspect → accepté avec drapeau. Mobile : `npm run typecheck`, flow Maestro Daily Numbers existant le plus proche (`.maestro/` grep `daily-numbers`) ; vérifier en dev que l'ouverture du plateau produit un `POST /quests/daily-numbers/ranked-start` et un seul par jour et mode.

### 4.2 Verrou de ligne sur `perform_action` / `end_turn`

**Fichier.** `pvp.ex:396-402,471,1117-1126`.

**Remédiation.** Englober dans `Repo.transaction` : `match = Repo.one!(from m in Match, where: m.id == ^match_id, lock: "FOR UPDATE")` → `reconstruct_state` → `guard_your_turn` → simulate → `append_event`. Rescue `Ecto.ConstraintError` sur `pvp_match_events_match_id_seq_index` en `{:error, :conflict}` → 409 dans `pvp_controller.ex`. `next_match_seq` reste tel quel (il est désormais sous le lock). Ajouter un test de concurrence avec deux `Task.async` sur la même action ; exactement une doit réussir.

### 4.3 Une seule table d'économie dust/craft

**Fichiers.** `catalog.ex:13-20,194-212`, `inventory.ex:16-17,35-40`.

**Remédiation.** `Inventory` devient la source (c'est ce qui est facturé). `Catalog.rarity_dust_value/1` et `rarity_craft_cost/1` délèguent à `Inventory.dust_sacrifice_value/1` et `Inventory.dust_craft_cost/1`. Supprimer `@dust_sacrifice_by_rarity` et `@craft_cost_multiplier` de `Catalog`. **Avant** de supprimer, écrire un test qui compare les deux tables pour chaque rareté : si elles diffèrent aujourd'hui, c'est un bug visible (le `/rarities` affiche un prix différent de celui facturé) à corriger dans le sens de ce qui est facturé, et à mentionner dans la PR.

---

## Lot 5 — Nettoyage (code mort, duplications, hygiène)

Peut être découpé en plusieurs PR : 5.1 Phoenix, 5.2 mobile, 5.3 packages, 5.4 repo.

### 5.1 Phoenix

- Supprimer : `Catalog.list_active_packs/0` (+ `to_pack_response/1` si orphelin), les shims `Catalog.rarity_module/image_asset_module/card_module/pack_module`, `Accounts.user_module/email_credential_module/session_module`, `Inventory.owned_card_module`, `SpeedCalculusEngine.build_run_history/2`, `SendmailAdapter.render_verification_message/3` et `render_password_reset_message/3`.
- `Quests.WordleCacheWarmer` : remplacer le GenServer par `{Task, &Quests.WordleDictionary.warm_cache/0}` (ou `Task.Supervisor.start_child`) dans `application.ex`.
- `wordle_dictionary_importer.ex:50-51` : documenter dans AGENTS.md que l'import en prod nécessite un redémarrage du service, ou ajouter une action admin `POST /admin/wordle/dictionary/reload` qui purge le `:persistent_term` dans la release.
- `mix format`, `mix compile --warnings-as-errors`, `mix test`.

### 5.2 Mobile

- **i18n** : retirer les 94 clés listées en annexe A de l'audit dans `apps/mobile/src/i18n/locales/en/*.ts` **et** `fr/*.ts` (structure alignée). Avant suppression de chaque famille, re-grep une dernière fois avec le préfixe parent (par ex. `t("quests.dailyNumbers.` et `` `quests.dailyNumbers.${ ``) pour exclure un usage dynamique. `npm run test:quests` contient `quest-i18n-parity.test.ts`.
- **Alias React** : remplacer `reactEffect` par `useEffect`, `effectEvent(fn)` par `fn`, `asStyle(x)` par `x` dans les 17 fichiers ; supprimer `src/lib/react-primitives.ts` et `src/lib/style-object.ts`.
- **Tests** : ajouter `"test": "node --experimental-strip-types --test test/*.test.ts test/*.test.mjs"` dans `apps/mobile/package.json` ; corriger `test/daily-numbers-board-interaction.test.ts:4` (extension `.ts`) ; réécrire `test/daily-numbers-archive-timer.test.mjs` pour asserter le câblage `resetSignal` et supprimer `resetElapsedMs` de `daily-numbers-play.tsx:815,829`.
- **Duplications** : un seul `withAlpha` exporté depuis `src/components/theme.ts` (prendre celui d'`admin-palette.ts`) ; un seul `formatLocalDate` (celui exporté de `local-step-snapshot.ts`) ; un seul `formatAbilitiesError` dans `src/components/admin/ability-payload.ts` ; `wait` de `src/lib/api.ts` remplace `delay` ; `createPersistedPreferenceStore(key, legacyKey, isValid, defaultValue)` pour `locale-store.ts`, `theme-store.ts` et `wordle-language-store.ts` (qui gagne au passage `runStartupTask` et la gestion d'erreur SecureStore) ; `CARD_BACKCOVER_RATIO` → `CARD_ART_RATIO`.
- **Deps** : retirer `expo-blur` et `connect` de `apps/mobile/package.json`, puis `npm install` et `npx expo-doctor`.
- **Module natif** : `src/lib/play-integrity.ts:5` importe depuis `../../modules/play-integrity` (racine).
- Dé-exporter les symboles de l'annexe B de l'audit.
- Vérification : `npm run typecheck`, `cd apps/mobile && npx expo-doctor`, `npm run test -w @adventure-time/mobile`, Maestro `smoke`.

### 5.3 Packages

- **api-client** : retirer les méthodes sans appelant `adminAllowedEmails`, `addAdminAllowedEmail`, `updateAdminAllowedEmail`, `deleteAdminAllowedEmail`, `leaderboardBoards`, `registerNotificationDevice`, `unregisterNotificationDevice`. **Garder** `excludeLeaderboardResult`, `previewLeaderboardCorrection`, `confirmLeaderboardCorrection` : elles sont branchées par la section 4.1 (écran admin d'exclusion). Les routes Phoenix restent.
- **contracts** : supprimer les 18 exports morts (annexe C), dé-exporter les ~80 sous-schémas internes, remplacer les 6 alias purs par un seul nom (garder le nom utilisé par les clients, grep avant).
- **game-engine** : réorganiser en trois entrées `targeting` (types + `getAbilityTarget`, `getValidTargets`, `requiresTargetSelection`), `type-chart` (`getStrongAgainst`, `getWeakAgainst`, `getTypeMultiplier`) et `replay` (`applyEventsToState`, `groupEventsByTurn`, avec un `createInitialReplayState` minimal inliné pour couper l'import de `simulate.ts`). Supprimer `resolve.ts`, `simulate.ts`, `context.ts`, `abilityDefs.ts`, `rng.ts`, `rarity.ts`, `speed.ts`, `pvp/replay-contract.ts`, `calculateCollectionCompletion` et leurs tests. Conserver `src/index.ts` ré-exportant les trois entrées pour ne pas casser les imports existants (`@adventure-time/game-engine`). Vérifier par `npm run typecheck` que web et mobile compilent, et par `npm run build:web` que le chunk `pvp-pages` ne grossit pas.
- **packages/db** : passer `workspaces` de `packages/*` à une liste explicite sans `packages/db`, retirer l'alias `@adventure-time/db` de `tsconfig.base.json`, retirer `db:generate`/`db:migrate` du `package.json` racine. Le dossier reste comme référence (CLAUDE.md), mais n'est plus installé ni typechecké. Ajouter une ligne dans `packages/db/README.md` : « archivé, ne pas exécuter contre la base Phoenix ».

### 5.4 Repo

- Supprimer `infra/scripts/deploy-phoenix.sh`, `infra/scripts/render-container-envs.sh`, leurs tests dans `infra/scripts/tests/`, les deux steps correspondants du job `infra-test` de `.github/workflows/ci.yml`, et corriger le paragraphe `docs/infra-runbook.md:28`. Avant : confirmer via la skill `operate-leaetzak-vps` que `render-container-envs.sh` n'est pas invoqué manuellement sur le VPS.
- Supprimer `infra/scripts/import-pwa-cards.mjs`, `import-pwa-abilities.mjs`, `import-wordle-dictionary.mjs`, `infra/scripts/bootstrap-host.sh` (remplacés par `mix pwa_import` et le flux PR #300).
- Supprimer `app.json` racine et la ligne `^app\.json$` du filtre `mobile_and_shared` de `ci.yml`.
- Supprimer `apps/mobile/apps/` (256 Mo, non tracké) et, dans `apps/mobile/scripts/release-ios.mjs` / `release-android.mjs`, résoudre `--output` contre `mobileRoot` au lieu de `process.cwd()`.
- `AGENTS.md` ↔ `CLAUDE.md` : fusionner `## Agent skills` (présent seulement dans CLAUDE.md) et `## Project-state maintenance` (présent seulement dans AGENTS.md) dans AGENTS.md, puis mirror intégral dans CLAUDE.md (titre + intro différents uniquement). Documenter au passage `react-doctor`, `compose.yml`/`dev:stack`, Appium et `rotate-env-secrets.sh`.
- `.maestro/README.md` : index des 60 flows avec une ligne par flow (but, commande, dernier usage) ; supprimer les `*-screenshots` manifestement remplacés et `.maestro/card-variant-screenshots-temp.yaml`.
- `.gitignore` : ajouter `!.agents/skills/generate-card/` (ou sortir la skill du dossier ignoré) ; ajouter `.tmp-*-venv/`.
- `DESIGN_OUTLIERS.md` : corriger les 3 chemins obsolètes ; `docs/migration-audit.md` : bannière « historique ».
- Housekeeping git (hors PR, à faire par l'utilisateur) : `git branch -d $(git branch --merged main | grep codex/)`, revue des 3 stashes, suppression des refs `refs/t3/*` et `refs/codex/turn-diffs/*`, `git gc`.

---

## Ordre d'exécution recommandé et estimation

| Ordre | Lot | PRs | Risque fonctionnel | Gain |
|------:|-----|----:|--------------------|------|
| 1 | Lot 1 (1.1 à 1.4 d'abord, puis 1.5 à 1.9) | 2 à 3 | faible si les garde-fous sont respectés | charge SQL prod divisée par un facteur important, latence PvP/quêtes |
| 2 | Lot 2 (2.1 à 2.3, puis 2.4) | 2 | nul (pas d'UI) | requêtes réseau mobiles divisées par ~10 hors onglet PvP, batterie |
| 3 | Lot 3 | 1 | faible | fin des déconnexions web intempestives |
| 4 | Lot 4 | 1 à 2 | faible (4.1 décidé : preuve serveur, score inchangé) | intégrité |
| 5 | Lot 5 | 3 à 4 | nul | maintenabilité, CI plus rapide |

Lots 1 et 2 sont indépendants et peuvent être menés en parallèle dans les deux worktrees (`adventure-time-tcg` et `adventure-time-tcg-agent-secondary`).

---

## Prompt de handoff pour une nouvelle session

Copier-coller tel quel :

```
Tu travailles dans /Users/zax/Develop/adventure-time-tcg (lis CLAUDE.md en entier avant de commencer, il prime sur tout le reste).

Contexte : un audit du code a été fait le 7 octobre 2026. Deux documents en résument les conclusions et le plan :
- /Users/zax/Develop/adventure-time-tcg/tmp/audit-2026-10-07.md (constats, avec fichiers et numéros de ligne)
- /Users/zax/Develop/adventure-time-tcg/tmp/remediation-plan-2026-10-07.md (remédiations détaillées, lot par lot, avec garde-fous et vérifications)

Lis ces deux fichiers intégralement avant d'agir. Tous les constats ont été validés par l'utilisateur.

Ta mission : exécuter le plan de remédiation, lot par lot, dans l'ordre du tableau « Ordre d'exécution recommandé » (Lot 1 Phoenix chemins chauds → Lot 2 mobile polling/re-renders → Lot 3 web session → Lot 4 intégrité → Lot 5 nettoyage).

Règles :
1. Zéro changement fonctionnel. Les contrats dans packages/contracts, les réponses JSON, les règles de jeu et le calendrier du leaderboard restent identiques. Un champ de contrat ne peut être qu'ajouté, optionnel, et signalé dans la PR.
2. Leaderboard : les utilisateurs sont sur plusieurs fuseaux horaires. Le cutoff de publication global à 13:00 UTC le lendemain (Leaderboards.Calendar.publication_cutoff/1), les slots de dates locales par joueur, l'immutabilité des périodes closed/corrected, la finalisation paresseuse finalize_for_read/2 et la fenêtre « lundi − 1 jour » de reconcile_open_week/1 ne changent pas. Seule la mécanique technique est nettoyée (court-circuit des périodes réglées via une colonne settled_at, competition_dates restreint aux périodes non réglées, réconciliation incrémentale avec passe complète horaire et au premier tick après 13:00 UTC). La section 1.1 du plan détaille tout ; respecte-la à la lettre et ajoute les tests qu'elle liste.
3. Pour chaque lot : git switch main && git pull --ff-only origin main, puis une branche codex/<nom-du-lot> fraîche, des commits par changement logique, push, et une PR par lot avec : ce qui a changé, la vérification exécutée, et tout changement de contrat / migration / suivi opérationnel. L'utilisateur merge lui-même ; ne merge jamais.
4. Avant chaque PR : Phoenix → tests ciblés + mix format + mix precommit ; mobile/shared → npm run typecheck + cd apps/mobile && npx expo-doctor + le flow Maestro ciblé quand une surface mobile change (via scripts/maestro.sh, jamais maestro brut) ; web → npm run test:web. Dis explicitement ce que tu n'as pas pu vérifier.
5. Ne supprime pas de route Phoenix encore appelée par un client publié (ex. ranked-start) : retire côté client d'abord, côté serveur à la release mobile suivante.
6. Lot 4.1 (RankedSessions) est décidé : preuve serveur, score inchangé. Implémente exactement la section 4.1 du plan (session créée à l'ouverture du plateau, réglée à la soumission, rejet uniquement si deadline dépassée ou temps client > fenêtre serveur + 5 s, drapeau non bloquant pour les ratios suspects, score toujours basé sur le temps client, pause du chronomètre mobile conservée). Conséquence pour le lot 5.3 : ne supprime pas les méthodes api-client excludeLeaderboardResult / previewLeaderboardCorrection / confirmLeaderboardCorrection, elles servent à l'écran admin de la section 4.1.
7. Premier commit du Lot 1 : copier les deux documents de tmp/ vers docs/audit/2026-10-07-audit.md et docs/audit/2026-10-07-remediation-plan.md pour qu'ils soient versionnés.
8. Si un constat de l'audit s'avère faux une fois dans le code, ne le corrige pas : note-le dans la PR et passe au suivant.
9. Les lots 1 et 2 sont indépendants ; si l'utilisateur te demande d'utiliser le worktree secondaire (/Users/zax/Develop/adventure-time-tcg-agent-secondary), suis les règles Worktrees de CLAUDE.md.

Commence par le Lot 1, section 1.1 (LeaderboardLifecycleWorker). Annonce en une ligne ce que tu vas faire, puis avance sans demander de permission pour les actions réversibles.
```
