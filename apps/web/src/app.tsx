import {
  lazy,
  Suspense,
  useEffect,
  type ComponentType,
} from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import {
  AppLayout,
  PublicLayout,
  SuperAdminRoute,
  ThemeMeta,
} from "@/components/layout";
import { LoadingState } from "@/components/ui";
import { titleForPath } from "@/route-manifest";

function lazyNamed<T extends object, K extends keyof T>(
  load: () => Promise<T>,
  name: K,
) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}

const LandingPage = lazyNamed(() => import("@/pages/public/landing-page"), "LandingPage");
const StatusPage = lazyNamed(() => import("@/pages/public/status-page"), "StatusPage");
const PrivacyPage = lazyNamed(() => import("@/pages/public/privacy-page"), "PrivacyPage");
const AccountDeletionPage = lazyNamed(() => import("@/pages/public/account-deletion-page"), "AccountDeletionPage");
const EmailVerifyPage = lazyNamed(() => import("@/pages/public/email-verify-page"), "EmailVerifyPage");
const PasswordResetPage = lazyNamed(() => import("@/pages/public/password-reset-page"), "PasswordResetPage");
const LoginPage = lazyNamed(() => import("@/pages/public/login-page"), "LoginPage");
const RegisterPage = lazyNamed(() => import("@/pages/public/register-page"), "RegisterPage");
const NotFoundPage = lazyNamed(() => import("@/pages/public/not-found-page"), "NotFoundPage");

const playerCore = () => import("@/pages/player/core-pages");
const HomePage = lazyNamed(playerCore, "HomePage");
const CollectionPage = lazyNamed(playerCore, "CollectionPage");
const CardDetailPage = lazyNamed(playerCore, "CardDetailPage");
const PacksPage = lazyNamed(playerCore, "PacksPage");
const GiftsPage = lazyNamed(playerCore, "GiftsPage");

const questPages = () => import("@/pages/player/quest-pages");
const QuestsPage = lazyNamed(questPages, "QuestsPage");
const DailyNumbersPage = lazyNamed(questPages, "DailyNumbersPage");
const DailyNumbersPlayPage = lazyNamed(questPages, "DailyNumbersPlayPage");
const DailyNumbersHistoryPage = lazyNamed(questPages, "DailyNumbersHistoryPage");
const SpeedCalculusPage = lazyNamed(questPages, "SpeedCalculusPage");
const SpeedTrainingPage = lazyNamed(questPages, "SpeedTrainingPage");
const WordlePage = lazyNamed(questPages, "WordlePage");

const pvpPages = () => import("@/pages/player/pvp-pages");
const PvpLobbyPage = lazyNamed(pvpPages, "PvpLobbyPage");
const PvpLoadoutsPage = lazyNamed(pvpPages, "PvpLoadoutsPage");
const PvpMatchPage = lazyNamed(pvpPages, "PvpMatchPage");
const PvpHistoryPage = lazyNamed(pvpPages, "PvpHistoryPage");
const PvpReplayPage = lazyNamed(pvpPages, "PvpReplayPage");
const PvpSpectatePage = lazyNamed(pvpPages, "PvpSpectatePage");
const PvpSpectateMatchPage = lazyNamed(pvpPages, "PvpSpectateMatchPage");
const PvpMechanicsPage = lazyNamed(pvpPages, "PvpMechanicsPage");
const PvpReferencePage = lazyNamed(pvpPages, "PvpReferencePage");
const SettingsPage = lazyNamed(() => import("@/pages/player/settings-page"), "SettingsPage");

