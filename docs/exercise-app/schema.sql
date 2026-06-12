-- ============================================================================
-- Exercise App — Full Database Schema (PostgreSQL 15+)
-- ============================================================================
-- Domain model:
--   PROGRAMME  ->  WORKOUT (ordered, scheduled)  ->  BLOCK  ->  EXERCISE
--
-- Domains in this file, in dependency order:
--   1. Extensions & enums
--   2. Media (original video/thumbnail content pipeline)
--   3. Exercise content library (exercises, instructions, muscles, equipment)
--   4. Programme & workout templates (system-authored and user-authored)
--   5. Users, locations & per-user exercise variations
--   6. Enrollment & smart scheduling
--   7. Workout execution (sessions, pause/resume, set-level logging)
--   8. Progress, goals, records & achievements
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- fuzzy exercise search
CREATE EXTENSION IF NOT EXISTS citext;         -- case-insensitive emails

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------

-- Training modality of an exercise. Matches free-exercise-db categories plus
-- app-specific additions (hiit, mobility, balance, recovery).
CREATE TYPE exercise_modality AS ENUM (
  'strength', 'cardio', 'hiit', 'plyometrics', 'stretching', 'mobility',
  'olympic_weightlifting', 'powerlifting', 'strongman', 'balance', 'recovery'
);

CREATE TYPE force_type        AS ENUM ('push', 'pull', 'static');
CREATE TYPE mechanic_type     AS ENUM ('compound', 'isolation');
CREATE TYPE difficulty_level  AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE muscle_role       AS ENUM ('primary', 'secondary', 'stabiliser');
CREATE TYPE instruction_phase AS ENUM ('setup', 'execution', 'breathing', 'safety');

-- How an exercise is measured. An exercise can support several metrics
-- (e.g. plank: duration; sprint: distance + duration; squat: reps + weight).
CREATE TYPE metric_type AS ENUM (
  'reps', 'weight', 'duration', 'distance', 'calories', 'pace', 'height', 'rounds'
);

CREATE TYPE exercise_relation AS ENUM (
  'progression',   -- harder version
  'regression',    -- easier version
  'alternative',   -- same stimulus, different equipment/space
  'antagonist',    -- pairing for supersets
  'variation'      -- grip/stance/tempo variant
);

CREATE TYPE content_status AS ENUM ('draft', 'in_review', 'published', 'archived');
CREATE TYPE visibility     AS ENUM ('system', 'private', 'shared', 'public');

CREATE TYPE media_kind   AS ENUM ('image', 'video');
CREATE TYPE media_status AS ENUM ('uploading', 'processing', 'ready', 'failed');

CREATE TYPE block_type AS ENUM (
  'warmup', 'straight_sets', 'superset', 'circuit', 'amrap', 'emom',
  'tabata', 'interval', 'for_time', 'pyramid', 'dropset', 'cooldown'
);

CREATE TYPE load_basis AS ENUM (
  'bodyweight', 'absolute', 'percent_1rm', 'rpe', 'band_level', 'user_setting'
);

CREATE TYPE programme_goal AS ENUM (
  'general_fitness', 'fat_loss', 'muscle_gain', 'strength', 'endurance',
  'mobility', 'rehab', 'sport_specific', 'event_prep'
);

CREATE TYPE enrollment_status AS ENUM ('active', 'paused', 'completed', 'abandoned');

CREATE TYPE schedule_status AS ENUM (
  'scheduled', 'in_progress', 'completed', 'skipped', 'missed', 'rescheduled'
);

CREATE TYPE session_state AS ENUM ('in_progress', 'paused', 'completed', 'abandoned');

CREATE TYPE session_event_type AS ENUM (
  'started', 'paused', 'resumed', 'completed', 'abandoned',
  'block_started', 'block_completed',
  'exercise_started', 'exercise_completed', 'exercise_skipped', 'exercise_substituted',
  'set_completed', 'rest_started', 'rest_skipped', 'rest_completed'
);

CREATE TYPE goal_type AS ENUM (
  'body_weight', 'body_measurement', 'exercise_performance',
  'workout_frequency', 'programme_completion', 'streak', 'custom'
);

CREATE TYPE goal_status AS ENUM ('active', 'achieved', 'missed', 'abandoned');

