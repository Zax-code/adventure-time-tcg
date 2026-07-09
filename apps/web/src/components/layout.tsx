import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";

import { THEME_COLORS } from "@adventure-time/theme";

import {
  BarChartIcon,
  BoxIcon,
  CardsIcon,
  GiftHeartIcon,
  HomeIcon,
  PackIcon,
  QuestIcon,
  SettingsIcon,
  SparklesIcon,
  SwordsIcon,
  UserPlusIcon,
} from "@/components/icons";
import { AuthenticatedProfileImage } from "@/components/game-art";
import { Brand } from "@/components/brand";
import { Button, ButtonLink } from "@/components/ui";
import { useAuth } from "@/auth/auth-provider";
import { getAccessToken } from "@/auth/session";
import { ThemeSwitcher, useTheme } from "@/theme/theme-provider";

const playerNav = [
  { href: "/home", icon: HomeIcon, label: "Home", tone: "primary" },
  { href: "/collection", icon: CardsIcon, label: "Collection", tone: "primary" },
  { href: "/packs", icon: PackIcon, label: "Packs", tone: "secondary" },
  { href: "/quests", icon: QuestIcon, label: "Quests", tone: "info" },
  { href: "/pvp", icon: SwordsIcon, label: "PvP", tone: "accent" },
  { href: "/gifts", icon: GiftHeartIcon, label: "Gifts", tone: "success" },
] as const;

const adminNav = [
  { href: "/admin", icon: HomeIcon, label: "Overview" },
  { href: "/admin/cards", icon: CardsIcon, label: "Cards" },
  { href: "/admin/packs", icon: PackIcon, label: "Packs" },
  { href: "/admin/card-backs", icon: BoxIcon, label: "Card backs" },
  { href: "/admin/image-assets", icon: SparklesIcon, label: "Assets" },
  { href: "/admin/featured", icon: SparklesIcon, label: "Featured" },
  { href: "/admin/abilities", icon: SwordsIcon, label: "Abilities" },
  { href: "/admin/users", icon: UserPlusIcon, label: "Users" },
  { href: "/admin/email-requests", icon: BarChartIcon, label: "Requests" },
] as const;

export function PublicLayout() {
  return (
    <div className="site-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="public-header">
        <NavLink to="/" aria-label="Adventure Time TCG home">
          <Brand />
        </NavLink>
        <nav aria-label="Public navigation">
          <NavLink to="/">Overview</NavLink>
          <NavLink to="/status">Status</NavLink>
          <NavLink to="/privacy">Privacy</NavLink>
        </nav>
        <div className="public-actions">
          <ThemeSwitcher compact />
          <ButtonLink to="/login" tone="secondary">
            Sign in
          </ButtonLink>
          <ButtonLink to="/register">Start collecting</ButtonLink>
        </div>
      </header>
      <main className="public-main" id="main-content">
        <Outlet />
      </main>
      <footer className="public-footer">
        <Brand compact />
        <nav aria-label="Footer navigation">
          <NavLink to="/status">Status</NavLink>
          <NavLink to="/privacy">Privacy</NavLink>
          <NavLink to="/account-deletion">Account deletion</NavLink>
          <a href="/.well-known/security.txt">Security</a>
          <a href="mailto:support@leaetzak.love">Support</a>
        </nav>
        <ThemeSwitcher compact />
      </footer>
    </div>
  );
}

export function AppLayout({ admin = false }: { admin?: boolean }) {
  const auth = useAuth();
  const { logout, user } = auth;
  const location = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const nav = admin ? adminNav : playerNav;

  const content = (
    <div className={`app-frame ${admin ? "admin-frame" : ""}`}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="story-header">
          <NavLink to={admin ? "/admin" : "/home"} aria-label={admin ? "Admin overview" : "Home"}>
            <Brand />
          </NavLink>
          <div className="story-tools">
            <div className="resource-pills" aria-label="Player resources">
              <span className="coin-pill"><b>{user?.coins.toLocaleString()}</b> coins</span>
              <span className="dust-pill"><b>{user?.dust.toLocaleString()}</b> dust</span>
            </div>
            <ThemeSwitcher compact />
            <button
              aria-expanded={accountOpen}
              className="profile-chip"
              onClick={() => setAccountOpen((value) => !value)}
              type="button"
            >
              <AuthenticatedProfileImage
                accessToken={getAccessToken() ?? ""}
                alt=""
                className="avatar-image"
                fallback={<span className="avatar">{(user?.displayName || user?.email || "A").slice(0, 1).toUpperCase()}</span>}
                imageAssetId={user?.avatarAssetId}
              />
              <span><b>{user?.displayName || "Adventurer"}</b><small>{admin ? "Operations" : "Collector"}</small></span>
            </button>
            {accountOpen ? (
              <div className="account-menu">
                <NavLink to="/settings"><SettingsIcon /> Settings</NavLink>
                {user?.isAdmin ? <NavLink to={admin ? "/home" : "/admin"}>{admin ? "Back to game" : "Operations"}</NavLink> : null}
                <Button tone="ghost" onClick={() => void logout()}>Sign out</Button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="page-canvas" id="main-content">
          <Outlet />
        </main>
        <div className="story-dock-wrap">
          <nav className="story-dock" aria-label={admin ? "Admin navigation" : "Primary navigation"}>
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  className={admin ? "tone-accent" : `tone-${"tone" in item ? item.tone : "primary"}`}
                  end={item.href === "/home" || item.href === "/admin"}
                  key={item.href}
                  to={item.href}
                >
                  <Icon />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <NavLink className="dock-more" to={admin ? "/home" : "/settings"} aria-label={admin ? "Back to game" : "Settings"}>
            <SettingsIcon />
          </NavLink>
        </div>
    </div>
  );

  if (auth.status === "restoring") {
    return <div className="boot-screen"><Brand /><span className="loading-ring" /></div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (admin && !user.isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return content;
}

export function ThemeMeta() {
  const { themeName } = useTheme();
  return <meta name="theme-color" content={THEME_COLORS[themeName].bg} />;
}
