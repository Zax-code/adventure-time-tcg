ALTER TABLE pvp_matches ADD COLUMN state text;
ALTER TABLE pvp_matches ADD COLUMN current_turn integer NOT NULL DEFAULT 1;
ALTER TABLE pvp_matches ADD COLUMN turn_started_at timestamptz;
