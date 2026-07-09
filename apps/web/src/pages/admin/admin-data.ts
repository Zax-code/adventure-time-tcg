export const ADMIN_QUERY_KEYS = {
  abilities: ["admin", "abilities"] as const,
  card: (id: string) => ["admin", "cards", id] as const,
  cardBacks: ["admin", "card-backs"] as const,
  cards: ["admin", "cards"] as const,
  emailRequests: ["admin", "email-requests"] as const,
  imageAssets: ["admin", "image-assets"] as const,
  pack: (id: string) => ["admin", "packs", id] as const,
  packs: ["admin", "packs"] as const,
  rarities: ["admin", "rarities"] as const,
  user: (id: string) => ["admin", "users", id] as const,
  users: ["admin", "users"] as const,
};

const adminDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatAdminDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return adminDateFormatter.format(date);
}
