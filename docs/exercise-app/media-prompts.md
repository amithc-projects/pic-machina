# AI Media Generation Prompts

Every exercise has style-agnostic generation prompts for its thumbnail images
and 8-second loopable video. Full set: [`data/media-prompts.json`](data/media-prompts.json)
(978 exercises), loadable into the `exercise_media_prompt` table via
[`seed_media_prompts.sql`](seed_media_prompts.sql). Regenerate both with
[`scripts/build_media_prompts.py`](scripts/build_media_prompts.py).

## What is stored per exercise

| Variant | What it is |
|---|---|
| `image/pose_a`, `image/pose_b` | Two keyframes at **recognisable points in the movement** (deliberately not the resting start position) — use B alone as the thumbnail or composite A+B |
| `video/loop_8s` | One 8-second seamless loop, broken down **second by second** (beats `"0"`–`"7"`; beat 7 always closes back to the first frame) |
| `video/part_1`, `video/part_2` | Only for the 58 movements with long step sequences — two clips designed to be stitched: part 1 ends where part 2 starts, part 2 ends on part 1's first frame |

Each row also carries a `camera` directive (framing/angle chosen per exercise:
floor work gets a low side-on camera, hinges/squats a side-on camera, the rest
three-quarter front).

Five exercises have hand-curated premium prompts (`is_curated = true`):
burpee, jumping jacks, two-hand kettlebell swing, dumbbell thruster, push-ups
— kept in [`data/curated-media-prompts.json`](data/curated-media-prompts.json),
which the generator merges over the bulk set. **This file is the upgrade
path**: as you refine prompts exercise by exercise, add them here and rerun
the script.

## The global style block (stored once, not per prompt)

The shared look lives in app config (or a `media_style` config row), never in
the prompt rows. Composition at call time:

```
IMAGE  = STYLE + ". " + camera + ". " + prompt + ". " + IMAGE_CONSTRAINTS
VIDEO  = STYLE + ". " + camera + ". " + prompt
         + " Second-by-second: " + beats joined as "0-1s: ...; 1-2s: ...; ..."
         + ". " + VIDEO_CONSTRAINTS
```

Working defaults to start testing with:

```text
STYLE:
young attractive athletic woman with dark hair in a high ponytail, wearing
pink leggings and a matching pink sports bra top, in a dark empty industrial
studio with polished concrete floor, dramatic cinematic lighting with soft
rim light, shallow haze in the background, photorealistic, 8k detail

IMAGE_CONSTRAINTS:
sharp focus, anatomically correct, exactly one person, no text, no watermark,
no mirrors, no gym equipment other than what is described

VIDEO_CONSTRAINTS:
one continuous locked-off shot, no cuts, no camera motion, no slow motion,
constant lighting, exactly one person, the last frame matches the first frame
```

Keep wardrobe/hair details **specific and stable** — they are what makes 917
clips look like one library. Aspect ratios are also call-time config:
suggested 1:1 or 4:3 for thumbnails, 9:16 for in-workout video.

## Ready-to-paste test examples

### Image test 1 — Burpee, pose B (the airborne jump)

```text
young attractive athletic woman with dark hair in a high ponytail, wearing
pink leggings and a matching pink sports bra top, in a dark empty industrial
studio with polished concrete floor, dramatic cinematic lighting with soft rim
light, shallow haze in the background, photorealistic, 8k detail. Side-on
camera, full body in frame, wide enough to show floor and air space above her
head. Full-body action photo of the athlete at the peak of the burpee jump:
fully airborne 30 cm off the floor, body stretched tall, arms reaching
straight overhead with fingers extended, toes pointed, slight motion energy in
her hair. Sharp focus, anatomically correct, exactly one person, no text, no
watermark, no mirrors, no gym equipment other than what is described.
```

### Image test 2 — Two-Hand Kettlebell Swing, pose B (the loaded hinge)

