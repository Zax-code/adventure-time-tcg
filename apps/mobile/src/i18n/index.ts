import { useMemo } from "react";

import { translations, type Locale } from "@adventure-time/shared";

import { useSessionStore } from "../stores/session-store";
import { nativeTranslations } from "./native-translations";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeTranslations(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
) {
  const out: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(extra)) {
    const existing = out[key];
    if (isRecord(existing) && isRecord(value)) {
      out[key] = mergeTranslations(existing, value);
      continue;
    }
    out[key] = value;
  }

  return out;
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
  const localeTranslations = mergeTranslations(
    translations[locale] as unknown as Record<string, unknown>,
    nativeTranslations[locale],
  );
  const fallbackTranslations = mergeTranslations(
    translations.en as unknown as Record<string, unknown>,
    nativeTranslations.en,
  );

  const value =
    getNestedValue(localeTranslations, key) ??
    getNestedValue(fallbackTranslations, key) ??
    key;

  return interpolate(value, params);
}

export function useTranslation() {
  const locale = useSessionStore(
    (state) => state.user?.preferredLanguage ?? "en",
  );

  return useMemo(
    () => ({
      locale,
      t: (key: string, params?: Record<string, string | number>) =>
        getTranslation(locale, key, params),
    }),
    [locale],
  );
}
