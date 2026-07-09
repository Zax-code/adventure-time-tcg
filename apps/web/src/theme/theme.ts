import {
  normalizeThemeName,
  type ThemeName,
} from "@adventure-time/theme";

export const WEB_THEME_STORAGE_KEY = "themeName";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export function getBrowserThemeStorage(): ThemeStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredThemeName(
  storage: Pick<Storage, "getItem"> | null = getBrowserThemeStorage(),
): ThemeName {
  if (!storage) {
    return "candy";
  }

  try {
    return normalizeThemeName(storage.getItem(WEB_THEME_STORAGE_KEY));
  } catch {
    return "candy";
  }
}

export function persistThemeName(
  themeName: ThemeName,
  storage: Pick<Storage, "setItem"> | null = getBrowserThemeStorage(),
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(WEB_THEME_STORAGE_KEY, themeName);
  } catch {
    // A private browsing quota failure should not prevent theme changes.
  }
}

export function applyThemeToElement(
  themeName: ThemeName,
  element: HTMLElement = document.documentElement,
) {
  element.dataset.theme = themeName;
}