const adminPages = () => import("@/pages/admin");
const AdminOverviewPage = lazyNamed(adminPages, "AdminOverviewPage");
const AdminCardsPage = lazyNamed(adminPages, "AdminCardsPage");
const AdminCardEditorPage = lazyNamed(adminPages, "AdminCardEditorPage");
const AdminPacksPage = lazyNamed(adminPages, "AdminPacksPage");
const AdminPackEditorPage = lazyNamed(adminPages, "AdminPackEditorPage");
const AdminCardBacksPage = lazyNamed(adminPages, "AdminCardBacksPage");
const AdminImageAssetsPage = lazyNamed(adminPages, "AdminImageAssetsPage");
const AdminFeaturedPage = lazyNamed(adminPages, "AdminFeaturedPage");
const AdminAbilitiesPage = lazyNamed(adminPages, "AdminAbilitiesPage");
const AdminAbilityEditorPage = lazyNamed(adminPages, "AdminAbilityEditorPage");
const AdminUsersPage = lazyNamed(adminPages, "AdminUsersPage");
const AdminUserDetailPage = lazyNamed(adminPages, "AdminUserDetailPage");
const AdminEmailRequestsPage = lazyNamed(adminPages, "AdminEmailRequestsPage");
const AdminBalancePage = lazyNamed(adminPages, "AdminBalancePage");

function DocumentMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${titleForPath(pathname)} — Adventure Time TCG`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return <ThemeMeta />;
}

export function App() {
  return (
    <>
      <DocumentMetadata />
      <Suspense fallback={<LoadingState label="Opening this chapter…" />}>
        <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="status" element={<StatusPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="account-deletion" element={<AccountDeletionPage />} />
          <Route path="email/verify" element={<EmailVerifyPage />} />
          <Route path="password/reset" element={<PasswordResetPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="404" element={<NotFoundPage />} />
        </Route>

        <Route element={<AppLayout />}>
          <Route path="home" element={<HomePage />} />
          <Route path="collection" element={<CollectionPage />} />
          <Route path="collection/:cardId" element={<CardDetailPage />} />
          <Route path="packs" element={<PacksPage />} />
          <Route path="gifts" element={<GiftsPage />} />
          <Route path="quests" element={<QuestsPage />} />
          <Route path="quests/daily-numbers" element={<DailyNumbersPage />} />
          <Route path="quests/daily-numbers/play" element={<DailyNumbersPlayPage />} />
          <Route path="quests/daily-numbers/history" element={<DailyNumbersHistoryPage />} />
          <Route path="quests/speed-calculus" element={<SpeedCalculusPage />} />
          <Route path="quests/speed-calculus/training" element={<SpeedTrainingPage />} />
          <Route path="quests/wordle" element={<WordlePage />} />
          <Route path="pvp" element={<PvpLobbyPage />} />
          <Route path="pvp/loadouts" element={<PvpLoadoutsPage />} />
          <Route path="pvp/match/:matchId" element={<PvpMatchPage />} />
          <Route path="pvp/history" element={<PvpHistoryPage />} />
          <Route path="pvp/history/:matchId" element={<PvpReplayPage />} />
          <Route path="pvp/spectate" element={<PvpSpectatePage />} />
          <Route path="pvp/spectate/:matchId" element={<PvpSpectateMatchPage />} />
          <Route path="pvp/mechanics" element={<PvpMechanicsPage />} />
          <Route path="pvp/reference" element={<PvpReferencePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route element={<AppLayout admin />}>
          <Route path="admin" element={<AdminOverviewPage />} />
          <Route path="admin/cards" element={<AdminCardsPage />} />
          <Route path="admin/cards/:id" element={<AdminCardEditorPage />} />
          <Route path="admin/packs" element={<AdminPacksPage />} />
          <Route path="admin/packs/:id" element={<AdminPackEditorPage />} />
          <Route path="admin/card-backs" element={<AdminCardBacksPage />} />
          <Route path="admin/image-assets" element={<AdminImageAssetsPage />} />
          <Route path="admin/featured" element={<AdminFeaturedPage />} />
          <Route path="admin/abilities" element={<AdminAbilitiesPage />} />
          <Route path="admin/abilities/:id" element={<AdminAbilityEditorPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/users/:id" element={<AdminUserDetailPage />} />
          <Route element={<SuperAdminRoute />}>
            <Route path="admin/email-requests" element={<AdminEmailRequestsPage />} />
          </Route>
          <Route path="admin/balance" element={<AdminBalancePage />} />
        </Route>

        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        </Routes>
      </Suspense>
    </>
  );
}
