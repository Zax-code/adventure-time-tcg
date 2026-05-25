import { useMemo } from "react";

import { useLocaleStore } from "../stores/locale-store";
import { useSessionStore } from "../stores/session-store";
import en from "./locales/en";
import fr from "./locales/fr";
import type { Locale } from "./types";

const translations: Record<Locale, Record<string, unknown>> = {
  en,
  fr,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (isRecord(current) && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
) {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

export function getTranslation(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
) {
  const localeTranslations = translations[locale];
  const fallbackTranslations = translations.en;

  const value =
    getNestedValue(localeTranslations, key) ??
    getNestedValue(fallbackTranslations, key) ??
    key;

  return interpolate(value, params);
}

export function useTranslation() {
  const userLocale = useSessionStore((state) => state.user?.preferredLanguage);
  const guestLocale = useLocaleStore((state) => state.locale);
  const locale = userLocale ?? guestLocale;

  return useMemo(
    () => ({
      locale,
      t: (key: string, params?: Record<string, string | number>) =>
        getTranslation(locale, key, params),
    }),
    [locale],
  );
}
