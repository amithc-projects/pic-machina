# Time-Ranged & Transitional Video Effects — UX Plan

## Context
Video effects currently apply uniformly to the entire video. The goal is to let users apply effects to specific time segments with smooth transitions in/out — e.g. blur fading away over the first 2 seconds, or a fade-to-black between seconds 5 and 6.

---

## UX Design

### Core Concept: Timeline Strip on Each Node

Rather than a separate timeline editor, each video effect node gains an optional **Time Range** section inline in the node editor. The existing node-stacking paradigm handles complex timelines naturally — users just add multiple nodes of the same effect with different ranges.

### Node Editor — Expanded View

When editing a video effect node, below existing parameters:

```
┌──────────────────────────────────────────────────┐
│  Blur Radius  ████████░░░░  45                   │
│                                                  │
│  ▼ TIME RANGE                                    │
│     ○ Full video  ● Custom range                 │
│                                                  │
│  [0:00] ════════════════════════════ [0:30]      │
│          ████████████████████████                │
│          ↑ start                ↑ end            │
│                                                  │
│  Fade in ──────  0.0 s                           │
│  Fade out ─────  2.0 s                           │
│  Easing ───────  [Linear ▾]                      │
└──────────────────────────────────────────────────┘
```

- The timeline bar shows the video's full duration
- Draggable handles set start/end time
- Text inputs allow precise values (accepts `s` seconds or `m:ss`)
- Fade in/out durations extend the gradient handles inward from the edges
- Easing: Linear, Ease In, Ease Out, Ease In-Out

**Fade semantics** (fade region is INSIDE the active range):
- `start: 0s, end: 4s, fadeOut: 2s` → full strength 0–2s, fades to nothing 2–4s
- `start: 5s, end: 6s, fadeIn: 1s` → fades in from 5–6s, full strength at 6s (then stays)

### Recipe Builder — Node Row Indicator

Each node row shows a mini read-only timeline when a custom range is set:

```
[≋] Blur          ▓▓▒▒░░░░░░░░░  0s→4s  fade out 2s
[◼] Fade to Black ░░░░░░░░░░░▒▓  5s→end fade in 1s
```
Grey = inactive, solid = full strength, gradient = transition.

### Composing Complex Timelines

Users stack nodes to build compound effects (no dedicated timeline editor needed):

**Scenario A** — "blur fades out over first 2 seconds":
```
Node 1: [Blur]  start: 0s  end: 2s  fadeIn: 0s  fadeOut: 2s
```

**Scenario B** — "unblurred for first 2s, then fade to black at 5–6s":
```
Node 1: (no effect — leave 0–2s alone)
Node 2: [Fade to Black]  start: 5s  end: 6s  fadeIn: 1s  fadeOut: 0s
```

---

## Data Model Extension

Add an optional `timeRange` object to the recipe node:

```javascript
{
  id: 'node-uuid',
  type: 'transform',
  transformId: 'video-blur',
  params: { blurRadius: 45 },
  timeRange: {            // NEW — omit for full-video behaviour (backwards compatible)
    start: 0,             // seconds from start (null = beginning)
    end: 4,               // seconds (null = end of video)
    fadeIn: 0,            // ramp-up duration in seconds (within range)
    fadeOut: 2,           // ramp-down duration in seconds (within range)
    easing: 'linear'      // 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  }
}
```

No existing nodes are affected (omitting `timeRange` = full-video as before).

---

## Processing — Strength Interpolation

In `video-convert.js`, the per-frame `process` callback gets the frame timestamp from the mediabunny `sample` object. Compute a `strength` value (0–1) based on position within the range and the easing curve.

Apply strength via canvas compositing — avoids having to modify each effect's parameters:

```javascript
const strength = computeStrength(currentTimeSeconds, timeRange);
if (strength <= 0) return; // skip effect
if (strength < 1) {
  // Save original, apply effect, blend original back at (1-strength)
  const orig = new OffscreenCanvas(w, h);
  orig.getContext('2d').drawImage(canvas, 0, 0);
  applyEffect(ctx);
  ctx.globalAlpha = 1 - strength;
  ctx.drawImage(orig, 0, 0);
  ctx.globalAlpha = 1;
} else {
  applyEffect(ctx); // full strength, no blending needed
}
```

---

## Critical Files

| File | Change |
|------|--------|
| `src/engine/video-convert.js` | Accept `timeRange` option; expose frame timestamp; compositing logic |
| `src/engine/processor.js` | Pass `node.timeRange` down to `processVideoEffect()` |
| `src/screens/ned.js` | Add Time Range UI section to video effect node editor |
| `src/screens/bld.js` | Add mini timeline indicator to node rows |
| `src/utils/param-fields.js` | Potentially add `time` input type (MM:SS) |

---

## Verification

1. Apply blur with `start: 0, end: 4, fadeOut: 2` — blur should be clear at t=0, absent at t=4
2. Apply fade-to-black with `start: 5, end: 6, fadeIn: 1` — should be normal at t=5, black at t=6
3. Existing node with no `timeRange` must process identically to current behaviour
4. Stacked nodes with overlapping time ranges should compose correctly
