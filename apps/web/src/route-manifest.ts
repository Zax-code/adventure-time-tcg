export const websiteRoutes = [
  { group: "Public", path: "/", title: "Adventure Time TCG" },
  { group: "Public", path: "/status", title: "Service status" },
  { group: "Public", path: "/privacy", title: "Privacy" },
  { group: "Public", path: "/account-deletion", title: "Account deletion" },
  { group: "Public", path: "/email/verify", title: "Verify email" },
  { group: "Public", path: "/password/reset", title: "Reset password" },
  { group: "Public", path: "/login", title: "Sign in" },
  { group: "Public", path: "/register", title: "Create account" },
  { group: "Public", path: "/404", title: "Not found" },
  { group: "Player", path: "/home", title: "Home" },
  { group: "Player", path: "/collection", title: "Collection" },
  { group: "Player", path: "/collection/:cardId", title: "Card detail" },
  { group: "Player", path: "/packs", title: "Packs" },
  { group: "Player", path: "/gifts", title: "Gifts" },
  { group: "Player", path: "/quests", title: "Daily quests" },
  { group: "Player", path: "/quests/daily-numbers", title: "Daily Numbers" },
  { group: "Player", path: "/quests/daily-numbers/play", title: "Daily Numbers play" },
  { group: "Player", path: "/quests/daily-numbers/history", title: "Daily Numbers archive" },
  { group: "Player", path: "/quests/speed-calculus", title: "Speed Calculus" },
  { group: "Player", path: "/quests/speed-calculus/training", title: "Calculus training" },
  { group: "Player", path: "/quests/wordle", title: "Daily Wordle" },
  { group: "Player", path: "/pvp", title: "PvP lobby" },
  { group: "Player", path: "/pvp/loadouts", title: "PvP loadouts" },
  { group: "Player", path: "/pvp/match/:matchId", title: "Live battle" },
  { group: "Player", path: "/pvp/history", title: "Battle history" },
  { group: "Player", path: "/pvp/history/:matchId", title: "Battle replay" },
  { group: "Player", path: "/pvp/spectate", title: "Spectate" },
  { group: "Player", path: "/pvp/spectate/:matchId", title: "Spectate match" },
  { group: "Player", path: "/pvp/mechanics", title: "PvP mechanics" },
  { group: "Player", path: "/pvp/reference", title: "Combat reference" },
  { group: "Player", path: "/settings", title: "Settings" },
  { group: "Admin", path: "/admin", title: "Operations overview" },
  { group: "Admin", path: "/admin/cards", title: "Admin cards" },
  { group: "Admin", path: "/admin/cards/:id", title: "Card editor" },
  { group: "Admin", path: "/admin/packs", title: "Admin packs" },
  { group: "Admin", path: "/admin/packs/:id", title: "Pack editor" },
  { group: "Admin", path: "/admin/card-backs", title: "Card backs" },
  { group: "Admin", path: "/admin/image-assets", title: "Image assets" },
  { group: "Admin", path: "/admin/featured", title: "Featured cards" },
  { group: "Admin", path: "/admin/abilities", title: "Abilities" },
  { group: "Admin", path: "/admin/abilities/:id", title: "Ability editor" },
  { group: "Admin", path: "/admin/users", title: "Users" },
  { group: "Admin", path: "/admin/users/:id", title: "User detail" },
  { group: "Admin", path: "/admin/email-requests", title: "Access requests" },
  { group: "Admin", path: "/admin/balance", title: "Balance lab" },
] as const;

export function titleForPath(pathname: string) {
  const match = websiteRoutes.find((route) => {
    const routeParts = route.path.split("/");
    const pathParts = pathname.split("/");
    return routeParts.length === pathParts.length && routeParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
  });
  return match?.title ?? "Not found";
}
