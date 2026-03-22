import type { Locale } from "@adventure-time/shared";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

interface AbilityTextInput {
  key: string;
  name: string;
  nameFr?: string | null;
  description: string;
  descriptionFr?: string | null;
}

function tr(t: TranslateFn, key: string, fallback: string) {
  const value = t(key);
  return value === key ? fallback : value;
}

function humanizeAbilityKey(key: string) {
  const tail = key.includes(".") ? key.split(".").pop() ?? key : key;
  const spaced = tail.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function localizeTypeName(type: string, t: TranslateFn) {
  return tr(t, `combat.type.${type}`, type);
}

export function localizeStatusName(status: string, t: TranslateFn) {
  return tr(t, `combat.status.${status}`, status);
}

export function localizeAbilityText(
  ability: AbilityTextInput,
  locale: Locale,
) {
  const name =
    locale === "fr"
      ? (ability.nameFr?.trim() ?? "") || ability.name?.trim() || humanizeAbilityKey(ability.key)
      : ability.name?.trim() || humanizeAbilityKey(ability.key);

  const description =
    locale === "fr"
      ? (ability.descriptionFr?.trim() ?? "") || ability.description
      : ability.description;

  return {
    name,
    description,
  };
}
