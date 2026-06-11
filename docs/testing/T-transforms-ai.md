# Transform Tests — AI & Composition + Audio AI

**Reference prefix**: `TR-AI-`  
**Source files**: `src/engine/transforms/ai.js`, `src/engine/transforms/ai/diarize.js`, `src/engine/transforms/ai/translate.js`, audio transforms in `flow.js`  
**Total transforms**: 24

## Important Notes

1. **All AI transforms require models** — they carry a `requires` array. Tests check both the "model present" and "model absent" paths.
2. **Tier 2 no-crash tests** mock the model and AI library so they run fast in CI.
3. **Tier 4 golden image tests** require the real downloaded model and run only before releases.
4. **Tier 5 manual tests** are used for quality judgment — does the AI output look good?
5. The InSPyReNet model (`inspyrenet-swinb-fp16`) is shared by all subject-matting transforms.

---

## TR-AI-001 — ai-remove-bg: Registration
- **Tier**: 1
- **Steps**: `registry.get("ai-remove-bg")`
- **Expected Result**: Registered; `requires` includes `inspyrenet-swinb-fp16`; params include `feather` and `threshold`

## TR-AI-002 — ai-remove-bg: No-crash when model not downloaded
- **Tier**: 2
- **Dependencies**: Mock `getModelRecord("inspyrenet-swinb-fp16")` → returns `null`
- **Test Data**: 100×100 canvas
- **Steps**: Apply `ai-remove-bg`
- **Expected Result**: No uncaught exception thrown; canvas unchanged (transform skips)

## TR-AI-003 — ai-remove-bg: Golden image — background removed from subject image
- **Tier**: 4
- **Prerequisites**: `inspyrenet-swinb-fp16` model downloaded
- **Input**: TD-IMG-005 (`subject-clean-bg.jpg`)
- **Params**: `{ feather: 5, threshold: 0.5 }`
- **Reference**: `TR-AI-003-reference.png`
- **Acceptance**: Corner pixels (background) have alpha ≈ 0; subject centre has alpha = 255; diff < 2%

## TR-AI-004 — ai-remove-bg: Manual quality check — clean extraction on real photo
- **Tier**: 5 (Manual)
- **Steps**: Apply to a real portrait photo; inspect edge quality around hair/fine details
- **Expected Result**: Clean subject extraction; no obvious haloing or missing subject parts

---

## TR-AI-005 — ai-remove-bg-hq: Registration
- **Tier**: 1
- **Expected Result**: Registered; uses same model but higher quality processing (may be slower)

## TR-AI-006 — ai-remove-bg-hq: No-crash when model absent
- **Tier**: 2

## TR-AI-007 — ai-remove-bg-hq: Golden image — compare quality to standard bg-remove
- **Tier**: 4
- **Input**: TD-IMG-005
- **Reference**: `TR-AI-007-reference.png`
- **Expected Result**: Edge regions have less noise than standard ai-remove-bg output (visual quality check)

---

## TR-AI-008 — ai-portrait-bokeh: Registration
- **Tier**: 1
- **Expected Result**: Params include `blurRadius`, model requirement

## TR-AI-009 — ai-portrait-bokeh: No-crash when model absent
- **Tier**: 2

## TR-AI-010 — ai-portrait-bokeh: Background pixels are blurred, subject pixels are sharp
- **Tier**: 4 (Golden Image)
- **Input**: TD-IMG-005
- **Reference**: `TR-AI-010-reference.png`
- **Expected Result**: Diff < 2%; subject region has higher sharpness variance than background region

---

## TR-AI-011 — ai-drop-shadow: Registration
- **Tier**: 1
- **Expected Result**: Params include `angle`, `distance`, `blur`, `color`, `opacity`

## TR-AI-012 — ai-drop-shadow: No-crash when model absent
- **Tier**: 2

## TR-AI-013 — ai-drop-shadow: Shadow pixels appear behind subject
- **Tier**: 4
- **Input**: TD-IMG-005 (after bg-remove)
- **Params**: `{ angle: 45, distance: 10, blur: 5, color: "#000000", opacity: 0.7 }`
- **Reference**: `TR-AI-013-reference.png`
- **Expected Result**: Diff < 2%

---

## TR-AI-014 — ai-sticker-outline: Registration
- **Tier**: 1
- **Expected Result**: Params include `outlineColor`, `outlineWidth`

