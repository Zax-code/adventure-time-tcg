import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  normalizeThemeName,
  THEME_NAMES,
  type ThemeName,
} from "@adventure-time/theme";

import "./theme.css";

import {
  applyThemeToElement,
  getBrowserThemeStorage,
  persistThemeName,
  readStoredThemeName,
} from "./theme";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export interface ThemeContextValue {
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
}

const THEME_LABELS: Record<ThemeName, string> = {
  candy: "Candy",
  ice: "Ice",
  nightosphere: "Nightosphere",
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme,
  storage,
}: {
  children: ReactNode;
  initialTheme?: ThemeName;
  storage?: ThemeStorage | null;
}) {
  const resolvedStorage =
    storage === undefined ? getBrowserThemeStorage() : storage;
  const [themeName, setThemeName] = useState<ThemeName>(() =>
    initialTheme
      ? normalizeThemeName(initialTheme)
      : readStoredThemeName(resolvedStorage),
  );

  const setTheme = useCallback((nextThemeName: ThemeName) => {
    setThemeName(normalizeThemeName(nextThemeName));
  }, []);

  useLayoutEffect(() => {
    applyThemeToElement(themeName);
    persistThemeName(themeName, resolvedStorage);
  }, [resolvedStorage, themeName]);

  const value = useMemo(() => ({ themeName, setTheme }), [setTheme, themeName]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = useOptionalTheme();

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}

export function useOptionalTheme(): ThemeContextValue | null {
  return useContext(ThemeContext);
}

export function ThemeSwitcher({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { setTheme, themeName } = useTheme();

  return (
    <div
      aria-label="Color theme"
      className={`theme-switcher ${compact ? "compact" : ""} ${className}`.trim()}
      role="group"
    >
      {THEME_NAMES.map((option) => (
        <button
          aria-label={`${THEME_LABELS[option]} theme`}
          aria-pressed={themeName === option}
          className={`theme-option-${option}`}
          key={option}
          onClick={() => setTheme(option)}
          title={THEME_LABELS[option]}
          type="button"
        >
          {compact ? null : THEME_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
