ALTER TABLE users ADD COLUMN last_daily_claim timestamptz;
ALTER TABLE cards ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

CREATE TABLE packs (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  card_count integer NOT NULL DEFAULT 5,
  cost integer NOT NULL DEFAULT 100,
  image_url text NOT NULL,
  color text NOT NULL DEFAULT '#EC4899',
  is_active boolean NOT NULL DEFAULT true,
  guaranteed_rarity text
);

CREATE UNIQUE INDEX packs_name_key ON packs(name);