```text
young attractive athletic woman with dark hair in a high ponytail, wearing
pink leggings and a matching pink sports bra top, in a dark empty industrial
studio with polished concrete floor, dramatic cinematic lighting with soft rim
light, shallow haze in the background, photorealistic, 8k detail. Side-on
camera, full body in frame, kettlebell path fully visible. Full-body action
photo of the athlete frozen at the bottom of a kettlebell swing: hips hinged
deep with a flat back, a dark cast-iron kettlebell swung back between and
slightly behind her legs, shins vertical, eyes forward, loaded like a spring.
Sharp focus, anatomically correct, exactly one person, no text, no watermark,
no mirrors, no gym equipment other than what is described.
```

### Video test 1 — Jumping Jacks (8s, 4 reps, seamless loop)

```text
young attractive athletic woman with dark hair in a high ponytail, wearing
pink leggings and a matching pink sports bra top, in a dark empty industrial
studio with polished concrete floor, dramatic cinematic lighting with soft rim
light, shallow haze in the background, photorealistic. Locked-off straight-on
front camera, full body in frame, perfectly centred, no cuts, no camera
movement. 8-second seamless loop: exactly four full jumping jacks at a bright
steady rhythm, one rep every 2 seconds, starting and ending feet-together with
arms at her sides. Second-by-second: 0-1s: from standing with feet together
and arms at her sides, she jumps her feet out wide while her arms sweep
overhead into a star shape; 1-2s: she jumps her feet back together as her arms
swing down to her sides, landing lightly on the balls of her feet; 2-3s:
second rep, feet jump out wide, arms sweep overhead, light and rhythmic; 3-4s:
feet snap back together, arms return to her sides, posture tall; 4-5s: third
rep, out wide with arms overhead, hair showing gentle bounce energy; 5-6s:
back together, arms to sides, steady rhythm; 6-7s: fourth rep, feet out wide,
arms sweeping fully overhead one last time; 7-8s: she lands back with feet
together and arms at her sides in exactly the same pose as the first frame so
the clip loops seamlessly. One continuous shot, constant lighting, exactly one
person, the last frame matches the first frame.
```

### Video test 2 — Burpee (8s, 2 reps, seamless loop)

```text
young attractive athletic woman with dark hair in a high ponytail, wearing
pink leggings and a matching pink sports bra top, in a dark empty industrial
studio with polished concrete floor, dramatic cinematic lighting with soft rim
light, shallow haze in the background, photorealistic. Locked-off side-on
camera, full body always in frame with headroom for the jump, no cuts, no
camera movement. 8-second seamless loop: exactly two full burpee reps at a
steady athletic pace, one rep every 4 seconds, ending in the identical
standing position the clip starts in. Second-by-second: 0-1s: she stands tall,
feet shoulder-width apart, then crouches and plants both hands on the floor
just inside her feet; 1-2s: she jumps her feet back into a high plank and
lowers her chest to the floor in one fluid push-up descent; 2-3s: she presses
powerfully back up to plank and snaps her feet forward to land just behind her
hands; 3-4s: she explodes upward into a vertical jump, arms sweeping straight
overhead, then lands softly with bent knees back into standing; 4-5s: without
pausing she crouches again and plants both hands on the floor, beginning the
second identical rep; 5-6s: feet jump back to plank, chest lowers to the floor
in the same smooth push-up; 6-7s: she presses up and snaps her feet forward to
her hands, loading the legs; 7-8s: she jumps vertically with arms overhead and
lands softly, finishing standing tall in exactly the same pose and position as
the first frame so the clip loops seamlessly. One continuous shot, constant
lighting, exactly one person, the last frame matches the first frame.
```

## Practical generation notes

- **Images first, then video.** Generate pose A/B stills, pick the best, and
  use them as start/end reference frames if your video model supports
  image-conditioning — this is the single biggest consistency win.
- **Loopability**: beat 7 in every prompt explicitly returns to the frame-0
  pose. If a model ignores it, generate 9s and crossfade the last second over
  the first, or use the part_1/part_2 stitch.
- **Character consistency across 917 clips** is the hard problem. Lock a seed
  / character reference image if the tool supports it, and consider generating
  one canonical "hero" image of the athlete first and feeding it to every call.
- The bulk-generated prompts quote the exercise's instruction text verbatim
  ("frozen at the moment described as: …"), which modern image/video models
  follow well. Expect to promote the highest-traffic exercises into the
  curated file over time.
