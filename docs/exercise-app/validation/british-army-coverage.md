# Validation: British Army Fitness Programme Coverage

**Result: PASS.** Every element of the British Army fitness system maps to an
exercise in the library, and a representative programme
([`british-army-programme.sql`](british-army-programme.sql)) was constructed
end-to-end in the schema and loaded against PostgreSQL 16: 1 programme,
7 workouts, 15 blocks, 44 prescription slots — all resolved, no empty blocks.

Seven military-specific exercises were added to close gaps found during
validation (`data/military-exercises.json`); everything else already existed.

## Requirement → library mapping

### Role Fitness Test (Entry) — RFT(E)

| Test event | Library exercise | Status |
|---|---|---|
| Mid-Thigh Pull (5 s maximal isometric) | `isometric-mid-thigh-pull` | **added** |
| Seated Medicine Ball Throw (4 kg) | `seated-medicine-ball-power-throw` | **added** |
| 2 km best-effort run (after 800 m warm-up) | `running-treadmill` / outdoor running entries | existing |

### RFT (Basic Training) and RFT (Soldier) task elements

| Test element | Library exercise | Status |
|---|---|---|
| Loaded march / loaded carriage (tab) | `loaded-march-tab` | **added** |
| Casualty drag (110 kg, 20 m) | `casualty-drag` | **added** |
| Repeated carry (2 × 20 kg water/jerry cans) | `jerry-can-carry` (alt: `farmer-s-walk`, `suitcase-carry`) | **added** |
| Stretcher carry | `stretcher-carry` | **added** |
| Vertical / incremental lift | `sandbag-load` (alt: `sandbag-shouldering`) | existing |
| Tactical movement / fire & movement | `shuttle-run` + `sprawl` + `bear-crawl` + `wind-sprints` | existing |
| Multi-Stage Fitness Test (beep test) | `shuttle-run` (20 m, progressive pace) | existing |

### Training-plan staples (100% Army Fit / Army Ready / PT sessions)

| Element | Library exercise(s) |
|---|---|
| Press-ups (2 min cadence) | `pushups` + 9 variants |
| Sit-ups (2 min cadence) | `sit-up`, `crunches`, plus 90+ core exercises |
| Heaves / pull-ups | `pullups`, `chin-up`, `weighted-pull-ups` + 6 more |
| Dips | `dips-triceps-version`, `bench-dips`, `dip-machine` |
| Dorsal raises | `hyperextensions-back-extensions`, `superman` |
| Squats, lunges, step-ups | `bodyweight-squat`, `bodyweight-walking-lunge`, `barbell-step-ups`, … |
| Strength lifts | full barbell/dumbbell catalogue (deadlift, press, rows, …) |
| Run intervals, hill/stair sprints | `wind-sprints`, `hill-sprint`, `stair-run`, treadmill/track entries |
| Swimming (military swim test prep) | `swimming-freestyle` |
| Fireman's carry (buddy carries) | `firemans-carry` — **added** |
| Rope climb (assault course) | `rope-climb` |
| Warm-up / cooldown content | 128 stretches + 45 yoga + 9 mobility drills |

### BMF / Be Military Fit class format

Outdoor bodyweight circuits — fully covered: `burpee`, `squat-thrust-half-burpee`,
`jumping-jacks`, `high-knees`, `bear-crawl`, `crab-walk`, `sprawl`,
`mountain-climbers`, `plank` family, `shuttle-run`, partner carries. The
`circuit` block type with `rounds` + `rest_between_rounds_seconds` expresses
the class structure directly.

## Schema capabilities exercised by the build

- `percent_1rm` load on deadlifts; `absolute` load on the bergen (20 kg) and
  casualty drag; `user_setting` elsewhere — all three load bases in one programme.
- Distance prescriptions (400 m repeats, 6 km tab, 20 m drags) alongside
  rep ranges and timed holds in the same tables.
- `interval`, `circuit`, `straight_sets`, `warmup`, `cooldown` block types.
- Flexible scheduling: all `programme_workout.day_of_week` left NULL for the
  smart scheduler.
- Test-event notes carried on prescriptions (e.g. "best of 3 maximal pulls").

## How to run

```bash
psql -d exercise_app -f schema.sql -f seed_exercises.sql \
     -f validation/british-army-programme.sql
# final query must report EMPTY BLOCKS = 0
```

## Sources

- [British Army: Physical Employment Standards](https://www.army.mod.uk/army-careers/careers/entry-requirements-and-standards/physical-employment-standards/)
- [British Army: Fitness requirements](https://jobs.army.mod.uk/how-to-join/can-i-apply/fitness/)
- [Fit to Fight — the Role Fitness Test (Entry) (Army PDF)](https://www.army.mod.uk/media/8240/fit-to-fight-the-new-role-fitness-test-e.pdf)
- [Forces News: British Army fitness standards explained](https://www.forcesnews.com/services/army/all-you-need-know-about-britishs-armys-fitness-standards)
- [100% Army Fit app launch](https://www.forcesnews.com/services/army/100-army-fit-app-launches)