## TR-AI-015 — ai-sticker-outline: No-crash when model absent
- **Tier**: 2

## TR-AI-016 — ai-sticker-outline: Outline pixels appear on the subject's border
- **Tier**: 4
- **Input**: TD-IMG-005
- **Params**: `{ outlineColor: "#ffffff", outlineWidth: 5 }`
- **Reference**: `TR-AI-016-reference.png`
- **Expected Result**: White border pixels visible at subject edge; diff < 2%

---

## TR-AI-017 — ai-subject-vignette: Registration + no-crash when model absent
- **Tier**: 1 + 2

## TR-AI-018 — ai-subject-sharpen: Registration + no-crash when model absent
- **Tier**: 1 + 2

## TR-AI-019 — ai-silhouette: Registration
- **Tier**: 1
- **Expected Result**: Params include `color` (fill colour for subject silhouette)

## TR-AI-020 — ai-silhouette: No-crash when model absent
- **Tier**: 2

## TR-AI-021 — ai-silhouette: Subject filled with solid colour
- **Tier**: 4
- **Input**: TD-IMG-005
- **Params**: `{ color: "#ff0000" }`
- **Reference**: `TR-AI-021-reference.png`
- **Expected Result**: Subject region is red; background transparent or unchanged; diff < 2%

---

## TR-AI-022 — ai-face-privacy: Registration
- **Tier**: 1
- **Expected Result**: Params include `mode` (blur/pixelate/replace), `strength`

## TR-AI-023 — ai-face-privacy: No-crash when no face detected
- **Tier**: 2
- **Test Data**: 100×100 solid colour canvas (no face)
- **Expected Result**: Canvas unchanged; no error

## TR-AI-024 — ai-face-privacy: Blur mode reduces sharpness in face region
- **Tier**: 4
- **Input**: TD-IMG-001 (`portrait-with-gps.jpg` — has a face)
- **Params**: `{ mode: "blur", strength: 20 }`
- **Reference**: `TR-AI-024-reference.png`
- **Expected Result**: Diff < 3%; face region pixel variance lower than original

## TR-AI-025 — ai-face-privacy: Manual quality — does blur cover the full face?
- **Tier**: 5 (Manual)
- **Expected Result**: Face is fully obscured; blur extends to hairline and chin

---

## TR-AI-026 — ai-smart-redact: Registration
- **Tier**: 1
- **Expected Result**: Params include `targets` (faces, text, plates, etc.)

## TR-AI-027 — ai-smart-redact: No-crash when model absent
- **Tier**: 2

---

## TR-AI-028 — ai-ocr-tag: Registration
- **Tier**: 1
- **Expected Result**: Params include `variable` (output variable name)

## TR-AI-029 — ai-ocr-tag: Extracts text from an image with known text
- **Tier**: 4
- **Input**: A fixture image containing the text "HELLO OCR" in black on white background
- **Steps**: Apply ai-ocr-tag; check `context.variables.get("ocrText")`
- **Expected Result**: Variable contains `"HELLO OCR"` or close match

## TR-AI-030 — ai-ocr-tag: No-crash on blank canvas
- **Tier**: 2
- **Test Data**: 100×100 blank white canvas
- **Expected Result**: Variable is empty string or null; no error

---

## TR-AI-031 — ai-analyse-people: Registration
- **Tier**: 1
- **Expected Result**: Params include output variable name(s) for person count, pose, etc.

## TR-AI-032 — ai-analyse-people: No-crash when model absent
- **Tier**: 2

## TR-AI-033 — ai-analyse-people: Correct person count on known multi-face image
- **Tier**: 4
- **Input**: TD-IMG-009 (`multi-face.jpg` — 3 faces)
- **Steps**: Apply; check `personCount` variable
- **Expected Result**: `personCount >= 3`

---

## TR-AI-034 — ai-glow-eyes: Registration + no-crash when model absent
- **Tier**: 1 + 2

## TR-AI-035 — ai-subject-glow: Registration + no-crash when model absent
- **Tier**: 1 + 2

## TR-AI-036 — ai-export-matte: Registration
- **Tier**: 1
- **Expected Result**: Params include `outputVariable` or filename suffix for the matte PNG

