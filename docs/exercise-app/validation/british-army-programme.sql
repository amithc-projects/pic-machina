-- ============================================================================
-- VALIDATION SEED: British Army "Soldier Prep" programme
-- Proves the programme -> workout -> block -> exercise model can express the
-- British Army fitness system end-to-end using only exercises already in the
-- library. Run after schema.sql + seed_exercises.sql.
-- ============================================================================
BEGIN;

INSERT INTO programme (slug, name, description, goal, level, duration_weeks,
                       workouts_per_week, visibility, status)
VALUES ('british-army-soldier-prep', 'British Army: Soldier Prep',
        'Representative two-week microcycle built on the British Army fitness system: RFT(E) test events (mid-thigh pull, seated medicine ball throw, 2 km run), loaded march, representative military tasks (casualty drag, carries), BMF-style field circuits, run intervals, strength work and recovery.',
        'event_prep', 'intermediate', 2, 5, 'system', 'published');

-- ---------------------------------------------------------------- workouts
INSERT INTO workout (slug, name, focus, level, est_duration_minutes, intensity, visibility, status) VALUES
('army-strength-lift',    'Strength & Lift Conditioning',      'strength',     'intermediate', 60, 7, 'system', 'published'),
('army-run-intervals',    '2 km Run Intervals',                'conditioning', 'intermediate', 40, 8, 'system', 'published'),
('army-bmf-circuit',      'BMF Field Circuit',                 'full body',    'intermediate', 45, 8, 'system', 'published'),
('army-loaded-march',     'Loaded March (Tab)',                'endurance',    'intermediate', 75, 6, 'system', 'published'),
('army-military-tasks',   'Representative Military Tasks',     'conditioning', 'intermediate', 45, 9, 'system', 'published'),
('army-rft-practice',     'RFT(E) Assessment Practice',        'assessment',   'intermediate', 40, 9, 'system', 'published'),
('army-recovery',         'Recovery & Mobility',               'recovery',     'beginner',     30, 2, 'system', 'published');

-- ------------------------------------------------- programme calendar
-- Week 1: training microcycle (day_of_week NULL = scheduler decides)
INSERT INTO programme_workout (programme_id, workout_id, week_number, sequence, is_optional)
SELECT p.id, w.id, x.wk, x.seq, x.opt
FROM programme p,
     (VALUES ('army-strength-lift', 1, 1, false),
             ('army-run-intervals', 1, 2, false),
             ('army-bmf-circuit',   1, 3, false),
             ('army-military-tasks',1, 4, false),
             ('army-loaded-march',  1, 5, false),
             ('army-run-intervals', 2, 1, false),
             ('army-recovery',      2, 2, false),
             ('army-rft-practice',  2, 3, false)
     ) AS x(wslug, wk, seq, opt)
JOIN workout w ON w.slug = x.wslug
WHERE p.slug = 'british-army-soldier-prep';

-- ============================================================ blocks + slots
-- Helper pattern: blocks are addressed by (workout slug, sequence).

