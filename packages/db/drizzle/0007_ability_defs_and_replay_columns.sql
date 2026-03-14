ALTER TABLE pvp_matches ADD COLUMN seed text;
ALTER TABLE pvp_matches ADD COLUMN initial_state text;
ALTER TABLE pvp_matches ADD COLUMN replay_version integer;
ALTER TABLE pvp_matches ADD COLUMN turn_snapshots text;

CREATE TABLE ability_defs (
  id text PRIMARY KEY,
  key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  description_fr text,
  name_fr text,
  type text NOT NULL,
  cost integer NOT NULL DEFAULT 0,
  cooldown integer,
  once_per_match boolean NOT NULL DEFAULT false,
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ability_defs_key_key ON ability_defs(key);

CREATE TABLE card_abilities (
  id text PRIMARY KEY,
  card_id text NOT NULL REFERENCES cards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  passive_id text REFERENCES ability_defs(id) ON DELETE SET NULL ON UPDATE CASCADE,
  skill_id text REFERENCES ability_defs(id) ON DELETE SET NULL ON UPDATE CASCADE,
  ultimate_id text REFERENCES ability_defs(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX card_abilities_card_id_key ON card_abilities(card_id);
CREATE INDEX card_abilities_card_id_idx ON card_abilities(card_id);