CREATE TYPE location_type AS ENUM ('home', 'gym', 'outdoors', 'office', 'travel', 'other');

CREATE TYPE unit_system AS ENUM ('metric', 'imperial');

-- ----------------------------------------------------------------------------
-- 2. MEDIA
-- Original video/thumbnail content. One logical asset has many renditions
-- (e.g. 1080p/720p/HLS for video, multiple sizes for thumbnails).
-- ----------------------------------------------------------------------------

CREATE TABLE media_asset (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             media_kind   NOT NULL,
  status           media_status NOT NULL DEFAULT 'uploading',
  storage_key      text         NOT NULL,            -- canonical object-store key
  mime_type        text,
  duration_seconds numeric(8,2),                     -- video only
  width_px         integer,
  height_px        integer,
  alt_text         text,                             -- accessibility
  checksum_sha256  text,
  created_by       uuid,                             -- staff/creator user id
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_rendition (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id     uuid NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
  label        text NOT NULL,                        -- 'original', '1080p', 'hls', 'thumb_320'
  storage_key  text NOT NULL,
  url          text,                                 -- CDN URL once published
  mime_type    text,
  width_px     integer,
  height_px    integer,
  bitrate_kbps integer,
  UNIQUE (asset_id, label)
);

-- ----------------------------------------------------------------------------
-- 3. EXERCISE CONTENT LIBRARY
-- ----------------------------------------------------------------------------

-- Body parts form a small tree, e.g. legs -> quadriceps/hamstrings/calves.
CREATE TABLE body_part (
  id        smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug      text NOT NULL UNIQUE,                    -- 'quadriceps'
  name      text NOT NULL,
  parent_id smallint REFERENCES body_part(id),
  region    text                                     -- 'upper', 'lower', 'core', 'full_body'
);

CREATE TABLE equipment (
  id          smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug        text NOT NULL UNIQUE,                  -- 'kettlebell'
  name        text NOT NULL,
  category    text,                                  -- 'free_weights', 'machine', 'cardio', 'accessory', 'none'
  is_loadable boolean NOT NULL DEFAULT false         -- supports a weight value
);

CREATE TABLE exercise (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL UNIQUE,         -- stable external id, e.g. 'barbell-back-squat'
  name                 text NOT NULL,
  description          text,
  modality             exercise_modality NOT NULL,
  force                force_type,
  mechanic             mechanic_type,
  level                difficulty_level NOT NULL DEFAULT 'beginner',
  is_unilateral        boolean NOT NULL DEFAULT false,
  -- Mandatory rest after the exercise (requirement). Prescriptions may extend
  -- but never reduce it below this floor.
  min_rest_seconds     integer NOT NULL DEFAULT 30 CHECK (min_rest_seconds >= 0),
  default_rest_seconds integer NOT NULL DEFAULT 60 CHECK (default_rest_seconds >= 0),
  met_value            numeric(4,1),                 -- for calorie estimation
  thumbnail_asset_id   uuid REFERENCES media_asset(id),
  video_asset_id       uuid REFERENCES media_asset(id),
  space_required       text,                         -- 'minimal', 'open_floor', 'outdoor_track'
  noise_level          text,                         -- 'quiet', 'moderate', 'loud' (jumping etc.)
  source               text NOT NULL DEFAULT 'original', -- 'free-exercise-db', 'original', ...
  source_id            text,                         -- id in the source dataset
  status               content_status NOT NULL DEFAULT 'draft',
  search_tsv           tsvector GENERATED ALWAYS AS (
                         to_tsvector('english', name || ' ' || coalesce(description, ''))
                       ) STORED,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (default_rest_seconds >= min_rest_seconds)
);

CREATE INDEX exercise_search_idx   ON exercise USING gin (search_tsv);
CREATE INDEX exercise_name_trgm    ON exercise USING gin (name gin_trgm_ops);
CREATE INDEX exercise_modality_idx ON exercise (modality, level) WHERE status = 'published';

-- Ordered instruction steps, split by phase. Setup steps are optional per
-- exercise; execution steps are expected for every published exercise.
CREATE TABLE exercise_instruction (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  phase       instruction_phase NOT NULL,
  step_number smallint NOT NULL CHECK (step_number > 0),
  body        text NOT NULL,
  UNIQUE (exercise_id, phase, step_number)
);

CREATE TABLE exercise_body_part (
  exercise_id  uuid     NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  body_part_id smallint NOT NULL REFERENCES body_part(id),
  role         muscle_role NOT NULL,
  PRIMARY KEY (exercise_id, body_part_id)
);

CREATE TABLE exercise_equipment (
  exercise_id  uuid     NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  equipment_id smallint NOT NULL REFERENCES equipment(id),
  is_required  boolean  NOT NULL DEFAULT true,       -- false = optional/substitutable
  PRIMARY KEY (exercise_id, equipment_id)
);

-- Which metrics an exercise is tracked with; exactly one is primary.
CREATE TABLE exercise_metric (
  exercise_id uuid        NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  metric      metric_type NOT NULL,
  is_primary  boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (exercise_id, metric)
);

CREATE UNIQUE INDEX exercise_metric_one_primary
  ON exercise_metric (exercise_id) WHERE is_primary;

-- Progressions/regressions/alternatives — powers smart substitution when a
-- user lacks equipment or an exercise is too hard/easy.
CREATE TABLE exercise_relationship (
  from_exercise_id uuid NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  to_exercise_id   uuid NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  relation         exercise_relation NOT NULL,
  note             text,
  PRIMARY KEY (from_exercise_id, to_exercise_id, relation),
  CHECK (from_exercise_id <> to_exercise_id)
);

CREATE TABLE tag (
  id   smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug text NOT NULL UNIQUE,                         -- 'low-impact', 'no-jumping', 'apartment-friendly'
  name text NOT NULL
);

CREATE TABLE exercise_tag (
  exercise_id uuid     NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  tag_id      smallint NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, tag_id)
);