-- ---- Workout 1: Strength & Lift Conditioning
INSERT INTO workout_block (workout_id, sequence, block_type, name, rounds)
SELECT id, 1, 'warmup', 'Pulse raiser & prep', NULL FROM workout WHERE slug='army-strength-lift';
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 2, 'straight_sets', 'Main lifts' FROM workout WHERE slug='army-strength-lift';
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 3, 'cooldown', 'Cooldown' FROM workout WHERE slug='army-strength-lift';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, sets, reps_min, reps_max, duration_seconds, distance_metres, load_basis, load_value, rest_after_seconds, note)
SELECT b.id, e.id, x.seq, x.sets, x.rmin, x.rmax, x.dur, x.dist, x.basis::load_basis, x.load, x.rest, x.note
FROM workout w
JOIN workout_block b ON b.workout_id = w.id AND b.sequence = 1,
LATERAL (VALUES
  ('jumping-jacks',            1, 1, NULL::int, NULL::int, 60,  NULL::int, 'bodyweight', NULL::numeric, 20,  NULL),
  ('world-s-greatest-stretch', 2, 1, NULL, NULL, 60,  NULL, 'bodyweight', NULL, 15,  'Both sides')
) AS x(eslug, seq, sets, rmin, rmax, dur, dist, basis, load, rest, note)
JOIN exercise e ON e.slug = x.eslug
WHERE w.slug='army-strength-lift';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, sets, reps_min, reps_max, duration_seconds, distance_metres, load_basis, load_value, rest_after_seconds, note)
SELECT b.id, e.id, x.seq, x.sets, x.rmin, x.rmax, x.dur, x.dist, x.basis::load_basis, x.load, x.rest, x.note
FROM workout w
JOIN workout_block b ON b.workout_id = w.id AND b.sequence = 2,
LATERAL (VALUES
  ('barbell-deadlift',                1, 4, 5,    5,    NULL::int, NULL::int, 'percent_1rm',  75::numeric, 150, NULL),
  ('isometric-mid-thigh-pull',        2, 3, NULL::int, NULL::int, 5, NULL, 'bodyweight',   NULL, 120, 'Maximal 5 s efforts — RFT(E) event'),
  ('standing-military-press',         3, 4, 6,    8,    NULL, NULL, 'user_setting', NULL, 120, NULL),
  ('weighted-pull-ups',               4, 4, 5,    8,    NULL, NULL, 'user_setting', NULL, 120, NULL),
  ('hyperextensions-back-extensions', 5, 3, 10,   12,   NULL, NULL, 'bodyweight',   NULL, 90,  'Dorsal raises'),
  ('farmer-s-walk',                   6, 3, NULL, NULL, NULL, 40,   'user_setting', NULL, 90,  NULL)
) AS x(eslug, seq, sets, rmin, rmax, dur, dist, basis, load, rest, note)
JOIN exercise e ON e.slug = x.eslug
WHERE w.slug='army-strength-lift';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, duration_seconds, load_basis, rest_after_seconds, note)
SELECT b.id, e.id, 1, 90, 'bodyweight', 0, 'Both sides'
FROM workout w
JOIN workout_block b ON b.workout_id = w.id AND b.sequence = 3
JOIN exercise e ON e.slug = 'couch-stretch'
WHERE w.slug='army-strength-lift';

-- ---- Workout 2: 2 km Run Intervals
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 1, 'warmup', '800 m warm-up jog' FROM workout WHERE slug='army-run-intervals';
INSERT INTO workout_block (workout_id, sequence, block_type, name, rounds, rest_between_rounds_seconds)
SELECT id, 2, 'interval', '6 x 400 m efforts', 6, 90 FROM workout WHERE slug='army-run-intervals';
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 3, 'cooldown', 'Cooldown stretches' FROM workout WHERE slug='army-run-intervals';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, distance_metres, load_basis, rest_after_seconds)
SELECT b.id, e.id, 1, 800, 'bodyweight', 60
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=1
JOIN exercise e ON e.slug='jogging-treadmill' WHERE w.slug='army-run-intervals';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, distance_metres, load_basis, rest_after_seconds, note)
SELECT b.id, e.id, 1, 400, 'bodyweight', 90, 'Hard effort, even splits — builds the 2 km RFT run'
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=2
JOIN exercise e ON e.slug='running-treadmill' WHERE w.slug='army-run-intervals';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, duration_seconds, load_basis, rest_after_seconds)
SELECT b.id, e.id, x.seq, x.dur, 'bodyweight', 10
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=3,
LATERAL (VALUES ('standing-hamstring-and-calf-stretch', 1, 60),
                ('cat-cow', 2, 60)) AS x(eslug, seq, dur)
JOIN exercise e ON e.slug=x.eslug
WHERE w.slug='army-run-intervals';

