# Test Data Catalogue

All fixture files referenced by the test specs live under `tests/fixtures/`.

---

## Image Fixtures

### TD-IMG-001 — `portrait-with-gps.jpg`
- **Description**: JPEG portrait-orientation photo with full EXIF including GPS
- **Dimensions**: 1000 × 1500 px
- **EXIF fields**: Make=Canon, Model=EOS 90D, ISO=400, FocalLength=50mm, Aperture=f/2.8, DateTaken=2023-06-15T10:30:00, GPS lat=51.5074, lng=-0.1278
- **Usage**: EXIF reader tests, sidecar geo tests, conditional node tests (IsPortrait, HasGPS)

### TD-IMG-002 — `landscape-no-exif.jpg`
- **Description**: Plain JPEG landscape image, no EXIF metadata
- **Dimensions**: 1920 × 1080 px
- **Usage**: Geometry transforms, crop tests, aspect-ratio tests, strip-metadata tests

### TD-IMG-003 — `square-red.png`
- **Description**: Solid #FF0000 red 100×100 PNG
- **Usage**: Color transform tests, contrast/saturation/invert output validation

### TD-IMG-004 — `square-grey.png`
- **Description**: Solid #808080 grey 100×100 PNG
- **Usage**: Color transform tests — baseline for adjustments that should produce measurable pixel changes

### TD-IMG-005 — `subject-clean-bg.jpg`
- **Description**: Photo of a person against a plain white background, 800×800 px
- **Usage**: Background-swap golden image tests, InSPyReNet subject detection

### TD-IMG-006 — `face-a.jpg`
- **Description**: Clear frontal face photo, 500×500 px, synthetic/stock only
- **Usage**: Face-swap golden image baseline

### TD-IMG-007 — `face-b.jpg`
- **Description**: Clear frontal face photo (different person), 500×500 px
- **Usage**: Face-swap golden image target

### TD-IMG-008 — `tiny-1px.png`
- **Description**: 1×1 transparent PNG
- **Usage**: Edge-case boundary tests for transform clamp logic

### TD-IMG-009 — `multi-face.jpg`
- **Description**: Group photo with 3 clearly distinct faces
- **Usage**: Face detection count validation, vision-metadata tests

### TD-IMG-010 — `gps-paris.jpg`
- **Description**: JPEG with GPS coords for Paris (lat=48.8566, lng=2.3522)
- **Usage**: Reverse-geocode tests (mocked Nominatim response)

---

## Video Fixtures

### TD-VID-001 — `short-clip-5s.mp4`
- **Description**: 5-second H.264 MP4, 1280×720, 30fps, stereo audio at 48kHz
- **Usage**: Video-convert tests, filmstrip extraction, timeline tests, audio-transcribe pipeline

### TD-VID-002 — `portrait-video-3s.mp4`
- **Description**: 3-second 1080×1920 (portrait) MP4
- **Usage**: Geometry conditional (IsPortrait) on video, compositor tests

### TD-VID-003 — `silent-video.mp4`
- **Description**: 3-second MP4 with no audio track
- **Usage**: Audio-transcribe graceful-failure test

---

## Sidecar / JSON Fixtures

### TD-SC-001 — `sidecar-v1.json`
- **Description**: A sidecar file at schema version 1 (legacy format — no `annotation.usageScenarios`, no `asset.title`)
- **Content**:
```json
{
  "$version": 1,
  "source": { "filename": "portrait-with-gps.jpg", "sizeBytes": 102400 },
  "exif": { "cameraMake": "Canon", "dateTaken": "2023-06-15" },
  "geo": { "city": "London", "country": "UK", "countryCode": "GB", "region": "England" },
  "annotation": { "rating": 4, "flag": "pick", "tags": ["travel", "portrait"], "caption": "London bridge" },
  "computed": {},
  "processing": []
}
```
- **Usage**: sidecar migration tests (v1→v2)

### TD-SC-002 — `sidecar-v2.json`
- **Description**: A sidecar file at current schema version 2
- **Content**: fully populated v2 sidecar with all fields present
- **Usage**: round-trip read/write tests

### TD-SC-003 — `sidecar-malformed.json`
- **Description**: Invalid JSON bytes (`{"$version": 2, "annotation":`)
- **Usage**: Error handling — readSidecar should return null

### TD-SC-004 — `sidecar-empty-object.json`
- **Description**: `{}`
- **Usage**: migrateSidecar should return a fully-defaulted v2 object

### TD-SC-005 — `legacy-sidecar` (no `.json` extension)
- **Description**: A valid v1 sidecar stored with the old `.photo.jpg` (no `.json`) naming convention
- **Usage**: readSidecar fallback path tests

---

## Recipe Fixtures

### TD-REC-001 — `recipe-simple.json`
- **Description**: A recipe with 3 sequential transform nodes: color-tuning → geo-crop → flow-export
- **Usage**: Processor pipeline tests, recipe save/load round-trip

### TD-REC-002 — `recipe-with-branch.json`
- **Description**: A recipe with a branch node containing 2 variants (portrait crop vs landscape crop)
- **Usage**: Branch node traversal, flattenNodes tests

### TD-REC-003 — `recipe-with-conditional.json`
- **Description**: A recipe with a conditional node: if IsPortrait → portrait-crop, else → landscape-crop
- **Usage**: Conditional evaluation tests, processor conditional path

### TD-REC-004 — `recipe-with-block-ref.json`
- **Description**: A recipe referencing an external block by blockId
- **Usage**: Block resolution in processor, block-ref node tests

### TD-REC-005 — `recipe-requires-model.json`
- **Description**: A recipe containing `ai-transcribe` node (requires whisper-tiny-en model)
- **Usage**: checkRecipeAvailability when model not downloaded

---

## SRT / Subtitle Fixtures

### TD-SRT-001 — `basic.srt`
```
1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,500 --> 00:00:08,200
Second caption line
```
- **Usage**: parseSubtitles happy path

### TD-SRT-002 — `vtt-basic.vtt`
```
WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world
```
- **Usage**: parseSubtitles VTT format

### TD-SRT-003 — `srt-crlf.srt`
- **Description**: Same as basic.srt but with Windows-style CRLF line endings
- **Usage**: parseSubtitles CRLF handling

### TD-SRT-004 — `srt-malformed.txt`
- **Description**: Plain text with no `-->` timecodes
- **Usage**: parseSubtitles returns empty array

---

## Nominatim Mock Responses

### TD-GEO-001 — `nominatim-london.json`
```json
{
  "address": {
    "city": "London", "state": "England",
    "country": "United Kingdom", "country_code": "gb"
  }
}
```
- **Usage**: reverseGeocode tests (fetch mocked)

### TD-GEO-002 — `nominatim-empty.json`
```json
{ "address": {} }
```
- **Usage**: reverseGeocode returns empty strings gracefully
