CREATE TYPE step_source AS ENUM ('device_health', 'fitbit');
CREATE TYPE image_kind AS ENUM ('card', 'profile');

CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  coins integer NOT NULL DEFAULT 100,
  dust integer NOT NULL DEFAULT 0,
  avatar_asset_id text,
  is_admin boolean NOT NULL DEFAULT false,
  preferred_step_source step_source NOT NULL DEFAULT 'device_health',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users(email);

CREATE TABLE email_auth_credentials (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_auth_credentials_user_id_key ON email_auth_credentials(user_id);

CREATE TABLE auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  refresh_token_hash text NOT NULL,
  user_agent text,
  ip_address text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);

CREATE TABLE rarities (
  id text PRIMARY KEY,
  name text NOT NULL,
  drop_rate real NOT NULL,
  color text NOT NULL
);
CREATE UNIQUE INDEX rarities_name_key ON rarities(name);

CREATE TABLE image_assets (
  id text PRIMARY KEY,
  kind image_kind NOT NULL,
  mime_type text NOT NULL,
  object_key text,
  placeholder_svg text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX image_assets_kind_idx ON image_assets(kind);

CREATE TABLE cards (
  id text PRIMARY KEY,
  name text NOT NULL,
  character text NOT NULL,
  description text NOT NULL,
  hp integer NOT NULL,
  attack integer NOT NULL,
  defense integer NOT NULL,
  speed integer NOT NULL DEFAULT 40,
  type text NOT NULL,
  rarity_id text NOT NULL REFERENCES rarities(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  image_asset_id text REFERENCES image_assets(id) ON DELETE SET NULL ON UPDATE CASCADE,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD CONSTRAINT users_avatar_asset_id_fkey FOREIGN KEY (avatar_asset_id) REFERENCES image_assets(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE owned_cards (
  id text PRIMARY KEY,
  card_id text NOT NULL REFERENCES cards(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  quantity integer NOT NULL,
  obtained_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX owned_cards_card_id_user_id_key ON owned_cards(card_id, user_id);
