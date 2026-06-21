import { env } from "../lib/env";

const DEEPL_FREE_ENDPOINT = "https://api-free.deepl.com/v2/translate";
const MAX_RETRIES = 6;
const BASE_DELAY_MS = 1000;

const PROTECTED_EFFECT_TERMS = [
  { source: "Summoning Sickness", target: "Mal d'invocation" },
  { source: "Guard Up", target: "Garde renforcée" },
  { source: "GuardUp", target: "Garde renforcée" },
  { source: "Regeneration", target: "Régénération" },
  { source: "Burning", target: "Brûlure" },
  { source: "Burn", target: "Brûlure" },
  { source: "Weaken", target: "Affaibli" },
  { source: "Weakened", target: "Affaibli" },
  { source: "Vulnerable", target: "Vulnérable" },
  { source: "Stunned", target: "Étourdi" },
  { source: "Silence", target: "Silence" },
  { source: "Cleanse", target: "Purification" },
  { source: "Barrier", target: "Barrière" },
  { source: "Stealth", target: "Furtivité" },
  { source: "Counter", target: "Contre" },
  { source: "Empower", target: "Puissance" },
  { source: "Shield", target: "Bouclier" },
  { source: "Freeze", target: "Gel" },
  { source: "Haste", target: "Hâte" },
  { source: "Taunt", target: "Provocation" },
  { source: "Cover", target: "Couverture" },
  { source: "Poison", target: "Poison" },
  { source: "Thorns", target: "Épines" },
  { source: "Mark", target: "Marque" },
  { source: "Doom", target: "Condamnation" },
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value: string) {
  return value.trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFrenchAbilityText(input: string) {
  return input
    .replace(/\bHP\b/g, "PV")
    .replace(/\bmax PV\b/g, "PV max")
    .replace(/\bPV maximum\b/g, "PV max")
    .replace(/\bcooldowns\b/gi, "recharges")
    .replace(/\bcooldown\b/gi, "recharge")
    .replace(/\bdebuffs\b/gi, "malus")
    .replace(/\bdebuff\b/gi, "malus")
    .replace(/\bbuffs\b/gi, "bonus")
    .replace(/\bbuff\b/gi, "bonus")
    .replace(/\bDoTs\b/g, "dégâts sur la durée")
    .replace(/\bDOTs\b/g, "dégâts sur la durée")
    .replace(/\bKO\b/g, "K.O.")
    .replace(/\s+;/g, " ;")
    .replace(/\s+:/g, " :")
    .replace(/\s+/g, " ")
    .trim();
}

function protectEffectTerms(input: string): {
  text: string;
  tokens: Map<string, string>;
} {
  const tokens = new Map<string, string>();
  let out = input;

  for (let i = 0; i < PROTECTED_EFFECT_TERMS.length; i += 1) {
    const term = PROTECTED_EFFECT_TERMS[i];
    const token = `ZXTERM${i}ZX`;
    const pattern = new RegExp(`\\b${escapeRegExp(term.source)}\\b`, "gi");
    out = out.replace(pattern, token);
    tokens.set(token, term.target);
  }

  return { text: out, tokens };
}

function restoreEffectTerms(input: string, tokens: Map<string, string>) {
  let out = input;
  for (const [token, term] of tokens.entries()) {
    const pattern = new RegExp(token, "g");
    out = out.replace(pattern, term);
  }
  return out;
}

function computeBackoffMs(attempt: number) {
  const jitter = Math.floor(Math.random() * 300);
  return BASE_DELAY_MS * 2 ** (attempt - 1) + jitter;
}

function parseRetryAfterMs(retryAfter: string | null) {
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.ceil(seconds * 1000);
  }

  const retryDate = Date.parse(retryAfter);
  if (Number.isNaN(retryDate)) return null;
  const diff = retryDate - Date.now();
  return diff > 0 ? diff : null;
}

async function translateText(text: string, preserveTerms: boolean) {
  const normalized = normalize(text);
  if (!normalized || !env.DEEPL_API_KEY) {
    return normalized;
  }

  const protectedValue = preserveTerms
    ? protectEffectTerms(normalized)
    : { text: normalized, tokens: new Map<string, string>() };

  const body = new URLSearchParams({
    target_lang: "FR",
    source_lang: "EN",
    preserve_formatting: "1",
  });
  body.append("text", protectedValue.text);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(DEEPL_FREE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
      });

      if (res.status === 429) {
        const retryAfter = parseRetryAfterMs(res.headers.get("retry-after"));
        await sleep(retryAfter ?? computeBackoffMs(attempt));
        continue;
      }

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(
          `DeepL error ${res.status} ${res.statusText}: ${errorBody.slice(0, 300)}`,
        );
      }

      const data = (await res.json()) as {
        translations?: Array<{ text: string }>;
      };
      const translatedText = data.translations?.[0]?.text?.trim() || normalized;
      const restored = preserveTerms
        ? restoreEffectTerms(translatedText, protectedValue.tokens)
        : translatedText;
      return normalizeFrenchAbilityText(restored);
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.error(
          `DeepL translation failed after ${MAX_RETRIES} attempts:`,
          error,
        );
        break;
      }
      await sleep(computeBackoffMs(attempt));
    }
  }

  return preserveTerms
    ? normalizeFrenchAbilityText(restoreEffectTerms(normalized, protectedValue.tokens))
    : normalizeFrenchAbilityText(normalized);
}

export async function translateAbilityToFrench(input: {
  name: string;
  description: string;
}) {
  const name = normalize(input.name);
  const description = normalize(input.description);

  if (!name && !description) {
    return {
      nameFr: "",
      descriptionFr: "",
      translated: false,
    };
  }

  const [nameFr, descriptionFr] = await Promise.all([
    translateText(name, false),
    translateText(description, true),
  ]);

  return {
    nameFr: nameFr || name,
    descriptionFr: descriptionFr || description,
    translated: Boolean(env.DEEPL_API_KEY),
  };
}

export async function translateAbilityDescriptionToFrench(description: string) {
  return translateText(description, true);
}
