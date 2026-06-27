const WIDGET_QUESTS_PATHNAME = "/widget-quests";
const QUEST_TAB_PATHNAMES = new Set(["/quests", "/(tabs)/quests"]);

let lastContentPathname: string | null = null;

export function rememberContentPathname(pathname: string) {
  if (pathname === WIDGET_QUESTS_PATHNAME) {
    return;
  }

  lastContentPathname = pathname;
}

export function getLastContentPathname() {
  return lastContentPathname;
}

export function isQuestTabPathname(pathname: string | null) {
  return pathname !== null && QUEST_TAB_PATHNAMES.has(pathname);
}
