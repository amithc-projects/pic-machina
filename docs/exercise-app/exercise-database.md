# Exercise App — Master Exercise Database

**978 exercises**, ready to seed the schema in [`schema.sql`](schema.sql).
Browse the combined index in
[`data/master-exercise-list.csv`](data/master-exercise-list.csv).

## Sources

| Source | Count | Licence | Notes |
|---|---|---|---|
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | 873 | **Unlicense (public domain)** | `data/exercises.json` — name, category, level, force, mechanic, equipment, primary/secondary muscles, step-by-step instructions, reference photos |
| Original supplement | 44 | Ours | `data/supplemental-exercises.json` — HIIT/conditioning/mobility staples missing from the base set |
| Yoga & stretching pack | 54 | Ours | `data/yoga-stretch-exercises.json` — the full Bikram 26 sequence, 19 foundational poses from other yoga traditions (Wheel, Dancer's, the Warriors, Pigeon, Crow, …), and 9 stretches/mobility drills not covered by the base set |
| Military pack | 7 | Ours | `data/military-exercises.json` — British Army test events and tasks: loaded march, casualty drag, jerry can/stretcher/fireman's carries, isometric mid-thigh pull, seated medicine ball power throw |

free-exercise-db was chosen as the base because it is genuinely public domain
(no attribution or share-alike obligations), unlike the other large open
datasets ([wger](https://github.com/wger-project/wger) is CC-BY-SA 4.0 —
usable commercially but share-alike on derivatives;
[everkinetic](https://github.com/everkinetic/data) and
[exercemus](https://github.com/exercemus/exercises) are smaller or derived
from the same roots). Since all video/thumbnail content will be original
anyway, the public-domain text dataset is the cleanest foundation.

## Coverage

| Modality | Count |
|---|---|
| strength | 590 |
| stretching | 128 |
| plyometrics | 64 |
| yoga | 45 |
| powerlifting | 38 |
| olympic_weightlifting | 35 |
| cardio | 27 |
| strongman | 22 |
| hiit | 13 |
| mobility | 9 |

17 muscle groups, 21 equipment types, 4,212 instruction steps (109 of them
dedicated setup steps from the original packs).

The 44 supplemental exercises fill the base set's HIIT/conditioning gap:
burpee, squat thrust, sprawl, jumping jacks, high knees, butt kicks, skater
jumps, jump lunges, plank jacks, shoulder taps, bear/crab crawls, wall sit,
wall balls, battle-rope waves & slams, sled drag, dumbbell thruster, devil
press, man maker, two-hand kettlebell swing, double unders, assault-bike /
rowing intervals, ski erg, box step-overs, agility ladder, sandbag
shouldering, suitcase carry, swimming, shadow boxing, hill/stair sprints,
shuttle runs, plus a mobility block (world-class warmup staples: 90/90,
cat-cow, open book, couch stretch, down-dog flow, bird dog, hollow hold,
V-up). Each has setup steps, execution steps, muscles, equipment and a
recommended rest period, in the same JSON shape as the base set.

## Seeding

```bash
python3 scripts/build_seed_sql.py        # regenerates seed_exercises.sql + master CSV
psql -d exercise_app -f schema.sql -f seed_exercises.sql
```

The generator:

- merges both JSON files and de-duplicates by slug;
- maps source categories to the `exercise_modality` enum;
- creates `body_part` and `equipment` reference rows;
- splits instructions into `setup` / `execution` phases;
- assigns tracked metrics per exercise (e.g. strength → reps+weight,
  cardio → duration+distance+calories, static holds → duration);
- assigns mandatory/default rest periods (explicit `restSeconds` in the
  supplement; sensible per-modality defaults for the base set — tune freely).

Validated end-to-end against PostgreSQL 16: schema + all 917 exercises load
with zero errors.

## Still to curate (content work, not schema work)

- **Media**: every exercise needs an original thumbnail + video
  (`media_asset` rows). The base dataset ships reference photos useful as
  shot-list guides.
- **Relationships**: progression/regression/alternative edges
  (`exercise_relationship`) — highest-value next dataset to author, as it
  powers substitutions and difficulty scaling.
- **Tags**: `low-impact`, `no-jumping`, `apartment-friendly`, `travel`, etc.
- **Rest tuning**: review per-exercise rest defaults with a coach.
