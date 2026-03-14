CREATE TABLE card_gifts (
  id text PRIMARY KEY,
  card_id text NOT NULL REFERENCES cards(id) ON DELETE CASCADE ON UPDATE CASCADE,
  from_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  to_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX card_gifts_from_user_id_idx ON card_gifts(from_user_id);
CREATE INDEX card_gifts_to_user_id_idx ON card_gifts(to_user_id);
CREATE INDEX card_gifts_status_idx ON card_gifts(status);
