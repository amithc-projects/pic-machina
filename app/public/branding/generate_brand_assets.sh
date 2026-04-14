#!/usr/bin/env bash
set -euo pipefail

# PicMachina brand asset generator
# Requires: ImageMagick 7+ ("magick")
#
# Usage:
#   ./generate_brand_assets.sh
#   ./generate_brand_assets.sh /path/to/source_dir /path/to/output_dir
#
# Expected source files in source_dir:
#   favicon.png              # square symbol master with dark background
#   icon-512.png             # square symbol master, 512x512 or larger
#   icon-512-maskable.png    # square symbol master for maskable use
#   logo.svg                 # horizontal logo master (preferred)
#   PicMachina-side-by-side.jpeg  # horizontal logo fallback if SVG missing
#   pm-logo-above-web.png    # stacked logo master

SRC_DIR="${1:-$(pwd)}"
OUT_DIR="${2:-$SRC_DIR/brand-pack}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: '$1' is required but not installed." >&2
    exit 1
  }
}

pick_existing() {
  for candidate in "$@"; do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

resize_pad_square() {
  local src="$1" size="$2" out="$3"
  magick "$src" -auto-orient -background none -gravity center \
    -resize "${size}x${size}" -extent "${size}x${size}" "$out"
}

cover_crop() {
  local src="$1" width="$2" height="$3" out="$4"
  magick "$src" -auto-orient -gravity center \
    -resize "${width}x${height}^" -extent "${width}x${height}" "$out"
}

fit_on_canvas() {
  local src="$1" width="$2" height="$3" background="$4" out="$5"
  magick "$src" -auto-orient -background "$background" -gravity center \
    -resize "${width}x${height}" -extent "${width}x${height}" "$out"
}

render_svg_width() {
  local src="$1" width="$2" out="$3"
  magick -background none -density 384 "$src" -resize "${width}" "$out"
}

need_cmd magick

mkdir -p "$OUT_DIR"/{favicons,pwa,app-icons,logos,logos/social,logos/web,logos/print,social,store-badges,manifests}

SYMBOL_MASTER="$(pick_existing \
  "$SRC_DIR/icon-512.png" \
  "$SRC_DIR/favicon.png" \
  "$SRC_DIR/icon-512-maskable.png")" || {
  echo "Error: could not find a square symbol master in $SRC_DIR" >&2
  exit 1
}

MASKABLE_MASTER="$(pick_existing \
  "$SRC_DIR/icon-512-maskable.png" \
  "$SRC_DIR/icon-512.png" \
  "$SRC_DIR/favicon.png")" || {
  echo "Error: could not find a maskable square master in $SRC_DIR" >&2
  exit 1
}

if [[ -f "$SRC_DIR/logo.svg" ]]; then
  HORIZONTAL_MASTER="$SRC_DIR/logo.svg"
else
  HORIZONTAL_MASTER="$(pick_existing \
    "$SRC_DIR/PicMachina-side-by-side.jpeg" \
    "$SRC_DIR/PicMachina-side-by-side.jpg" \
    "$SRC_DIR/PicMachina-side-by-side.png")" || {
      echo "Error: could not find a horizontal logo master in $SRC_DIR" >&2
      exit 1
    }
fi

STACKED_MASTER="$(pick_existing \
  "$SRC_DIR/pm-logo-above-web.png" \
  "$SRC_DIR/pm-logo-above-web.jpg" \
  "$SRC_DIR/pm-logo-above-web.jpeg")" || {
    echo "Error: could not find a stacked logo master in $SRC_DIR" >&2
    exit 1
  }

echo "Using:"
echo "  symbol master:     $SYMBOL_MASTER"
echo "  maskable master:   $MASKABLE_MASTER"
echo "  horizontal master: $HORIZONTAL_MASTER"
echo "  stacked master:    $STACKED_MASTER"
echo

echo "Generating favicons..."
for s in 16 32 48; do
  resize_pad_square "$SYMBOL_MASTER" "$s" "$OUT_DIR/favicons/favicon-${s}.png"
done
magick \
  "$OUT_DIR/favicons/favicon-16.png" \
  "$OUT_DIR/favicons/favicon-32.png" \
  "$OUT_DIR/favicons/favicon-48.png" \
  "$OUT_DIR/favicons/favicon.ico"

echo "Generating app and PWA icons..."
for s in 57 60 72 76 96 114 120 128 144 152 167 180 192 256 384 512 1024; do
  resize_pad_square "$SYMBOL_MASTER" "$s" "$OUT_DIR/app-icons/icon-${s}.png"
done

cp "$OUT_DIR/app-icons/icon-180.png" "$OUT_DIR/app-icons/apple-touch-icon.png"
cp "$OUT_DIR/app-icons/icon-192.png" "$OUT_DIR/pwa/icon-192.png"
cp "$OUT_DIR/app-icons/icon-512.png" "$OUT_DIR/pwa/icon-512.png"

for s in 192 512; do
  resize_pad_square "$MASKABLE_MASTER" "$s" "$OUT_DIR/pwa/icon-${s}-maskable.png"
done

echo "Generating Android legacy launcher sizes..."
for s in 36 48 72 96 144 192; do
  resize_pad_square "$SYMBOL_MASTER" "$s" "$OUT_DIR/app-icons/android-launcher-${s}.png"
done

echo "Generating social avatars..."
for s in 400 800 1080; do
  resize_pad_square "$SYMBOL_MASTER" "$s" "$OUT_DIR/logos/social/avatar-${s}.png"
done

echo "Generating web logos..."
if [[ "$HORIZONTAL_MASTER" == *.svg ]]; then
  for w in 160 240 320 480 640 960 1280 1600 2000; do
    render_svg_width "$HORIZONTAL_MASTER" "$w" "$OUT_DIR/logos/web/logo-horizontal-${w}w.png"
  done
  cp "$HORIZONTAL_MASTER" "$OUT_DIR/logos/web/logo-horizontal-master.svg"
else
  for w in 160 240 320 480 640 960 1280 1600 2000; do
    magick "$HORIZONTAL_MASTER" -auto-orient -filter Lanczos -resize "${w}" \
      "$OUT_DIR/logos/web/logo-horizontal-${w}w.png"
  done
fi

for w in 320 480 640 800 1024 1400; do
  magick "$STACKED_MASTER" -auto-orient -filter Lanczos -resize "${w}" \
    "$OUT_DIR/logos/web/logo-stacked-${w}w.png"
done

echo "Generating social sharing assets..."
cover_crop "$HORIZONTAL_MASTER" 1200 630 "$OUT_DIR/social/open-graph-1200x630.png"
cover_crop "$HORIZONTAL_MASTER" 1200 600 "$OUT_DIR/social/twitter-card-1200x600.png"
cover_crop "$STACKED_MASTER" 1080 1080 "$OUT_DIR/social/instagram-post-1080x1080.png"
cover_crop "$STACKED_MASTER" 1080 1920 "$OUT_DIR/social/story-1080x1920.png"

echo "Generating app store graphics..."
cover_crop "$STACKED_MASTER" 1024 500 "$OUT_DIR/store-badges/google-play-feature-graphic-1024x500.png"
fit_on_canvas "$STACKED_MASTER" 1242 2688 black "$OUT_DIR/store-badges/app-store-portrait-1242x2688.png"
fit_on_canvas "$HORIZONTAL_MASTER" 1280 720 black "$OUT_DIR/store-badges/app-store-landscape-1280x720.png"

echo "Generating print exports..."
if [[ "$HORIZONTAL_MASTER" == *.svg ]]; then
  cp "$HORIZONTAL_MASTER" "$OUT_DIR/logos/print/logo-horizontal-print.svg"
  magick -background none -density 600 "$HORIZONTAL_MASTER" \
    "$OUT_DIR/logos/print/logo-horizontal-print-600dpi.png"
else
  magick "$HORIZONTAL_MASTER" -auto-orient -filter Lanczos -resize 3000x \
    "$OUT_DIR/logos/print/logo-horizontal-print-3000w.png"
fi

cat > "$OUT_DIR/manifests/site.webmanifest" <<'JSON'
{
  "name": "PicMachina",
  "short_name": "PicMachina",
  "icons": [
    { "src": "/brand-pack/pwa/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/brand-pack/pwa/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/brand-pack/pwa/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/brand-pack/pwa/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "theme_color": "#0B1020",
  "background_color": "#0B1020",
  "display": "standalone"
}
JSON

cat > "$OUT_DIR/manifests/html-head-snippet.html" <<'HTML'
<link rel="icon" type="image/png" sizes="16x16" href="/brand-pack/favicons/favicon-16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/brand-pack/favicons/favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/brand-pack/favicons/favicon-48.png">
<link rel="icon" href="/brand-pack/favicons/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/brand-pack/app-icons/apple-touch-icon.png">
<link rel="manifest" href="/brand-pack/manifests/site.webmanifest">
<meta property="og:image" content="/brand-pack/social/open-graph-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="/brand-pack/social/twitter-card-1200x600.png">
HTML

cat > "$OUT_DIR/README-generated-assets.txt" <<EOF
Generated PicMachina brand assets.

Run:
  ./generate_brand_assets.sh "$SRC_DIR" "$OUT_DIR"

Folders:
- favicons/
- pwa/
- app-icons/
- logos/web/
- logos/social/
- logos/print/
- social/
- store-badges/
- manifests/
EOF

echo
echo "Done. Assets written to:"
echo "  $OUT_DIR"