## TR-AI-037 — ai-export-matte: Produces a greyscale matte blob (white=subject, black=background)
- **Tier**: 4
- **Input**: TD-IMG-005
- **Steps**: Apply; check ProcessResult for a matte blob
- **Expected Result**: Matte PNG exists; subject area is predominantly white

## TR-AI-038 — ai-clipping-mask: Registration + no-crash when model absent
- **Tier**: 1 + 2

## TR-AI-039 — ai-chroma-key: Registration
- **Tier**: 1
- **Expected Result**: Params include `keyColor`, `threshold`, `feather`

## TR-AI-040 — ai-chroma-key: Removes green screen pixels
- **Tier**: 2
- **Test Data**: 100×100 canvas with centre 50×50 filled green (#00ff00), rest blue; params `{ keyColor: "#00ff00", threshold: 30 }`
- **Steps**: Apply; sample the green region pixels
- **Expected Result**: Pixels in green region have alpha = 0 (keyed out)

## TR-AI-041 — ai-magic-eraser: Registration + no-crash
- **Tier**: 1 + 2

---

## AI Transforms — Audio

## TR-AI-042 — ai-transcribe: Registration
- **Tier**: 1
- **Steps**: `registry.get("ai-transcribe")`
- **Expected Result**: Registered; `requires` includes `whisper-tiny-en`; params include `outputVariable`

## TR-AI-043 — ai-transcribe: No-crash when Whisper model not downloaded
- **Tier**: 2
- **Mock**: `isModelDownloaded("whisper-tiny-en")` → false
- **Expected Result**: Warning logged; context variable not set; no throw

## TR-AI-044 — ai-transcribe: Generates SRT output for a known audio file
- **Tier**: 5 (Manual — requires model and audio processing)
- **Test Data**: TD-VID-001 (`short-clip-5s.mp4` — with known spoken content)
- **Steps**:
  1. Ensure Whisper model downloaded
  2. Run recipe with ai-transcribe node
  3. Check the output SRT variable
- **Expected Result**: SRT content contains recognisable words from the audio; timestamps are within 1 second of actual speech

## TR-AI-045 — ai-transcribe: Graceful handling of silent video
- **Tier**: 2 (mock audio extraction)
- **Test Data**: TD-VID-003 (`silent-video.mp4`)
- **Expected Result**: No crash; SRT variable is empty or contains no cues

---

## TR-AI-046 — flow-audio-tts: Registration
- **Tier**: 1
- **Expected Result**: Registered; `requires` includes `kokoro-82m`; params include `text`, `voice`, `outputVariable`

## TR-AI-047 — flow-audio-tts: No-crash when Kokoro model absent
- **Tier**: 2
- **Mock**: model not present
- **Expected Result**: Warning; no throw

## TR-AI-048 — flow-audio-tts: Generates audio blob from text
- **Tier**: 5 (Manual)
- **Test Data**: params `{ text: "Hello world", voice: "default" }`; Kokoro model downloaded
- **Steps**: Run recipe; check output
- **Expected Result**: Audio blob (WAV/MP3) is produced; plays; speech is audible

---

## TR-AI-049 — flow-ai-diarize: Registration
- **Tier**: 1
- **Expected Result**: Registered; requires pyannote-segmentation model; params include `outputVariable`

## TR-AI-050 — flow-ai-diarize: No-crash when model absent
- **Tier**: 2

## TR-AI-051 — flow-ai-diarize: Produces speaker segment data for a multi-speaker audio
- **Tier**: 5 (Manual)
- **Test Data**: Audio file with 2 distinct speakers
- **Expected Result**: Output variable contains speaker segments (speaker IDs + timestamps); at least 2 distinct speaker labels

---

## TR-AI-052 — ai-translate-text: Registration
- **Tier**: 1
- **Expected Result**: Params include `inputVariable`, `targetLanguage`, `outputVariable`

## TR-AI-053 — ai-translate-text: No-crash when Chrome AI not available
- **Tier**: 2
- **Mock**: `window.ai` = undefined
- **Expected Result**: Warning logged; output variable not set; no throw

## TR-AI-054 — ai-translate-text: Translates text when Chrome AI is available
- **Tier**: 5 (Manual — requires Canary/Dev Chrome with Built-in AI enabled)
- **Test Data**: `inputVariable` = "Hello world", `targetLanguage` = "de"
- **Expected Result**: Output variable contains German translation (approx. "Hallo Welt")