-- ---- Workout 3: BMF Field Circuit
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 1, 'warmup', 'Pulse raiser' FROM workout WHERE slug='army-bmf-circuit';
INSERT INTO workout_block (workout_id, sequence, block_type, name, rounds, rest_between_rounds_seconds)
SELECT id, 2, 'circuit', 'Field circuit', 3, 120 FROM workout WHERE slug='army-bmf-circuit';
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 3, 'cooldown', 'Cooldown' FROM workout WHERE slug='army-bmf-circuit';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, duration_seconds, load_basis, rest_after_seconds)
SELECT b.id, e.id, x.seq, x.dur, 'bodyweight', 15
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=1,
LATERAL (VALUES ('jumping-jacks', 1, 60), ('high-knees', 2, 45)) AS x(eslug, seq, dur)
JOIN exercise e ON e.slug=x.eslug
WHERE w.slug='army-bmf-circuit';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, reps_min, reps_max, duration_seconds, distance_metres, load_basis, rest_after_seconds)
SELECT b.id, e.id, x.seq, x.rmin, x.rmax, x.dur, x.dist, 'bodyweight', x.rest
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=2,
LATERAL (VALUES
  ('burpee',                   1, 12, 15, NULL::int, NULL::int, 45),
  ('pushups',                  2, 15, 20, NULL, NULL, 30),
  ('sit-up',                   3, 20, 25, NULL, NULL, 30),
  ('squat-thrust-half-burpee', 4, 12, 15, NULL, NULL, 30),
  ('bodyweight-squat',         5, 20, 25, NULL, NULL, 30),
  ('bodyweight-walking-lunge', 6, 16, 20, NULL, NULL, 30),
  ('bear-crawl',               7, NULL, NULL, NULL, 20, 45),
  ('mountain-climbers',        8, 24, 30, NULL, NULL, 30),
  ('dips-triceps-version',     9, 10, 15, NULL, NULL, 30),
  ('plank',                   10, NULL, NULL, 60, NULL, 60)
) AS x(eslug, seq, rmin, rmax, dur, dist, rest)
JOIN exercise e ON e.slug=x.eslug
WHERE w.slug='army-bmf-circuit';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, duration_seconds, load_basis, rest_after_seconds)
SELECT b.id, e.id, 1, 90, 'bodyweight', 0
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=3
JOIN exercise e ON e.slug='world-s-greatest-stretch' WHERE w.slug='army-bmf-circuit';

-- ---- Workout 4: Loaded March (Tab)
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 1, 'straight_sets', 'Tab' FROM workout WHERE slug='army-loaded-march';
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 2, 'cooldown', 'Lower-limb cooldown' FROM workout WHERE slug='army-loaded-march';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, duration_seconds, distance_metres, load_basis, load_value, rest_after_seconds, note)
SELECT b.id, e.id, 1, 3600, 6000, 'absolute', 20, 180, '20 kg bergen, 6 km in 60 min — progress weight/distance weekly toward test standard'
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=1
JOIN exercise e ON e.slug='loaded-march-tab' WHERE w.slug='army-loaded-march';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, duration_seconds, load_basis, rest_after_seconds)
SELECT b.id, e.id, x.seq, x.dur, 'bodyweight', 10
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=2,
LATERAL (VALUES ('standing-hamstring-and-calf-stretch', 1, 60),
                ('couch-stretch', 2, 90)) AS x(eslug, seq, dur)
JOIN exercise e ON e.slug=x.eslug
WHERE w.slug='army-loaded-march';

-- ---- Workout 5: Representative Military Tasks (RFT(S) elements)
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 1, 'warmup', 'Prep' FROM workout WHERE slug='army-military-tasks';
INSERT INTO workout_block (workout_id, sequence, block_type, name, rounds, rest_between_rounds_seconds)
SELECT id, 2, 'circuit', 'Military task circuit', 3, 180 FROM workout WHERE slug='army-military-tasks';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, distance_metres, load_basis, rest_after_seconds)
SELECT b.id, e.id, 1, 400, 'bodyweight', 60
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=1
JOIN exercise e ON e.slug='jogging-treadmill' WHERE w.slug='army-military-tasks';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, reps_min, reps_max, distance_metres, load_basis, load_value, rest_after_seconds, note)
SELECT b.id, e.id, x.seq, x.rmin, x.rmax, x.dist, x.basis::load_basis, x.load, x.rest, x.note
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=2,
LATERAL (VALUES
  ('casualty-drag',     1, NULL::int, NULL::int, 20,  'absolute',     70::numeric, 90,  'RFT(S): build toward 110 kg over 20 m'),
  ('jerry-can-carry',   2, NULL, NULL, 120, 'absolute',     20, 90,  'RFT(S) repeated carry: 2 x 20 kg'),
  ('sandbag-load',      3, 5, 8,       NULL, 'user_setting', NULL, 90, 'Vertical/incremental lift stand-in'),
  ('stretcher-carry',   4, NULL, NULL, 100, 'user_setting', NULL, 120, NULL),
  ('fireman-s-carry',   5, NULL, NULL, 20,  'user_setting', NULL, 120, NULL),
  ('shuttle-run',       6, NULL, NULL, 120, 'bodyweight',   NULL, 120, 'Fire & movement stand-in: 6 x 20 m')
) AS x(eslug, seq, rmin, rmax, dist, basis, load, rest, note)
JOIN exercise e ON e.slug=x.eslug
WHERE w.slug='army-military-tasks';

