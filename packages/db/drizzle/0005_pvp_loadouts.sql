CREATE TABLE pvp_loadouts (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name text NOT NULL,
  card_ids text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pvp_loadouts_owner_id_idx ON pvp_loadouts(owner_id);
