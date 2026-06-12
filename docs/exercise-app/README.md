# Exercise App — Database Design & Exercise Library

Deliverables for the exercise app (programmes → workouts → exercises):

| File | What it is |
|---|---|
| [`data-model.md`](data-model.md) | Full database design: domain diagrams, design decisions, requirement mapping |
| [`schema.sql`](schema.sql) | Complete PostgreSQL DDL (~35 tables, validated on PostgreSQL 16) |
| [`exercise-database.md`](exercise-database.md) | Exercise library: sources, licences, coverage, seeding guide |
| [`media-prompts.md`](media-prompts.md) | AI image/video prompt system: global style block, composition rules, test examples |
| [`data/media-prompts.json`](data/media-prompts.json) | Generated prompts for all 978 exercises (2 image keyframes + second-by-second 8s video each) |
| [`data/curated-media-prompts.json`](data/curated-media-prompts.json) | Hand-written premium prompts (merged over the generated set) |
| [`scripts/build_media_prompts.py`](scripts/build_media_prompts.py) | Generates `media-prompts.json` + `seed_media_prompts.sql` |
| [`seed_media_prompts.sql`](seed_media_prompts.sql) | Generated seed — loads prompts into `exercise_media_prompt` |
| [`data/exercises.json`](data/exercises.json) | 873 exercises from free-exercise-db (public domain) |
| [`data/supplemental-exercises.json`](data/supplemental-exercises.json) | 44 original HIIT/conditioning/mobility exercises |
| [`data/yoga-stretch-exercises.json`](data/yoga-stretch-exercises.json) | 54 original yoga poses (Bikram 26 + other traditions) and additional stretches |
| [`data/military-exercises.json`](data/military-exercises.json) | 7 military test/task exercises (loaded march, casualty drag, mid-thigh pull, …) |
| [`validation/british-army-coverage.md`](validation/british-army-coverage.md) | Validation: British Army programme coverage report (PASS) |
| [`validation/british-army-programme.sql`](validation/british-army-programme.sql) | Demo seed: full Army Soldier Prep programme built in the schema |
| [`data/master-exercise-list.csv`](data/master-exercise-list.csv) | Combined, browsable index of all 978 exercises |
| [`scripts/build_seed_sql.py`](scripts/build_seed_sql.py) | Generates `seed_exercises.sql` + the master CSV from the JSON sources |
| [`seed_exercises.sql`](seed_exercises.sql) | Generated seed data — loads the full library into the schema |

Quick start:

```bash
createdb exercise_app
psql -d exercise_app -f schema.sql -f seed_exercises.sql -f seed_media_prompts.sql
```