-- ---- Workout 6: RFT(E) Assessment Practice
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 1, 'straight_sets', 'Test events in test order' FROM workout WHERE slug='army-rft-practice';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, sets, duration_seconds, distance_metres, load_basis, rest_after_seconds, note)
SELECT b.id, e.id, x.seq, x.sets, x.dur, x.dist, x.basis::load_basis, x.rest, x.note
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=1,
LATERAL (VALUES
  ('isometric-mid-thigh-pull',         1, 3, 5,    NULL::int, 'bodyweight', 120, 'RFT(E) event 1: best of 3 maximal pulls'),
  ('seated-medicine-ball-power-throw', 2, 3, NULL, NULL,      'absolute',   90,  'RFT(E) event 2: 4 kg ball, best of 3'),
  ('running-treadmill',                3, 1, NULL, 2000,      'bodyweight', 300, 'RFT(E) event 3: 2 km best effort after 800 m warm-up')
) AS x(eslug, seq, sets, dur, dist, basis, rest, note)
JOIN exercise e ON e.slug=x.eslug
WHERE w.slug='army-rft-practice';

-- ---- Workout 7: Recovery & Mobility
INSERT INTO workout_block (workout_id, sequence, block_type, name)
SELECT id, 1, 'cooldown', 'Recovery flow' FROM workout WHERE slug='army-recovery';

INSERT INTO workout_block_exercise (block_id, exercise_id, sequence, duration_seconds, load_basis, rest_after_seconds, note)
SELECT b.id, e.id, x.seq, x.dur, 'bodyweight', 10, x.note
FROM workout w JOIN workout_block b ON b.workout_id=w.id AND b.sequence=1,
LATERAL (VALUES
  ('cat-cow',                                   1, 60,  NULL),
  ('downward-facing-dog-adho-mukha-svanasana',  2, 60,  NULL),
  ('pigeon-pose-eka-pada-rajakapotasana',       3, 120, 'Both sides'),
  ('world-s-greatest-stretch',                  4, 90,  'Both sides'),
  ('dead-body-pose-savasana',                   5, 300, NULL)
) AS x(eslug, seq, dur, note)
JOIN exercise e ON e.slug=x.eslug
WHERE w.slug='army-recovery';

COMMIT;

-- ---------------------------------------------------------------- checks
-- Every block must have slots; every slot must have resolved an exercise.
SELECT 'workouts' AS entity, count(*) FROM workout WHERE slug LIKE 'army-%'
UNION ALL SELECT 'programme_workouts', count(*) FROM programme_workout pw
  JOIN programme p ON p.id = pw.programme_id WHERE p.slug='british-army-soldier-prep'
UNION ALL SELECT 'blocks', count(*) FROM workout_block b
  JOIN workout w ON w.id=b.workout_id WHERE w.slug LIKE 'army-%'
UNION ALL SELECT 'block_exercises', count(*) FROM workout_block_exercise be
  JOIN workout_block b ON b.id=be.block_id
  JOIN workout w ON w.id=b.workout_id WHERE w.slug LIKE 'army-%'
UNION ALL SELECT 'EMPTY BLOCKS (must be 0)', count(*) FROM workout_block b
  JOIN workout w ON w.id=b.workout_id
  LEFT JOIN workout_block_exercise be ON be.block_id=b.id
  WHERE w.slug LIKE 'army-%' AND be.id IS NULL;
