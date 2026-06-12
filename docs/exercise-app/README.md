# Exercise App — Database Design & Exercise Library

Deliverables for the exercise app (programmes → workouts → exercises):

| File | What it is |
|---|---|
| [`data-model.md`](data-model.md) | Full database design: domain diagrams, design decisions, requirement mapping |
| [`schema.sql`](schema.sql) | Complete PostgreSQL DDL (~35 tables, validated on PostgreSQL 16) |
| [`exercise-database.md`](exercise-database.md) | Exercise library: sources, licences, coverage, seeding guide |
| [`data/exercises.json`](data/exercises.json) | 873 exercises from free-exercise-db (public domain) |
| [`data/supplemental-exercises.json`](data/supplemental-exercises.json) | 44 original HIIT/conditioning/mobility exercises |
| [`data/master-exercise-list.csv`](data/master-exercise-list.csv) | Combined, browsable index of all 917 exercises |
| [`scripts/build_seed_sql.py`](scripts/build_seed_sql.py) | Generates `seed_exercises.sql` + the master CSV from the JSON sources |
| [`seed_exercises.sql`](seed_exercises.sql) | Generated seed data — loads the full library into the schema |

Quick start:

```bash
createdb exercise_app
psql -d exercise_app -f schema.sql -f seed_exercises.sql
```
