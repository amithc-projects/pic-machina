#!/usr/bin/env python3
"""Generate AI media-generation prompts for every exercise.

For each exercise:
  image  -> two keyframe prompts (pose_a, pose_b) at two RECOGNISABLE points
            in the movement (never just the resting start position)
  video  -> one 8-second seamless-loop prompt broken down second by second
            (beats "0".."7"); exercises with long step sequences also get
            part_1 / part_2 variants intended to be stitched together.

Prompts are STYLE-AGNOSTIC. The shared global style block (model, wardrobe,
set, lighting) is prepended by the caller at generation time — see
media-prompts.md.

Hand-written prompts in data/curated-media-prompts.json override the
generated ones and are flagged is_curated.

Reads:
  data/exercises.json, data/supplemental-exercises.json,
  data/yoga-stretch-exercises.json,
  data/curated-media-prompts.json
Writes:
  data/media-prompts.json
  seed_media_prompts.sql   (loads into exercise_media_prompt)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EQUIPMENT_PHRASE = {
    "barbell": " with a loaded barbell",
    "dumbbell": " with dumbbells",
    "kettlebells": " with a cast-iron kettlebell",
    "e-z curl bar": " with an EZ curl bar",
    "cable": " at a cable machine",
    "machine": " on a gym machine",
    "bands": " with a resistance band",
    "medicine ball": " with a medicine ball",
    "exercise ball": " with a large exercise ball",
    "foam roll": " with a foam roller",
    "battle ropes": " with heavy battle ropes anchored in front of her",
    "jump rope": " with a speed jump rope",
    "plyo box": " with a sturdy plyo box",
    "sled": " with a weighted training sled",
    "sandbag": " with a heavy training sandbag",
    "agility ladder": " on a flat agility ladder",
    "air bike": " on an air assault bike",
    "rowing machine": " on a rowing ergometer",
    "ski erg": " on a ski erg machine",
    "body only": ", bodyweight only, no equipment",
    "other": "",
}

FLOOR_WORDS = re.compile(
    r"\b(lie|lying|plank|crawl|bridge|floor|supine|prone|seated|sit |kneel|all fours|crunch)\b", re.I)
SIDE_WORDS = re.compile(
    r"\b(hinge|deadlift|swing|squat|row|lunge|bend|jump|hop|bound|step)\b", re.I)


def camera_for(ex) -> str:
    text = ex["name"] + " " + " ".join(ex.get("instructions", [])[:2])
    if FLOOR_WORDS.search(text):
        return "low side-on camera at floor level, full body in frame"
    if SIDE_WORDS.search(text):
        return "side-on camera, full body in frame with headroom"
    return "three-quarter front camera, full body in frame"


def clean(step: str) -> str:
    return step.strip().rstrip(".")


def image_prompts(ex, equip):
    """Two distinct, recognisable keyframes. Skip the bare starting position
    where the step list allows it."""
    steps = [clean(s) for s in ex.get("instructions", []) if s.strip()]
    name = ex["name"]
    if not steps:
        a = f"at the most visually recognisable mid-point of the movement"
        b = f"at the finishing position of the movement"
    elif len(steps) == 1:
        a = f'mid-movement, at the moment described as: "{steps[0]}"'
        b = f'at the end range of the moment described as: "{steps[0]}"'
    else:
        idx_a = max(1, len(steps) // 3) if len(steps) > 2 else 0
        idx_b = min(len(steps) - 1, max(idx_a + 1, (2 * len(steps)) // 3))
        a = f'frozen at the moment described as: "{steps[idx_a]}"'
        b = f'frozen at the moment described as: "{steps[idx_b]}"'
    base = (f"full-body action photo of the athlete performing {name}{equip}, "
            "{moment} — textbook exercise form, the pose clearly recognisable "
            f"as {name}, sharp focus on body position")
    return base.replace("{moment}", a), base.replace("{moment}", b)


def video_beats(steps, loop_target="the exact position and pose of second 0"):
    """Distribute execution steps across seconds 0-6; second 7 closes the loop."""
    beats = {}
    n = len(steps)
    if n == 0:
        for s in range(7):
            beats[str(s)] = "She performs the movement with smooth, controlled form."
    else:
        # starting second for each step, spread over 7 seconds
        starts = [round(i * 7 / n) for i in range(n)]
        current = "She moves into position with controlled form."
        for sec in range(7):
            if sec in starts:
                current = f'{clean(steps[starts.index(sec)])}.'
            elif sec > 0:
                current = "The same phase of the movement continues smoothly."
            beats[str(sec)] = current
    beats["7"] = (f"She returns to {loop_target} so the clip loops seamlessly.")
    return beats


def video_prompt(ex, equip, camera):
    return (f"8-second seamless loopable video of the athlete performing "
            f"{ex['name']}{equip}. {camera}. One continuous locked-off take, "
            "no cuts, no camera movement, steady natural rhythm; the final "
            "frame must match the first frame exactly so the clip loops.")


def main():
    base = json.loads((ROOT / "data" / "exercises.json").read_text())
    extra = json.loads((ROOT / "data" / "supplemental-exercises.json").read_text())
    extra += json.loads((ROOT / "data" / "yoga-stretch-exercises.json").read_text())
    curated = json.loads((ROOT / "data" / "curated-media-prompts.json").read_text())
    curated.pop("_comment", None)

    def slugify(text):
        s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
        return re.sub(r"-{2,}", "-", s)

    seen, out = set(), {}
    for ex in base + extra:
        slug = slugify(ex["name"])
        if slug in seen:
            continue
        seen.add(slug)
        equip = EQUIPMENT_PHRASE.get(ex.get("equipment") or "other", "")
        camera = camera_for(ex)
        steps = [s for s in ex.get("instructions", []) if s.strip()]

        cur = curated.get(slug)
        if cur:
            entry = {
                "name": ex["name"],
                "curated": True,
                "image": {
                    "camera": cur["image"]["camera"],
                    "pose_a": cur["image"]["pose_a"],
                    "pose_b": cur["image"]["pose_b"],
                },
                "video": {
                    "loop_8s": {
                        "camera": cur["video"]["camera"],
                        "prompt": cur["video"]["summary"],
                        "beats": cur["video"]["beats"],
                    }
                },
            }
        else:
            pa, pb = image_prompts(ex, equip)
            entry = {
                "name": ex["name"],
                "curated": False,
                "image": {"camera": camera, "pose_a": pa, "pose_b": pb},
                "video": {
                    "loop_8s": {
                        "camera": camera,
                        "prompt": video_prompt(ex, equip, camera),
                        "beats": video_beats(steps),
                    }
                },
            }
            # long sequences: also offer a stitchable two-part breakdown
            if len(steps) >= 7:
                half = (len(steps) + 1) // 2
                entry["video"]["part_1"] = {
                    "camera": camera,
                    "prompt": video_prompt(ex, equip, camera).replace(
                        "seamless loopable video", "video (part 1 of 2, to be stitched)"),
                    "beats": video_beats(
                        steps[:half],
                        loop_target="a stable hold of the part-1 end position, "
                                    "matching the first frame of part 2"),
                }
                entry["video"]["part_2"] = {
                    "camera": camera,
                    "prompt": video_prompt(ex, equip, camera).replace(
                        "seamless loopable video", "video (part 2 of 2, to be stitched)"),
                    "beats": video_beats(steps[half:]),
                }
        out[slug] = entry

    (ROOT / "data" / "media-prompts.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False))
    n_video_parts = sum(1 for e in out.values() if "part_1" in e["video"])
    print(f"media-prompts.json: {len(out)} exercises "
          f"({sum(1 for e in out.values() if e['curated'])} curated, "
          f"{n_video_parts} with two-part videos)")

    def q(s):
        return "'" + str(s).replace("'", "''") + "'"

    sql = ["-- Generated by scripts/build_media_prompts.py — do not edit by hand.",
           "BEGIN;", ""]
    for slug, e in out.items():
        cur = str(e["curated"]).lower()
        for variant, prompt in (("pose_a", e["image"]["pose_a"]),
                                ("pose_b", e["image"]["pose_b"])):
            sql.append(
                "INSERT INTO exercise_media_prompt (exercise_id, target, variant, camera, prompt, is_curated) "
                f"SELECT id, 'image', {q(variant)}, {q(e['image']['camera'])}, {q(prompt)}, {cur} "
                f"FROM exercise WHERE slug = {q(slug)};")
        for variant, v in e["video"].items():
            sql.append(
                "INSERT INTO exercise_media_prompt (exercise_id, target, variant, camera, prompt, beats, is_curated) "
                f"SELECT id, 'video', {q(variant)}, {q(v['camera'])}, {q(v['prompt'])}, "
                f"{q(json.dumps(v['beats']))}::jsonb, {cur} "
                f"FROM exercise WHERE slug = {q(slug)};")
    sql += ["", "COMMIT;", ""]
    (ROOT / "seed_media_prompts.sql").write_text("\n".join(sql))
    print("seed_media_prompts.sql written")


if __name__ == "__main__":
    main()