-- ----------------------------------------------------------------------------
-- 4. PROGRAMME & WORKOUT TEMPLATES
-- Templates are immutable-ish definitions; execution data lives in section 7.
-- owner_user_id IS NULL => system/curated content; otherwise user-authored.
-- ----------------------------------------------------------------------------

CREATE TABLE programme (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text UNIQUE,
  name               text NOT NULL,
  description        text,
  goal               programme_goal NOT NULL DEFAULT 'general_fitness',
  level              difficulty_level NOT NULL DEFAULT 'beginner',
  duration_weeks     smallint CHECK (duration_weeks > 0),   -- NULL = open-ended
  workouts_per_week  smallint NOT NULL DEFAULT 3 CHECK (workouts_per_week BETWEEN 1 AND 14),
  thumbnail_asset_id uuid REFERENCES media_asset(id),
  owner_user_id      uuid,                           -- FK added after app_user
  visibility         visibility NOT NULL DEFAULT 'system',
  status             content_status NOT NULL DEFAULT 'draft',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workout (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text UNIQUE,
  name                 text NOT NULL,
  description          text,
  focus                text,                         -- 'push', 'legs', 'full body', 'conditioning'
  level                difficulty_level NOT NULL DEFAULT 'beginner',
  est_duration_minutes smallint,
  intensity            smallint CHECK (intensity BETWEEN 1 AND 10),
  thumbnail_asset_id   uuid REFERENCES media_asset(id),
  owner_user_id        uuid,
  visibility           visibility NOT NULL DEFAULT 'system',
  status               content_status NOT NULL DEFAULT 'draft',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Placement of workouts inside a programme. day_of_week is NULL for
-- "flexible" programmes — the scheduler picks the day.
CREATE TABLE programme_workout (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES programme(id) ON DELETE CASCADE,
  workout_id   uuid NOT NULL REFERENCES workout(id),
  week_number  smallint NOT NULL CHECK (week_number > 0),
  sequence     smallint NOT NULL,                    -- order within the week
  day_of_week  smallint CHECK (day_of_week BETWEEN 1 AND 7),
  is_optional  boolean NOT NULL DEFAULT false,
  UNIQUE (programme_id, week_number, sequence)
);

-- A workout is an ordered list of blocks: warmup, supersets, circuits,
-- AMRAP/EMOM/Tabata intervals, cooldown, etc.
CREATE TABLE workout_block (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id           uuid NOT NULL REFERENCES workout(id) ON DELETE CASCADE,
  sequence             smallint NOT NULL,
  block_type           block_type NOT NULL DEFAULT 'straight_sets',
  name                 text,
  rounds               smallint CHECK (rounds > 0),  -- circuits/supersets
  work_seconds         integer,                      -- tabata/interval work window
  rest_between_rounds_seconds integer,
  time_cap_seconds     integer,                      -- AMRAP / for_time cap
  note                 text,
  UNIQUE (workout_id, sequence)
);

-- An exercise slotted into a block with its default prescription.
CREATE TABLE workout_block_exercise (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id            uuid NOT NULL REFERENCES workout_block(id) ON DELETE CASCADE,
  exercise_id         uuid NOT NULL REFERENCES exercise(id),
  sequence            smallint NOT NULL,
  sets                smallint CHECK (sets > 0),
  reps_min            smallint,
  reps_max            smallint,
  duration_seconds    integer,
  distance_metres     integer,
  load_basis          load_basis NOT NULL DEFAULT 'user_setting',
  load_value          numeric(7,2),                  -- kg, %1RM or RPE per load_basis
  tempo               text,                          -- e.g. '3-1-1-0'
  -- Overrides exercise.default_rest_seconds; enforced >= min_rest_seconds in
  -- application logic / trigger.
  rest_after_seconds  integer CHECK (rest_after_seconds >= 0),
  note                text,
  UNIQUE (block_id, sequence),
  CHECK (reps_max IS NULL OR reps_min IS NULL OR reps_max >= reps_min)
);

-- Optional per-set override (pyramids, top sets, drop sets). Falls back to the
-- parent workout_block_exercise prescription when absent.
CREATE TABLE set_prescription (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_exercise_id uuid NOT NULL REFERENCES workout_block_exercise(id) ON DELETE CASCADE,
  set_number        smallint NOT NULL CHECK (set_number > 0),
  reps_min          smallint,
  reps_max          smallint,
  duration_seconds  integer,
  distance_metres   integer,
  load_basis        load_basis,
  load_value        numeric(7,2),
  rest_after_seconds integer,
  is_warmup         boolean NOT NULL DEFAULT false,
  UNIQUE (block_exercise_id, set_number)
);

-- ----------------------------------------------------------------------------
-- 5. USERS, LOCATIONS & PER-USER EXERCISE VARIATIONS
-- ----------------------------------------------------------------------------

CREATE TABLE app_user (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext UNIQUE,
  display_name    text NOT NULL,
  date_of_birth   date,
  sex             text,                              -- free text / self-described
  height_cm       numeric(5,1),
  unit_preference unit_system NOT NULL DEFAULT 'metric',
  timezone        text NOT NULL DEFAULT 'UTC',
  fitness_level   difficulty_level NOT NULL DEFAULT 'beginner',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE programme ADD CONSTRAINT programme_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES app_user(id) ON DELETE SET NULL;
ALTER TABLE workout ADD CONSTRAINT workout_owner_fk
  FOREIGN KEY (owner_user_id) REFERENCES app_user(id) ON DELETE SET NULL;
ALTER TABLE media_asset ADD CONSTRAINT media_creator_fk
  FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE SET NULL;

-- Where a user trains; each location has its own equipment, enabling
-- "ad-hoc workout based on where I am right now".
CREATE TABLE user_location (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name          text NOT NULL,                       -- 'Home', 'Anytime Fitness', 'Hotel'
  location_type location_type NOT NULL DEFAULT 'home',
  is_default    boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, name)
);

CREATE UNIQUE INDEX user_location_one_default
  ON user_location (user_id) WHERE is_default;

CREATE TABLE user_location_equipment (
  location_id  uuid     NOT NULL REFERENCES user_location(id) ON DELETE CASCADE,
  equipment_id smallint NOT NULL REFERENCES equipment(id),
  detail       text,                                 -- 'dumbbells up to 24kg', 'resistance band: heavy'
  PRIMARY KEY (location_id, equipment_id)
);

-- USER-SPECIFIC EXERCISE VARIATIONS (core requirement):
-- per-exercise working targets ("lift 40kg on goblet squats",
-- "50 star jumps"), preferred substitutions and exclusions.
CREATE TABLE user_exercise_setting (
  user_id                 uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  exercise_id             uuid NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  target_weight_kg        numeric(6,2),
  target_reps             smallint,
  target_duration_seconds integer,
  target_distance_metres  integer,
  band_level              text,                      -- 'light' | 'medium' | 'heavy'
  preferred_variation_id  uuid REFERENCES exercise(id), -- always swap to this variant
  extra_rest_seconds      integer NOT NULL DEFAULT 0 CHECK (extra_rest_seconds >= 0),
  is_excluded             boolean NOT NULL DEFAULT false,
  excluded_reason         text,                      -- 'knee injury'
  notes                   text,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id)
);

-- 1RM / best-effort history used to resolve percent_1rm prescriptions.
CREATE TABLE user_exercise_max (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  metric       metric_type NOT NULL DEFAULT 'weight',
  value        numeric(8,2) NOT NULL,
  is_estimated boolean NOT NULL DEFAULT true,        -- estimated from rep maxes
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_exercise_max_lookup
  ON user_exercise_max (user_id, exercise_id, metric, recorded_at DESC);

-- ----------------------------------------------------------------------------
-- 6. ENROLLMENT & SMART SCHEDULING
-- ----------------------------------------------------------------------------

-- A user following a programme. Supports pause/resume at programme level.
CREATE TABLE user_programme (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  programme_id  uuid NOT NULL REFERENCES programme(id),
  status        enrollment_status NOT NULL DEFAULT 'active',
  started_on    date NOT NULL DEFAULT CURRENT_DATE,
  current_week  smallint NOT NULL DEFAULT 1,
  paused_on     date,
  completed_on  date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One active programme per user at a time.
CREATE UNIQUE INDEX user_programme_one_active
  ON user_programme (user_id) WHERE status = 'active';

-- Inputs to the scheduler: which days/times work, session length budget,
-- minimum recovery gap.
CREATE TABLE user_schedule_preference (
  user_id                  uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  available_days           smallint[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}', -- ISO dow
  preferred_time_of_day    text,                     -- 'morning' | 'lunch' | 'evening'
  max_session_minutes      smallint NOT NULL DEFAULT 60,
  min_rest_days_between_strength smallint NOT NULL DEFAULT 1,
  reminders_enabled        boolean NOT NULL DEFAULT true,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- A concrete (re)schedulable workout occurrence. The scheduler creates these
-- from programme_workout rows (or ad-hoc picks) and moves them when life
-- happens; rescheduled_from_id preserves the audit trail.
CREATE TABLE scheduled_workout (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  user_programme_id    uuid REFERENCES user_programme(id) ON DELETE CASCADE,
  programme_workout_id uuid REFERENCES programme_workout(id),
  workout_id           uuid NOT NULL REFERENCES workout(id),
  scheduled_date       date NOT NULL,
  window_start         time,                         -- optional time window
  window_end           time,
  status               schedule_status NOT NULL DEFAULT 'scheduled',
  auto_scheduled       boolean NOT NULL DEFAULT true,
  rescheduled_from_id  uuid REFERENCES scheduled_workout(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scheduled_workout_calendar
  ON scheduled_workout (user_id, scheduled_date)
  WHERE status IN ('scheduled', 'in_progress');

-- ----------------------------------------------------------------------------
-- 7. WORKOUT EXECUTION
-- A session is one attempt at a workout (scheduled or ad-hoc). Pause/resume is
-- captured in session_event; aggregate timers cached on the session row.
-- ----------------------------------------------------------------------------

CREATE TABLE workout_session (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  scheduled_workout_id uuid REFERENCES scheduled_workout(id),
  workout_id           uuid REFERENCES workout(id),  -- NULL only for freeform sessions
  location_id          uuid REFERENCES user_location(id),
  state                session_state NOT NULL DEFAULT 'in_progress',
  started_at           timestamptz NOT NULL DEFAULT now(),
  ended_at             timestamptz,
  active_seconds       integer NOT NULL DEFAULT 0,   -- excludes paused time
  paused_seconds       integer NOT NULL DEFAULT 0,
  calories_estimate    integer,
  perceived_exertion   smallint CHECK (perceived_exertion BETWEEN 1 AND 10),
  mood                 smallint CHECK (mood BETWEEN 1 AND 5),
  notes                text
);

CREATE INDEX workout_session_user_idx ON workout_session (user_id, started_at DESC);

-- Append-only event log: the source of truth for pause/resume, skips,
-- substitutions and rest compliance analytics.
CREATE TABLE session_event (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id  uuid NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
  event_type  session_event_type NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  exercise_id uuid REFERENCES exercise(id),
  payload     jsonb                                  -- e.g. {"substituted_with": "..."}
);

CREATE INDEX session_event_session_idx ON session_event (session_id, occurred_at);

-- What was actually performed. block_exercise_id links back to the plan;
-- NULL for ad-hoc additions mid-session.
CREATE TABLE exercise_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              uuid NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
  block_exercise_id       uuid REFERENCES workout_block_exercise(id),
  exercise_id             uuid NOT NULL REFERENCES exercise(id),
  substituted_for_id      uuid REFERENCES exercise(id), -- planned exercise if swapped
  sequence                smallint NOT NULL,
  started_at              timestamptz,
  completed_at            timestamptz,
  was_skipped             boolean NOT NULL DEFAULT false,
  skip_reason             text,
  UNIQUE (session_id, sequence)
);

CREATE TABLE set_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_log_id     uuid NOT NULL REFERENCES exercise_log(id) ON DELETE CASCADE,
  set_number          smallint NOT NULL CHECK (set_number > 0),
  reps                smallint,
  weight_kg           numeric(6,2),
  duration_seconds    integer,
  distance_metres     integer,
  rpe                 numeric(3,1) CHECK (rpe BETWEEN 1 AND 10),
  is_warmup           boolean NOT NULL DEFAULT false,
  completed           boolean NOT NULL DEFAULT true,
  rest_taken_seconds  integer,                       -- actual vs prescribed rest
  UNIQUE (exercise_log_id, set_number)
);

-- ----------------------------------------------------------------------------
-- 8. PROGRESS, GOALS, RECORDS & ACHIEVEMENTS
-- ----------------------------------------------------------------------------

CREATE TABLE body_measurement (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind        text NOT NULL,                         -- 'weight','body_fat','waist','chest',...
  value       numeric(7,2) NOT NULL,
  unit        text NOT NULL,                         -- 'kg','%','cm'
  measured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX body_measurement_series ON body_measurement (user_id, kind, measured_at DESC);

CREATE TABLE goal (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  goal_type    goal_type NOT NULL,
  title        text NOT NULL,
  exercise_id  uuid REFERENCES exercise(id),         -- for exercise_performance goals
  metric       metric_type,
  start_value  numeric(8,2),
  target_value numeric(8,2),
  unit         text,
  target_date  date,
  status       goal_status NOT NULL DEFAULT 'active',
  achieved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Time series towards a goal; usually derived from logs but can be manual.
CREATE TABLE goal_progress (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
  value       numeric(8,2) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL DEFAULT 'auto'           -- 'auto' | 'manual'
);

-- Best-ever marks, derived from set_log on session completion.
CREATE TABLE personal_record (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercise(id),
  metric      metric_type NOT NULL,                  -- weight, reps, duration, distance
  value       numeric(8,2) NOT NULL,
  set_log_id  uuid REFERENCES set_log(id) ON DELETE SET NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id, metric, achieved_at)
);

CREATE INDEX personal_record_best
  ON personal_record (user_id, exercise_id, metric, value DESC);

CREATE TABLE achievement (
  id       smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug     text NOT NULL UNIQUE,                     -- 'first-workout', '7-day-streak'
  name     text NOT NULL,
  blurb    text,
  criteria jsonb NOT NULL                            -- machine-readable rule
);

CREATE TABLE user_achievement (
  user_id        uuid     NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  achievement_id smallint NOT NULL REFERENCES achievement(id),
  earned_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

-- Cached streak counters (recomputed from sessions; cache for fast display).
CREATE TABLE user_streak (
  user_id           uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  current_streak    integer NOT NULL DEFAULT 0,      -- consecutive scheduled workouts done
  longest_streak    integer NOT NULL DEFAULT 0,
  last_workout_date date,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
