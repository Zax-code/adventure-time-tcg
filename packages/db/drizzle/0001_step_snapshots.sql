CREATE TABLE user_step_snapshots (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  source step_source NOT NULL,
  step_count integer NOT NULL,
  recorded_for text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_step_snapshots_user_id_idx ON user_step_snapshots(user_id);
CREATE UNIQUE INDEX user_step_snapshots_user_source_day_key ON user_step_snapshots(user_id, source, recorded_for);
