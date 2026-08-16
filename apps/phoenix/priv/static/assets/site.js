/* Adventure Time TCG — public site behavior
 * 1. Theme switcher with persistence (candy / ice / nightosphere)
 * 2. Public-site language switcher (English / French)
 * 3. Soft navigation between public pages
 * 4. Live status page polling against the JSON health probes
 */
(function () {
  "use strict";

  var THEMES = ["candy", "ice", "nightosphere"];
  var STORAGE_KEY = "attcg-web-theme";
  var LANGUAGES = ["en", "fr"];
  var LANGUAGE_STORAGE_KEY = "attcg-web-language";
  var THEME_META = {
    candy: "#fff0f5",
    ice: "#f0f7ff",
    nightosphere: "#0d0010",
  };
  var PAGE_KEYS = {
    "/": "home",
    "/status": "status",
    "/privacy": "privacy",
    "/account-deletion": "accountDeletion",
  };
  var I18N = {
    en: {
      "common.skip": "Skip to content",
      "common.brandAria": "Adventure Time TCG home",
      "common.tagline": "Collect cards. Complete quests. Battle friends.",
      "common.primaryNav": "Primary",
      "common.footerNav": "Footer",
      "common.languageSwitch": "Choose a language",
      "common.themeSwitch": "Choose a theme",
      "nav.home": "Home",
      "nav.status": "Status",
      "nav.privacy": "Privacy",
      "nav.accountDeletion": "Account deletion",
      "nav.security": "Security",
      "nav.support": "Support",
      "language.en": "EN",
      "language.fr": "FR",
      "language.enFull": "English",
      "language.frFull": "French",
      "theme.candy": "Candy Kingdom theme",
      "theme.ice": "Ice Kingdom theme",
      "theme.nightosphere": "Nightosphere theme",

      "page.home.title": "Adventure Time TCG",
      "page.home.description":
        "Adventure Time TCG is the mobile-first card battler where you collect cards, complete quests, and jump into real-time PvP.",
      "page.status.title": "Game Status - Adventure Time TCG",
      "page.status.description":
        "Check whether Adventure Time TCG is ready for sign-in, quests, packs, and battles.",
      "page.privacy.title": "Privacy Policy - Adventure Time TCG",
      "page.privacy.description":
        "How Adventure Time TCG handles account, gameplay, and optional step-sync data.",
      "page.accountDeletion.title": "Account Deletion - Adventure Time TCG",
      "page.accountDeletion.description":
        "Delete your Adventure Time TCG account from the app settings screen whenever you need to.",
      "page.notFound.title": "Page Not Found - Adventure Time TCG",
      "page.notFound.description":
        "The requested Adventure Time TCG page could not be found. Return to the homepage or contact support.",

      "home.heroAria": "App overview",
      "home.eyebrow": "Mobile card battler",
      "home.title":
        'Collect, quest, and battle in <span class="grad">Adventure Time TCG</span>.',
      "home.lede":
        "Build a collection of Adventure Time cards, open packs, complete daily challenges, and test your team in friendly head-to-head battles.",
      "home.pillListAria": "What you can do",
      "home.pill.collect":
        "Open packs and grow a collection of character cards",
      "home.pill.earn": "Earn coins, dust, and rewards from daily play",
      "home.pill.battle":
        "Challenge friends and watch matches unfold turn by turn",
      "home.cta.play": "See how it plays",
      "home.cta.privacy": "Privacy & account",
      "home.snapshotAria": "App snapshot",
      "home.iconAlt":
        "Adventure Time TCG app icon showing a collectible card with Finn",
      "home.tile.collect.label": "Collect",
      "home.tile.collect.value": "Cards & packs",
      "home.tile.progress.label": "Progress",
      "home.tile.progress.value": "Quests & rewards",
      "home.tile.play.label": "Play",
      "home.tile.play.value": "Friendly battles",
      "home.statsAria": "At a glance",
      "home.stat.play": "Ways to play each day",
      "home.stat.languages": "Languages: English & French",
      "home.stat.pvp": "Challenge other players",
      "home.stat.daily": "Fresh quests and rewards",
      "home.howAria": "How the app plays",
      "home.how.kicker": "How it plays",
      "home.how.title": "A card collection with something to do every day",
      "home.how.body":
        "Open packs, make progress, and bring your favorite cards into battle.",
      "home.loopAria": "Gameplay loop",
      "home.screenshotsAria": "App screenshots",
      "home.screenshot.questsAlt":
        "Adventure Time TCG daily quests screenshot",
      "home.screenshot.numbersAlt":
        "Adventure Time TCG daily numbers quest screenshot",
      "home.screenshot.wordleAlt":
        "Adventure Time TCG daily Wordle quest screenshot",
      "home.screenshot.collectionAlt":
        "Adventure Time TCG collection screenshot",
      "home.feature.collect.kicker": "Collect",
      "home.feature.collect.title": "Open packs and find new cards",
      "home.feature.collect.body":
        "Crack open reward packs, discover characters, and grow your Adventure Time roster.",
      "home.feature.quest.kicker": "Quest",
      "home.feature.quest.title": "Complete quick daily challenges",
      "home.feature.quest.body":
        "Check in, solve playful quests, sync optional step progress, and earn coins, dust, and packs.",
      "home.feature.packs.kicker": "Upgrade",
      "home.feature.packs.title": "Craft the cards your team needs",
      "home.feature.packs.body":
        "Recycle extras into dust, chase rarities, and turn rewards into real collection progress.",
      "home.feature.battle.kicker": "Battle",
      "home.feature.battle.title": "Bring your team into friendly PvP",
      "home.feature.battle.body":
        "Pick a loadout, make tactical choices, and follow every turn in the battle log.",
      "home.friendlyAria": "Player-friendly features",
      "home.friendly.kicker": "Player friendly",
      "home.friendly.title": "Built for playful, low-pressure sessions",
      "home.card.status.kicker": "Easy check-in",
      "home.card.status.title": "Know when the game is available",
      "home.card.status.body":
        "The status page gives players a simple place to check whether sign-in, collections, and battles are working normally.",
      "home.card.status.link": "Check game status",
      "home.card.account.kicker": "Account care",
      "home.card.account.title": "Your progress belongs to your account",
      "home.card.account.body":
        "Sign in to keep your collection, quest progress, gifts, preferences, and battle history with you.",
      "home.card.account.link": "See privacy details",
      "home.card.deletion.kicker": "Account deletion",
      "home.card.deletion.title": "You can delete your account",
      "home.card.deletion.body":
        "The account deletion page explains what is removed, what may be retained for safety, and how to request deletion.",
      "home.card.deletion.link": "Delete account details",

      "policy.privacy.title": "Privacy Policy",
      "policy.privacy.lede":
        "How Adventure Time TCG handles account, gameplay, and optional step-sync data.",
      "policy.privacy.detailsAria": "Privacy Policy details",
      "policy.privacy.kicker": "Privacy",
      "policy.privacy.heading": "What we store and why",
      "policy.account_deletion.title": "Account Deletion",
      "policy.account_deletion.lede":
        "Delete your Adventure Time TCG account from the app settings screen whenever you need to.",
      "policy.account_deletion.detailsAria": "Account Deletion details",
      "policy.account_deletion.kicker": "Account deletion",
      "policy.account_deletion.heading": "How to delete your account",
      "policy.highlightsAria": "Policy highlights",
      "policy.highlight.controls":
        "Plain-language controls live in the mobile settings screen",
      "policy.highlight.progress":
        "Gameplay progress stays tied to your signed-in account",
      "policy.highlight.health":
        "Optional health data is used only for step quest progress",
      "policy.cta.details": "Read the details",
      "policy.cta.overview": "App overview",
      "policy.controlsAria": "Data controls",
      "policy.tile.account.label": "Account control",
      "policy.tile.account.value": "Settings screen",
      "policy.tile.privacy.label": "Privacy policy",
      "policy.tile.deletion.label": "Deletion help",
      "policy.tile.support.label": "Support",
      "policy.tile.open": "Open page",
      "privacy.account.kicker": "Account",
      "privacy.account.title": "Account and authentication data",
      "privacy.account.body":
        "We store your email address, display name, password authentication state, preferred language, timezone, profile image, and session tokens so you can sign in and keep your account secure.",
      "privacy.gameplay.kicker": "Gameplay",
      "privacy.gameplay.title": "Game progress data",
      "privacy.gameplay.body":
        "We store coins, dust, cards, packs, gifts, quests, PvP loadouts, matches, battle events, and related timestamps so the game can preserve your progress.",
      "privacy.activity.kicker": "Activity",
      "privacy.activity.title": "Optional step-sync data",
      "privacy.activity.body":
        "If you enable step quests, the app reads step counts from Apple Health, Health Connect, the device pedometer, or Fitbit. We store daily step totals, source, date, and sync timestamps for quest progress. We do not sell this data.",
      "privacy.notifications.kicker": "Notifications",
      "privacy.notifications.title": "Notification data",
      "privacy.notifications.body":
        "If you enable notifications, we store installation identifiers and push tokens so the app can send requested quest, gift, and PvP alerts. You can disable notification preferences in the app or revoke OS permission at any time.",
      "privacy.sharing.kicker": "Sharing",
      "privacy.sharing.title": "Sharing and third parties",
      "privacy.sharing.body":
        "Data is sent securely when you use the app. Third-party services are used only as needed for platform login, push notifications, app store distribution, and optional Fitbit connection.",
      "privacy.security.kicker": "Security",
      "privacy.security.title": "Access-request fraud prevention",
      "privacy.security.body":
        "When you request access, we may assess your IP network, request and app metadata, and Android app/device integrity to help a super administrator review abuse risk. IPQualityScore processes the IP and limited technical metadata for this purpose. The result is advisory only: a person approves or rejects every request. Exact IPs are removed 30 days after review, detailed evidence after 90 days, and the review record after one year.",
      "privacy.control.kicker": "Control",
      "privacy.control.title": "Access and deletion",
      "privacy.control.body":
        "You can delete your account in the mobile settings screen. Deletion removes your account, credentials, collection, gifts, quest progress, PvP data, step snapshots, notification devices, and profile image from Adventure Time TCG.",
      "privacy.control.link": "Open deletion instructions",
      "deletion.inApp.kicker": "In app",
      "deletion.inApp.title": "Delete from settings",
      "deletion.inApp.body":
        "Sign in, open Settings, scroll to Privacy and data, then choose Delete my account. Confirm the prompt to permanently remove your account and gameplay data.",
      "deletion.removed.kicker": "Deleted data",
      "deletion.removed.title": "What is removed",
      "deletion.removed.body":
        "Account deletion removes login credentials, sessions, collection data, gifts, quest progress, PvP data, step snapshots, notification devices, access requests, verification codes, and your profile image.",
      "deletion.help.kicker": "Help",
      "deletion.help.title": "Need assistance?",
      "deletion.help.body":
        "If you cannot access the app, contact support from the account email address and request account deletion. We may ask you to verify ownership before acting.",

      "auth.iconAlt": "Adventure Time TCG app icon",
      "email.pending.badge": "Confirmation",
      "email.pending.title": "Confirm your email",
      "email.pending.body":
        "Finish here in the browser, or open the app and continue without typing the code by hand.",
      "email.waiting.badge": "Waiting",
      "email.waiting.title": "Your email is confirmed",
      "email.waiting.body":
        "Your account is created, but a super admin still needs to approve access before your first sign-in.",
      "email.ready.badge": "Account ready",
      "email.ready.title": "Your account is ready",
      "email.ready.body":
        "Your email is confirmed and access is already approved. Open the app to sign in.",
      "email.error.badge": "Invalid link",
      "email.invalid.title": "This code could not be confirmed",
      "email.invalid.body":
        "The code looks incorrect. Open the app to edit the email, verify the code, or request a fresh one.",
      "email.missing.title": "No verification is waiting",
      "email.missing.body":
        "This link does not match any active verification. Open the app to request a fresh code or restart signup.",
      "email.expired.title": "This link is no longer active",
      "email.expired.body":
        "This code may have already been used or it expired. Open the app to request a new code.",
      "email.action.confirmInBrowser": "Confirm in browser",
      "email.action.openInApp": "Open the app",
      "email.action.openApp": "Open the app",
      "email.action.openAppToSignIn": "Open the app to sign in",
      "email.action.backToApp": "Back to the app",
      "email.label.email": "Email",
      "email.label.code": "Code",
      "email.help":
        "The same code also works in the app's sign-up verification screen.",
      "email.tile.app.label": "App",
      "email.tile.app.value": "Opens directly with a deep link",
      "email.tile.browser.label": "Browser",
      "email.tile.browser.value":
        "Can finish verification without retyping the code",
      "email.tile.tip.label": "Tip",
      "email.tile.tip.value":
        "If nothing opens, return to the app and paste the code manually.",
      "reset.pending.badge": "Reset",
      "reset.pending.title": "Choose a new password",
      "reset.pending.body":
        "Finish here in the browser, or open the app and come back with your email and code already filled in.",
      "reset.success.badge": "Password updated",
      "reset.success.title": "Your password is ready",
      "reset.success.body":
        "Your new password is saved. Open the app to sign in again.",
      "reset.validation.badge": "Almost there",
      "reset.validation.title": "Choose a valid password",
      "reset.validation.body":
        "The code looks right, but your new password still needs to meet the minimum rules.",
      "reset.error.badge": "Invalid link",
      "reset.invalid.title": "This code could not be used",
      "reset.invalid.body":
        "The code looks incorrect. Open the app to request a fresh password reset email.",
      "reset.missing.title": "No reset is waiting",
      "reset.missing.body":
        "This link does not match any active reset request. Open the app to request a fresh password reset email.",
      "reset.expired.title": "This link is no longer active",
      "reset.expired.body":
        "This code may have already been used or it expired. Open the app to request a fresh code.",
      "reset.action.resetInBrowser": "Update password",
      "reset.action.openInApp": "Open the app",
      "reset.action.openAppToSignIn": "Open the app to sign in",
      "reset.label.email": "Email",
      "reset.label.code": "Code",
      "reset.label.password": "New password",
      "reset.placeholder.password": "At least 8 characters",
      "reset.help":
        "The same code also works inside the app's forgot password flow.",
      "reset.tile.app.label": "App",
      "reset.tile.app.value": "Direct handoff by deeplink",
      "reset.tile.browser.label": "Browser",
      "reset.tile.browser.value":
        "Set a new password without retyping the code",
      "reset.tile.tip.label": "Tip",
      "reset.tile.tip.value":
        "If you prefer, open the app and finish the reset there.",

      "status.eyebrow": "Game status",
      "status.banner.checking.title": "Checking Adventure Time TCG",
      "status.banner.checking.body":
        "We are checking sign-in, collections, quests, and battles now.",
      "status.banner.operational.title":
        "Adventure Time TCG is ready to play",
      "status.banner.operational.body":
        "Sign-in, collections, quests, and battles are responding normally.",
      "status.banner.degraded.title": "Some game features may be limited",
      "status.banner.degraded.body":
        "You may be able to open the app, but saved progress or battles may not load correctly.",
      "status.banner.down.title": "Adventure Time TCG is having trouble",
      "status.banner.down.body":
        "The app may not load right now. Please try again in a few minutes.",
      "status.updates": "Updates automatically",
      "status.checked": "Checked",
      "status.areasAria": "Game areas",
      "status.coverage.kicker": "Can I play?",
      "status.coverage.title": "What this status covers",
      "status.coverage.body":
        "A quick check of the parts players rely on most.",
      "status.edge.title": "Open the app",
      "status.edge.body": "The app can reach Adventure Time TCG.",
      "status.api.title": "Sign in and play",
      "status.api.body":
        "Accounts, packs, quests, gifts, and battles can respond.",
      "status.database.title": "Saved progress",
      "status.database.checking":
        "Checking collections, quests, gifts, and battle history.",
      "status.database.available":
        "Collections, quests, gifts, and battle history are available.",
      "status.database.unavailable":
        "Some saved progress may be temporarily unavailable.",
      "status.state.operational": "Operational",
      "status.state.degraded": "Degraded",
      "status.state.down": "Down",
      "status.state.checking": "Checking",
      "status.helpAria": "Player help",
      "status.help.kicker": "Still stuck?",
      "status.help.title": "If the game still feels off",
      "status.help.body":
        "Try closing and reopening the app, checking your connection, or coming back in a few minutes. If the problem keeps happening, contact support and include what you were trying to do.",
      "status.help.support": "Contact support",
      "status.help.back": "Back to app overview",

      "notFound.heroAria": "Missing page",
      "notFound.kicker": "404: Lost in the Candy Kingdom",
      "notFound.title": "This page is missing from the collection.",
      "notFound.lede":
        "We searched the Tree Fort, the Nightosphere, and one very suspicious pack wrapper. This page still did not show up.",
      "notFound.exitsAria": "Helpful exits",
      "notFound.clue.route": "No secret endpoint map here. Nice try, wizard.",
      "notFound.clue.home":
        "The homepage is safe, sparkly, and only one click away.",
      "notFound.clue.support":
        "If a link sent you here, support can help untangle it.",
      "notFound.cta.home": "Return to homepage",
      "notFound.cta.support": "Contact support",
      "notFound.reportAria": "Lost card report",
      "notFound.cardStatus": "Page MIA",
      "notFound.tile.rarity.label": "Rarity",
      "notFound.tile.rarity.value": "Mythically misplaced",
      "notFound.tile.ability.label": "Ability",
      "notFound.tile.ability.value": "Dodges every route",
      "notFound.tile.counter.label": "Counterplay",
      "notFound.tile.counter.value": "Go home, regroup",
    },
    fr: {
      "common.skip": "Aller au contenu",
      "common.brandAria": "Accueil Adventure Time TCG",
      "common.tagline": "Collectionne. Accomplis des quêtes. Affronte tes amis.",
      "common.primaryNav": "Navigation principale",
      "common.footerNav": "Pied de page",
      "common.languageSwitch": "Choisir une langue",
      "common.themeSwitch": "Choisir un thème",
      "nav.home": "Accueil",
      "nav.status": "Statut",
      "nav.privacy": "Confidentialité",
      "nav.accountDeletion": "Suppression du compte",
      "nav.security": "Sécurité",
      "nav.support": "Assistance",
      "language.en": "EN",
      "language.fr": "FR",
      "language.enFull": "Anglais",
      "language.frFull": "Français",
      "theme.candy": "Thème Royaume de la Confiserie",
      "theme.ice": "Thème Royaume de la Glace",
      "theme.nightosphere": "Thème Nuitosphère",

      "page.home.title": "Adventure Time TCG",
      "page.home.description":
        "Adventure Time TCG est un jeu de cartes mobile où tu collectionnes des cartes, accomplis des quêtes et lances des duels PvP en temps réel.",
      "page.status.title": "Statut du jeu - Adventure Time TCG",
      "page.status.description":
        "Vérifie si Adventure Time TCG est disponible pour la connexion, les quêtes, les packs et les combats.",
      "page.privacy.title": "Politique de confidentialité - Adventure Time TCG",
      "page.privacy.description":
        "Comment Adventure Time TCG gère les données de compte, de jeu et de synchronisation de pas facultative.",
      "page.accountDeletion.title":
        "Suppression du compte - Adventure Time TCG",
      "page.accountDeletion.description":
        "Supprime ton compte Adventure Time TCG depuis les réglages de l'application quand tu en as besoin.",
      "page.notFound.title": "Page introuvable - Adventure Time TCG",
      "page.notFound.description":
        "Cette page d'Adventure Time TCG est introuvable. Retourne à l'accueil ou contacte l'assistance.",

      "home.heroAria": "Présentation de l'application",
      "home.eyebrow": "Jeu de cartes mobile",
      "home.title":
        'Collectionne, accomplis des quêtes et combats dans <span class="grad">Adventure Time TCG</span>.',
      "home.lede":
        "Construis ta collection de cartes Adventure Time, ouvre des packs, relève des défis quotidiens et teste ton équipe dans des duels amicaux.",
      "home.pillListAria": "Ce que tu peux faire",
      "home.pill.collect":
        "Ouvre des packs et agrandis ta collection de personnages",
      "home.pill.earn":
        "Gagne des pièces, de la poussière et des récompenses en jouant chaque jour",
      "home.pill.battle":
        "Défie tes amis et suis les matchs tour après tour",
      "home.cta.play": "Voir comment ça se joue",
      "home.cta.privacy": "Confidentialité et compte",
      "home.snapshotAria": "Aperçu de l'application",
      "home.iconAlt":
        "Icône Adventure Time TCG avec une carte à collectionner de Finn",
      "home.tile.collect.label": "Collection",
      "home.tile.collect.value": "Cartes et packs",
      "home.tile.progress.label": "Progression",
      "home.tile.progress.value": "Quêtes et récompenses",
      "home.tile.play.label": "Jeu",
      "home.tile.play.value": "Combats amicaux",
      "home.statsAria": "En bref",
      "home.stat.play": "Façons de jouer chaque jour",
      "home.stat.languages": "Langues : anglais et français",
      "home.stat.pvp": "Défie d'autres joueurs",
      "home.stat.daily": "Quêtes et récompenses quotidiennes",
      "home.howAria": "Fonctionnement du jeu",
      "home.how.kicker": "Comment ça se joue",
      "home.how.title": "Une collection de cartes qui évolue chaque jour",
      "home.how.body":
        "Ouvre des packs, progresse et envoie tes cartes préférées au combat.",
      "home.loopAria": "Boucle de jeu",
      "home.screenshotsAria": "Captures de l'application",
      "home.screenshot.questsAlt":
        "Capture des quêtes quotidiennes Adventure Time TCG",
      "home.screenshot.numbersAlt":
        "Capture du défi de calcul Adventure Time TCG",
      "home.screenshot.wordleAlt":
        "Capture du Wordle quotidien Adventure Time TCG",
      "home.screenshot.collectionAlt":
        "Capture de la collection Adventure Time TCG",
      "home.feature.collect.kicker": "Collection",
      "home.feature.collect.title": "Ouvre des packs et trouve de nouvelles cartes",
      "home.feature.collect.body":
        "Déballe tes packs de récompense, découvre des personnages et agrandis ton équipe Adventure Time.",
      "home.feature.quest.kicker": "Quêtes",
      "home.feature.quest.title":
        "Termine de petits défis quotidiens",
      "home.feature.quest.body":
        "Connecte-toi, résous des quêtes ludiques, synchronise tes pas si tu le souhaites et gagne pièces, poussière et packs.",
      "home.feature.packs.kicker": "Amélioration",
      "home.feature.packs.title":
        "Fabrique les cartes dont ton équipe a besoin",
      "home.feature.packs.body":
        "Recycle les doubles en poussière, traque les raretés et transforme les récompenses en vraie progression.",
      "home.feature.battle.kicker": "Combat",
      "home.feature.battle.title": "Envoie ton équipe dans des duels amicaux",
      "home.feature.battle.body":
        "Choisis ton équipe, prends des décisions tactiques et suis chaque tour dans le journal de combat.",
      "home.friendlyAria": "Fonctionnalités pensées pour les joueurs",
      "home.friendly.kicker": "Détendu et joueur",
      "home.friendly.title": "Pensé pour des sessions légères, sans pression",
      "home.card.status.kicker": "Vérification simple",
      "home.card.status.title": "Sais quand le jeu est disponible",
      "home.card.status.body":
        "La page de statut donne aux joueurs un endroit simple pour vérifier si la connexion, les collections et les combats fonctionnent normalement.",
      "home.card.status.link": "Vérifier le statut du jeu",
      "home.card.account.kicker": "Soin du compte",
      "home.card.account.title": "Ta progression reste liée à ton compte",
      "home.card.account.body":
        "Connecte-toi pour garder ta collection, tes quêtes, tes cadeaux, tes préférences et ton historique de combat avec toi.",
      "home.card.account.link": "Voir les détails de confidentialité",
      "home.card.deletion.kicker": "Suppression du compte",
      "home.card.deletion.title": "Tu peux supprimer ton compte",
      "home.card.deletion.body":
        "La page de suppression explique ce qui est effacé, ce qui peut être conservé pour la sécurité et comment faire la demande.",
      "home.card.deletion.link": "Détails de suppression du compte",

      "policy.privacy.title": "Politique de confidentialité",
      "policy.privacy.lede":
        "Comment Adventure Time TCG gère les données de compte, de jeu et de synchronisation de pas facultative.",
      "policy.privacy.detailsAria":
        "Détails de la politique de confidentialité",
      "policy.privacy.kicker": "Confidentialité",
      "policy.privacy.heading": "Ce que nous stockons, et pourquoi",
      "policy.account_deletion.title": "Suppression du compte",
      "policy.account_deletion.lede":
        "Supprime ton compte Adventure Time TCG depuis les réglages de l'application quand tu en as besoin.",
      "policy.account_deletion.detailsAria":
        "Détails de suppression du compte",
      "policy.account_deletion.kicker": "Suppression du compte",
      "policy.account_deletion.heading": "Comment supprimer ton compte",
      "policy.highlightsAria": "Points clés de la politique",
      "policy.highlight.controls":
        "Les contrôles en langage clair se trouvent dans les réglages mobiles",
      "policy.highlight.progress":
        "La progression de jeu reste liée à ton compte connecté",
      "policy.highlight.health":
        "Les données de santé facultatives servent uniquement aux quêtes de pas",
      "policy.cta.details": "Lire les détails",
      "policy.cta.overview": "Présentation de l'app",
      "policy.controlsAria": "Contrôles des données",
      "policy.tile.account.label": "Contrôle du compte",
      "policy.tile.account.value": "Écran des réglages",
      "policy.tile.privacy.label": "Confidentialité",
      "policy.tile.deletion.label": "Aide suppression",
      "policy.tile.support.label": "Assistance",
      "policy.tile.open": "Ouvrir la page",
      "privacy.account.kicker": "Compte",
      "privacy.account.title": "Données de compte et d'authentification",
      "privacy.account.body":
        "Nous stockons ton adresse e-mail, ton nom d'affichage, l'état d'authentification par mot de passe, ta langue préférée, ton fuseau horaire, ton image de profil et tes jetons de session afin que tu puisses te connecter et protéger ton compte.",
      "privacy.gameplay.kicker": "Jeu",
      "privacy.gameplay.title": "Données de progression",
      "privacy.gameplay.body":
        "Nous stockons les pièces, la poussière, les cartes, les packs, les cadeaux, les quêtes, les équipes PvP, les matchs, les événements de combat et les horodatages associés afin de conserver ta progression.",
      "privacy.activity.kicker": "Activité",
      "privacy.activity.title": "Données de pas facultatives",
      "privacy.activity.body":
        "Si tu actives les quêtes de pas, l'application lit les pas depuis Apple Santé, Health Connect, le podomètre de l'appareil ou Fitbit. Nous stockons les totaux quotidiens, la source, la date et les horodatages de synchronisation pour la progression des quêtes. Nous ne vendons pas ces données.",
      "privacy.notifications.kicker": "Notifications",
      "privacy.notifications.title": "Données de notification",
      "privacy.notifications.body":
        "Si tu actives les notifications, nous stockons les identifiants d'installation et les jetons push afin d'envoyer les alertes de quêtes, cadeaux et PvP que tu as demandées. Tu peux désactiver ces préférences dans l'app ou retirer l'autorisation du système à tout moment.",
      "privacy.sharing.kicker": "Partage",
      "privacy.sharing.title": "Partage et services tiers",
      "privacy.sharing.body":
        "Les données sont envoyées de façon sécurisée quand tu utilises l'app. Les services tiers servent uniquement, selon les besoins, à la connexion de plateforme, aux notifications push, à la distribution sur les stores et à la connexion Fitbit facultative.",
      "privacy.security.kicker": "Sécurité",
      "privacy.security.title": "Prévention de la fraude lors des demandes d'accès",
      "privacy.security.body":
        "Lors d'une demande d'accès, nous pouvons évaluer le réseau IP, les métadonnées de la requête et de l'app ainsi que l'intégrité de l'appareil Android afin d'aider un super admin à examiner le risque d'abus. IPQualityScore traite l'IP et des métadonnées techniques limitées à cette fin. Le résultat reste consultatif : une personne approuve ou refuse chaque demande. L'IP exacte est supprimée 30 jours après la décision, les preuves détaillées après 90 jours et le dossier de décision après un an.",
      "privacy.control.kicker": "Contrôle",
      "privacy.control.title": "Accès et suppression",
      "privacy.control.body":
        "Tu peux supprimer ton compte dans les réglages de l'app mobile. La suppression efface ton compte, tes identifiants, ta collection, tes cadeaux, ta progression de quêtes, tes données PvP, tes instantanés de pas, tes appareils de notification et ton image de profil d'Adventure Time TCG.",
      "privacy.control.link": "Ouvrir les instructions de suppression",
      "deletion.inApp.kicker": "Dans l'app",
      "deletion.inApp.title": "Supprimer depuis les réglages",
      "deletion.inApp.body":
        "Connecte-toi, ouvre Réglages, fais défiler jusqu'à Confidentialité et données, puis choisis Supprimer mon compte. Confirme l'invite pour supprimer définitivement ton compte et tes données de jeu.",
      "deletion.removed.kicker": "Données supprimées",
      "deletion.removed.title": "Ce qui est supprimé",
      "deletion.removed.body":
        "La suppression du compte efface les identifiants de connexion, les sessions, la collection, les cadeaux, la progression de quêtes, les données PvP, les instantanés de pas, les appareils de notification, les demandes d'accès, les codes de vérification et ton image de profil.",
      "deletion.help.kicker": "Aide",
      "deletion.help.title": "Besoin d'aide ?",
      "deletion.help.body":
        "Si tu ne peux pas accéder à l'app, contacte l'assistance depuis l'adresse e-mail du compte et demande la suppression. Nous pouvons te demander de confirmer que le compte t'appartient avant d'agir.",

      "auth.iconAlt": "Icône de l'app Adventure Time TCG",
      "email.pending.badge": "Confirmation",
      "email.pending.title": "Confirme ton e-mail",
      "email.pending.body":
        "Valide ton compte ici dans le navigateur, ou ouvre l'application pour finir l'inscription sans recopier le code.",
      "email.waiting.badge": "En attente",
      "email.waiting.title": "Ton e-mail est confirmé",
      "email.waiting.body":
        "Ton compte est créé, mais un super admin doit encore approuver l'accès avant ta première connexion.",
      "email.ready.badge": "Compte prêt",
      "email.ready.title": "Ton compte est prêt",
      "email.ready.body":
        "Ton e-mail est confirmé et ton accès est déjà approuvé. Ouvre l'application pour te connecter.",
      "email.error.badge": "Lien invalide",
      "email.invalid.title": "Ce code n'a pas pu être confirmé",
      "email.invalid.body":
        "Le code semble incorrect. Ouvre l'application pour corriger l'e-mail, vérifier le code ou en demander un nouveau.",
      "email.missing.title": "Aucune vérification en attente",
      "email.missing.body":
        "Ce lien ne correspond à aucune vérification active. Ouvre l'application pour demander un nouveau code ou reprendre l'inscription.",
      "email.expired.title": "Ce lien n'est plus actif",
      "email.expired.body":
        "Ce code a peut-être déjà été utilisé ou il a expiré. Ouvre l'application pour demander un nouveau code.",
      "email.action.confirmInBrowser": "Confirmer dans le navigateur",
      "email.action.openInApp": "Ouvrir l'application",
      "email.action.openApp": "Ouvrir l'application",
      "email.action.openAppToSignIn":
        "Ouvrir l'application pour se connecter",
      "email.action.backToApp": "Revenir dans l'application",
      "email.label.email": "E-mail",
      "email.label.code": "Code",
      "email.help":
        "Le même code fonctionne aussi dans l'écran d'inscription de l'application.",
      "email.tile.app.label": "Application",
      "email.tile.app.value": "Ouverture directe via deeplink",
      "email.tile.browser.label": "Navigateur",
      "email.tile.browser.value": "Confirmation sans recopier le code",
      "email.tile.tip.label": "Astuce",
      "email.tile.tip.value":
        "Si rien ne se passe, retourne à l'app et colle le code manuellement.",
      "reset.pending.badge": "Réinitialisation",
      "reset.pending.title": "Choisis un nouveau mot de passe",
      "reset.pending.body":
        "Termine ici dans le navigateur, ou ouvre l'application pour revenir avec l'e-mail et le code déjà remplis.",
      "reset.success.badge": "Mot de passe mis à jour",
      "reset.success.title": "Ton mot de passe est prêt",
      "reset.success.body":
        "Ton nouveau mot de passe est enregistré. Ouvre l'application pour te reconnecter.",
      "reset.validation.badge": "Presque fini",
      "reset.validation.title": "Choisis un mot de passe valide",
      "reset.validation.body":
        "Le code semble bon, mais ton nouveau mot de passe doit encore respecter les règles minimales.",
      "reset.error.badge": "Lien invalide",
      "reset.invalid.title": "Ce code n'a pas pu être utilisé",
      "reset.invalid.body":
        "Le code semble incorrect. Ouvre l'application pour demander un nouvel e-mail de réinitialisation.",
      "reset.missing.title": "Aucune réinitialisation en attente",
      "reset.missing.body":
        "Ce lien ne correspond à aucune demande active. Ouvre l'application pour demander un nouvel e-mail de réinitialisation.",
      "reset.expired.title": "Ce lien n'est plus actif",
      "reset.expired.body":
        "Ce code a peut-être déjà été utilisé ou il a expiré. Ouvre l'application pour demander un nouveau code.",
      "reset.action.resetInBrowser": "Mettre à jour le mot de passe",
      "reset.action.openInApp": "Ouvrir l'application",
      "reset.action.openAppToSignIn":
        "Ouvrir l'application pour se connecter",
      "reset.label.email": "E-mail",
      "reset.label.code": "Code",
      "reset.label.password": "Nouveau mot de passe",
      "reset.placeholder.password": "Au moins 8 caractères",
      "reset.help":
        "Le même code fonctionne aussi dans l'écran de mot de passe oublié de l'application.",
      "reset.tile.app.label": "Application",
      "reset.tile.app.value": "Retour direct avec deeplink",
      "reset.tile.browser.label": "Navigateur",
      "reset.tile.browser.value":
        "Nouveau mot de passe sans recopier le code",
      "reset.tile.tip.label": "Astuce",
      "reset.tile.tip.value":
        "Si tu préfères, ouvre l'app pour finaliser la réinitialisation là-bas.",

      "status.eyebrow": "Statut du jeu",
      "status.banner.checking.title": "Vérification d'Adventure Time TCG",
      "status.banner.checking.body":
        "Nous vérifions la connexion, les collections, les quêtes et les combats.",
      "status.banner.operational.title":
        "Adventure Time TCG est prêt à jouer",
      "status.banner.operational.body":
        "La connexion, les collections, les quêtes et les combats répondent normalement.",
      "status.banner.degraded.title":
        "Certaines fonctions du jeu peuvent être limitées",
      "status.banner.degraded.body":
        "Tu peux peut-être ouvrir l'app, mais la progression sauvegardée ou les combats risquent de ne pas charger correctement.",
      "status.banner.down.title": "Adventure Time TCG rencontre un problème",
      "status.banner.down.body":
        "L'app peut ne pas charger pour le moment. Réessaie dans quelques minutes.",
      "status.updates": "Mise à jour automatique",
      "status.checked": "Vérifié",
      "status.areasAria": "Zones du jeu",
      "status.coverage.kicker": "Puis-je jouer ?",
      "status.coverage.title": "Ce que ce statut couvre",
      "status.coverage.body":
        "Une vérification rapide des parties dont les joueurs dépendent le plus.",
      "status.edge.title": "Ouvrir l'app",
      "status.edge.body": "L'app peut joindre Adventure Time TCG.",
      "status.api.title": "Se connecter et jouer",
      "status.api.body":
        "Les comptes, packs, quêtes, cadeaux et combats peuvent répondre.",
      "status.database.title": "Progression sauvegardée",
      "status.database.checking":
        "Vérification des collections, quêtes, cadeaux et historiques de combat.",
      "status.database.available":
        "Les collections, quêtes, cadeaux et historiques de combat sont disponibles.",
      "status.database.unavailable":
        "Une partie de la progression sauvegardée peut être temporairement indisponible.",
      "status.state.operational": "Opérationnel",
      "status.state.degraded": "Dégradé",
      "status.state.down": "Indisponible",
      "status.state.checking": "Vérification",
      "status.helpAria": "Aide joueur",
      "status.help.kicker": "Encore bloqué ?",
      "status.help.title": "Si le jeu semble encore instable",
      "status.help.body":
        "Essaie de fermer puis rouvrir l'app, de vérifier ta connexion ou de revenir dans quelques minutes. Si le problème continue, contacte l'assistance en indiquant ce que tu essayais de faire.",
      "status.help.support": "Contacter l'assistance",
      "status.help.back": "Retour à la présentation",

      "notFound.heroAria": "Page introuvable",
      "notFound.kicker": "404 : perdue au Royaume de la Confiserie",
      "notFound.title": "Impossible de trouver cette page.",
      "notFound.lede":
        "On a vérifié la Cabane, le Royaume de la Confiserie et même la Nuitosphère : cette adresse ne mène nulle part.",
      "notFound.exitsAria": "Sorties utiles",
      "notFound.clue.route":
        "Pas de carte aux trésors des endpoints ici. Bien essayé, sorcier.",
      "notFound.clue.home":
        "L'accueil brille encore au loin, avec moins de malédictions.",
      "notFound.clue.support":
        "Si un lien t'a envoyé dans ce trou magique, l'assistance a une corde.",
      "notFound.cta.home": "Retour à l'accueil",
      "notFound.cta.support": "Contacter l'assistance",
      "notFound.reportAria": "Carte de page introuvable",
      "notFound.cardStatus": "Page perdue",
      "notFound.tile.rarity.label": "Rareté",
      "notFound.tile.rarity.value": "Légendaire, mais absente",
      "notFound.tile.ability.label": "Capacité",
      "notFound.tile.ability.value": "Se cache très bien",
      "notFound.tile.counter.label": "Solution",
      "notFound.tile.counter.value": "Revenir à l'accueil",
    },
  };
  var statusInterval = null;
  var currentNavigation = null;
  var currentLanguage = null;

  function activeIndex(items, value) {
    var index = items.indexOf(value);
    return index === -1 ? 0 : index;
  }

  function setSegmentedActive(root, index, propertyName) {
    if (!root) {
      return;
    }
    root.setAttribute("data-active-index", String(index));
    root.style.setProperty(propertyName || "--segment-active-index", String(index));
  }

  // ---- Theme -------------------------------------------------------------
  function storedTheme() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return THEMES.indexOf(value) !== -1 ? value : null;
    } catch (err) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      /* ignore */
    }
  }

  function applyTheme(theme) {
    if (THEMES.indexOf(theme) === -1) {
      theme = "candy";
    }
    document.documentElement.setAttribute("data-theme", theme);
    setSegmentedActive(
      document.querySelector(".theme-switch"),
      activeIndex(THEMES, theme)
    );

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && THEME_META[theme]) {
      meta.setAttribute("content", THEME_META[theme]);
    }

    var buttons = document.querySelectorAll("[data-theme-name]");
    for (var i = 0; i < buttons.length; i++) {
      var isActive = buttons[i].getAttribute("data-theme-name") === theme;
      buttons[i].setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  }

  function initialTheme() {
    var stored = storedTheme();
    if (stored) {
      return stored;
    }
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "nightosphere";
    }
    return "candy";
  }

  function initThemeSwitch() {
    applyTheme(initialTheme());

    var buttons = document.querySelectorAll("[data-theme-name]");
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute("data-theme-ready") === "true") {
        continue;
      }
      buttons[i].setAttribute("data-theme-ready", "true");
      buttons[i].addEventListener("click", function (event) {
        var theme = event.currentTarget.getAttribute("data-theme-name");
        applyTheme(theme);
        storeTheme(theme);
      });
    }
  }

  // ---- Language ----------------------------------------------------------
  function normalizedLanguage(value) {
    if (!value) {
      return null;
    }
    var normalized = String(value).toLowerCase();
    if (normalized.indexOf("fr") === 0) {
      return "fr";
    }
    if (normalized.indexOf("en") === 0) {
      return "en";
    }
    return null;
  }

  function storedLanguage() {
    try {
      var value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return LANGUAGES.indexOf(value) !== -1 ? value : null;
    } catch (err) {
      return null;
    }
  }

  function storeLanguage(language) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch (err) {
      /* ignore */
    }
  }

  function deviceLanguage() {
    var languages = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage];

    for (var i = 0; i < languages.length; i++) {
      var language = normalizedLanguage(languages[i]);
      if (language) {
        return language;
      }
    }

    return "en";
  }

  function initialLanguage() {
    return (
      storedLanguage() ||
      normalizedLanguage(document.documentElement.getAttribute("lang")) ||
      deviceLanguage()
    );
  }

  function t(key) {
    return (
      (I18N[currentLanguage] && I18N[currentLanguage][key]) ||
      (I18N.en && I18N.en[key]) ||
      key
    );
  }

  function setTranslatedText(element, key) {
    if (!element) {
      return;
    }
    element.setAttribute("data-i18n", key);
    element.textContent = t(key);
  }

  function applyAttributeTranslations(root) {
    var elements = root.querySelectorAll("[data-i18n-attr]");
    for (var i = 0; i < elements.length; i++) {
      var specs = elements[i].getAttribute("data-i18n-attr").split(",");
      for (var j = 0; j < specs.length; j++) {
        var parts = specs[j].split(":");
        if (parts.length !== 2) {
          continue;
        }
        elements[i].setAttribute(parts[0].trim(), t(parts[1].trim()));
      }
    }
  }

  function applyPageMetadata() {
    var pageTitleRoot = document.querySelector("[data-page-title-key]");
    if (pageTitleRoot) {
      var titleKey = pageTitleRoot.getAttribute("data-page-title-key");
      var descriptionKey = pageTitleRoot.getAttribute("data-page-description-key");
      document.title = t(titleKey) + " | Adventure Time TCG";

      var pageMeta = document.querySelector('meta[name="description"]');
      if (pageMeta && descriptionKey) {
        pageMeta.setAttribute("content", t(descriptionKey));
      }
      return;
    }

    var pageKey =
      PAGE_KEYS[window.location.pathname] ||
      document.documentElement.getAttribute("data-page-key");
    if (!pageKey) {
      return;
    }

    var title = t("page." + pageKey + ".title");
    var description = t("page." + pageKey + ".description");
    document.title = title;

    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", description);
    }
  }

  function updateLanguageFields(language) {
    var fields = document.querySelectorAll('[name="locale"], [data-language-field]');
    for (var i = 0; i < fields.length; i++) {
      fields[i].value = language;
    }
  }

  function updateLocalizedAppLinks(language) {
    var links = document.querySelectorAll("[data-localized-app-link]");
    for (var i = 0; i < links.length; i++) {
      try {
        var url = new URL(links[i].getAttribute("href"));
        url.searchParams.set("locale", language);
        links[i].setAttribute("href", url.toString());
      } catch (err) {
        /* ignore malformed deep links */
      }
    }
  }

  function applyLanguage(language, shouldStore) {
    if (LANGUAGES.indexOf(language) === -1) {
      language = "en";
    }
    currentLanguage = language;
    document.documentElement.setAttribute("lang", language);
    document.documentElement.setAttribute("data-language", language);

    var textElements = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < textElements.length; i++) {
      textElements[i].textContent = t(textElements[i].getAttribute("data-i18n"));
    }

    var htmlElements = document.querySelectorAll("[data-i18n-html]");
    for (var j = 0; j < htmlElements.length; j++) {
      htmlElements[j].innerHTML = t(htmlElements[j].getAttribute("data-i18n-html"));
    }

    applyAttributeTranslations(document);
    applyPageMetadata();
    updateLanguageFields(language);
    updateLocalizedAppLinks(language);

    var buttons = document.querySelectorAll("[data-language-name]");
    for (var k = 0; k < buttons.length; k++) {
      var isActive = buttons[k].getAttribute("data-language-name") === language;
      buttons[k].setAttribute("aria-pressed", isActive ? "true" : "false");
    }
    setSegmentedActive(
      document.querySelector(".language-switch"),
      activeIndex(LANGUAGES, language)
    );

    if (shouldStore) {
      storeLanguage(language);
    }
  }

  function initLanguageSwitch() {
    applyLanguage(currentLanguage || initialLanguage(), false);

    var buttons = document.querySelectorAll("[data-language-name]");
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute("data-language-ready") === "true") {
        continue;
      }
      buttons[i].setAttribute("data-language-ready", "true");
      buttons[i].addEventListener("click", function (event) {
        var language = event.currentTarget.getAttribute("data-language-name");
        applyLanguage(language, true);
      });
    }
  }

  // ---- Soft navigation ---------------------------------------------------
  function isPlainLeftClick(event) {
    return (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    );
  }

  function shouldHandleLink(link, event) {
    if (!link || !isPlainLeftClick(event)) {
      return false;
    }
    if (
      link.target ||
      link.hasAttribute("download") ||
      link.getAttribute("href") == null
    ) {
      return false;
    }

    var href = link.getAttribute("href");
    if (
      href.charAt(0) === "#" ||
      href.indexOf("mailto:") === 0 ||
      href.indexOf("tel:") === 0
    ) {
      return false;
    }

    var url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return false;
    }
    if (
      url.hash &&
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    ) {
      return false;
    }

    return ["/", "/status", "/privacy", "/account-deletion"].indexOf(url.pathname) !== -1;
  }

  function scrollToHash(hash, behavior) {
    if (!hash || hash === "#") {
      window.scrollTo({ top: 0, behavior: behavior || "smooth" });
      return;
    }

    var id = hash.slice(1);
    try {
      id = window.decodeURIComponent(id);
    } catch (err) {
      /* Keep the raw hash text if decoding fails. */
    }
    var target = document.getElementById(id);
    if (!target) {
      return;
    }

    var hadTabIndex = target.hasAttribute("tabindex");
    target.setAttribute("tabindex", "-1");
    target.scrollIntoView({ behavior: behavior || "smooth", block: "start" });
    target.focus({ preventScroll: true });

    if (!hadTabIndex) {
      target.addEventListener(
        "blur",
        function () {
          target.removeAttribute("tabindex");
        },
        { once: true }
      );
    }
  }

  function initHashLinks() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("[data-scroll-target]");
      if (!link || !isPlainLeftClick(event)) {
        return;
      }

      var targetId = link.getAttribute("data-scroll-target");
      if (!targetId) {
        return;
      }

      var hash = "#" + encodeURIComponent(targetId);
      event.preventDefault();
      if (window.location.hash !== hash) {
        history.pushState({}, "", hash);
      }
      scrollToHash(hash, "smooth");
    });

    if (window.location.hash) {
      window.requestAnimationFrame(function () {
        scrollToHash(window.location.hash, "instant");
      });
    }
  }

  function updateActiveNav(pathname) {
    var links = document.querySelectorAll(".nav a");
    var activeIndex = -1;

    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var linkPath = new URL(link.href, window.location.href).pathname;
      if (linkPath === pathname) {
        link.setAttribute("aria-current", "page");
        activeIndex = i;
      } else {
        link.removeAttribute("aria-current");
      }
    }

    var nav = document.querySelector(".nav");
    if (!nav) {
      return;
    }

    if (activeIndex === -1) {
      nav.removeAttribute("data-active-index");
      nav.style.removeProperty("--nav-active-index");
      return;
    }

    nav.setAttribute("data-active-index", String(activeIndex));
    nav.style.setProperty("--nav-active-index", String(activeIndex));
  }

  function replacePageFromDocument(nextDocument, url, shouldPush) {
    var currentMain = document.querySelector("#main-content");
    var nextMain = nextDocument.querySelector("#main-content");
    if (!currentMain || !nextMain) {
      window.location.href = url.href;
      return;
    }

    stopStatusPage();
    document.title = nextDocument.title;
    currentMain.className = nextMain.className;
    currentMain.innerHTML = nextMain.innerHTML;
    updateActiveNav(url.pathname);

    if (shouldPush) {
      history.pushState({}, "", url.href);
    }

    applyLanguage(currentLanguage || initialLanguage(), false);

    initStatusPage();
    if (url.hash) {
      window.requestAnimationFrame(function () {
        scrollToHash(url.hash, "instant");
      });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  function setNavigating(isNavigating) {
    document.documentElement.classList.toggle("is-soft-navigating", isNavigating);
  }

  function navigateSoft(url, shouldPush) {
    if (currentNavigation) {
      currentNavigation.abort();
    }
    currentNavigation = new AbortController();
    setNavigating(true);

    return fetch(url.href, {
      headers: { accept: "text/html" },
      signal: currentNavigation.signal,
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Navigation failed");
        }
        return response.text();
      })
      .then(function (html) {
        var nextDocument = new DOMParser().parseFromString(html, "text/html");
        var swap = function () {
          replacePageFromDocument(nextDocument, url, shouldPush);
        };

        if (document.startViewTransition) {
          document.startViewTransition(swap);
        } else {
          swap();
        }
      })
      .catch(function (error) {
        if (error.name !== "AbortError") {
          window.location.href = url.href;
        }
      })
      .finally(function () {
        currentNavigation = null;
        setNavigating(false);
      });
  }

  function initSoftNavigation() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a");
      if (!shouldHandleLink(link, event)) {
        return;
      }

      var url = new URL(link.href, window.location.href);
      if (url.href === window.location.href) {
        return;
      }

      event.preventDefault();
      navigateSoft(url, true);
    });

    window.addEventListener("popstate", function () {
      var url = new URL(window.location.href);
      var hashTarget = null;
      if (url.hash) {
        try {
          hashTarget = document.getElementById(window.decodeURIComponent(url.hash.slice(1)));
        } catch (err) {
          hashTarget = document.getElementById(url.hash.slice(1));
        }
      }
      if (hashTarget) {
        scrollToHash(url.hash, "smooth");
        return;
      }
      navigateSoft(url, false);
    });
  }

  // ---- Status page -------------------------------------------------------
  function setBadge(root, selector, state, hintKey) {
    var component = root.querySelector(
      '[data-component="' + selector + '"]'
    );
    if (!component) {
      return;
    }
    var badge = component.querySelector("[data-badge]");
    var label = component.querySelector("[data-badge-label]");
    if (badge) {
      badge.setAttribute("data-state", state);
    }
    if (label) {
      setTranslatedText(label, "status.state." + state);
    }
    if (hintKey) {
      var hintEl = component.querySelector("[data-hint]");
      if (hintEl) {
        setTranslatedText(hintEl, hintKey);
      }
    }
  }

  function checkEndpoint(url) {
    var started = performance.now();
    return fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return {
              ok: response.ok,
              status: response.status,
              data: data,
              latency: Math.round(performance.now() - started),
            };
          });
      })
      .catch(function () {
        return { ok: false, status: 0, data: {}, latency: null };
      });
  }

  function currentLocale() {
    if (currentLanguage === "fr") {
      return "fr-FR";
    }
    if (currentLanguage === "en") {
      return "en-US";
    }
    if (navigator.languages && navigator.languages.length > 0) {
      return navigator.languages[0];
    }
    return navigator.language || "en-US";
  }

  function formatLocalTimestamp(date) {
    try {
      var formatter = new Intl.DateTimeFormat(currentLocale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      });
      var timeZone = formatter.resolvedOptions().timeZone || "local time";
      return formatter.format(date) + " (" + timeZone + ")";
    } catch (err) {
      return date.toLocaleString();
    }
  }

  function initStatusPage() {
    stopStatusPage();

    var root = document.querySelector("[data-status-page]");
    if (!root) {
      return;
    }

    var banner = root.querySelector("[data-status-banner]");
    var bannerTitle = root.querySelector("[data-banner-title]");
    var bannerText = root.querySelector("[data-banner-text]");
    var updatedAt = root.querySelector("[data-updated-at]");

    function refresh() {
      setBadge(root, "edge", "checking");
      setBadge(root, "api", "checking");
      setBadge(root, "database", "checking");

      Promise.all([checkEndpoint("/health"), checkEndpoint("/ready")]).then(
        function (results) {
          var health = results[0];
          var ready = results[1];

          var edgeUp = health.status > 0 || ready.status > 0;
          var apiUp = health.ok && health.data.status === "ok";
          var dbUp = ready.ok && ready.data.status === "ready";

          setBadge(root, "edge", edgeUp ? "operational" : "down");
          setBadge(root, "api", apiUp ? "operational" : "down");
          setBadge(
            root,
            "database",
            dbUp ? "operational" : "down",
            dbUp ? "status.database.available" : "status.database.unavailable"
          );

          var overall = "operational";
          if (!edgeUp || !apiUp) {
            overall = "down";
          } else if (!dbUp) {
            overall = "degraded";
          }

          if (banner) {
            banner.setAttribute("data-state", overall);
          }
          if (bannerTitle && bannerText) {
            if (overall === "operational") {
              setTranslatedText(
                bannerTitle,
                "status.banner.operational.title"
              );
              setTranslatedText(
                bannerText,
                "status.banner.operational.body"
              );
            } else if (overall === "degraded") {
              setTranslatedText(bannerTitle, "status.banner.degraded.title");
              setTranslatedText(bannerText, "status.banner.degraded.body");
            } else {
              setTranslatedText(bannerTitle, "status.banner.down.title");
              setTranslatedText(bannerText, "status.banner.down.body");
            }
          }
          if (updatedAt) {
            updatedAt.textContent = formatLocalTimestamp(new Date());
          }
        }
      );
    }

    refresh();
    statusInterval = setInterval(refresh, 15000);
  }

  function stopStatusPage() {
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
  }

  // ---- Boot --------------------------------------------------------------
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    currentLanguage = initialLanguage();
    initThemeSwitch();
    initLanguageSwitch();
    initSoftNavigation();
    initStatusPage();
    updateActiveNav(window.location.pathname);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        initStatusPage();
      }
    });
  });
})();
