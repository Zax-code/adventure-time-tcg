CREATE TYPE pvp_match_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DECLINED');

CREATE TABLE quest_definitions (
  id text PRIMARY KEY,
  quest_type text NOT NULL,
  title_key text NOT NULL,
  description_key text NOT NULL,
  icon text NOT NULL,
  target integer NOT NULL,
  reward integer NOT NULL,
  requires_fitbit boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX quest_definitions_quest_type_key ON quest_definitions(quest_type);

CREATE TABLE daily_quests (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  date text NOT NULL,
  quest_type text NOT NULL,
  target integer NOT NULL,
  reward integer NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  claimed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  claimed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX daily_quests_user_id_idx ON daily_quests(user_id);
CREATE UNIQUE INDEX daily_quests_user_date_type_key ON daily_quests(user_id, date, quest_type);

CREATE TABLE wordle_daily_words (
  id text PRIMARY KEY,
  date text NOT NULL,
  word text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wordle_daily_words_date_key ON wordle_daily_words(date);

CREATE TABLE wordle_dictionary_words (
  id text PRIMARY KEY,
  locale text NOT NULL,
  word text NOT NULL,
  length integer NOT NULL,
  is_allowed_guess boolean NOT NULL DEFAULT true,
  is_solution_candidate boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX wordle_dictionary_locale_word_key ON wordle_dictionary_words(locale, word);

CREATE TABLE wordle_daily_attempts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  date text NOT NULL,
  attempt integer NOT NULL,
  guess text NOT NULL,
  evaluation text NOT NULL,
  solved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wordle_attempts_user_date_attempt_key ON wordle_daily_attempts(user_id, date, attempt);

CREATE TABLE speed_calculus_daily_runs (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  date text NOT NULL,
  run_number integer NOT NULL,
  seed text NOT NULL,
  answers text NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'in_progress',
  score integer NOT NULL DEFAULT 0,
  reward integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  pause_expires_at timestamptz
);
CREATE UNIQUE INDEX speed_runs_user_date_run_key ON speed_calculus_daily_runs(user_id, date, run_number);

CREATE TABLE pvp_matches (
  id text PRIMARY KEY,
  inviter_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  invitee_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  status pvp_match_status NOT NULL DEFAULT 'PENDING',
  inviter_loadout text NOT NULL DEFAULT '[]',
  invitee_loadout text NOT NULL DEFAULT '[]',
  winner_id text REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  match_log text NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pvp_matches_inviter_id_idx ON pvp_matches(inviter_id);
CREATE INDEX pvp_matches_invitee_id_idx ON pvp_matches(invitee_id);
CREATE INDEX pvp_matches_status_idx ON pvp_matches(status);
