/**
 * ImageChef — Metadata transforms
 */

import { registry } from '../registry.js';
import { interpolate } from '../../utils/variables.js';
import { getClosestColorName } from '../../utils/color-matcher.js';

// ─── Strip Metadata ───────────────────────────────────────
// Actual stripping happens in the processor at export time.
// This node sets a flag on the context.
registry.register({
  id: 'meta-strip', name: 'Strip Metadata', category: 'Metadata', categoryKey: 'meta',
  icon: 'layers_clear',
  description: 'Remove EXIF/GPS metadata from output JPEG.',
  params: [
    { name: 'level', label: 'Level', type: 'select',
      options: [
        { label: 'All Metadata', value: 'All' },
        { label: 'GPS Only',     value: 'GPS Only' },
        { label: 'EXIF Only',    value: 'EXIF Only' },
      ],
      defaultValue: 'All' },
  ],
  apply(ctx, p, context) {
    // Set stripping level on context for the processor to apply during export
    context._stripMetadata = p.level || 'All';
  }
});

// ─── Set EXIF Info ────────────────────────────────────────
registry.register({
  id: 'meta-set-exif', name: 'Set EXIF Info', category: 'Metadata', categoryKey: 'meta',
  icon: 'database',
  description: 'Write custom EXIF fields to the output file.',
  params: [
    { name: 'field', label: 'Field', type: 'select',
      options: [
        { label: 'Artist/Author',  value: 'artist' },
        { label: 'Copyright',      value: 'copyright' },
        { label: 'Comment',        value: 'comment' },
        { label: 'Description',    value: 'description' },
        { label: 'Software',       value: 'software' },
      ],
      defaultValue: 'copyright' },
    { name: 'value', label: 'Value ({{vars}} ok)', type: 'text', defaultValue: '© {{exif.author | "Owner"}} {{exif.date | date("YYYY")}}' },
  ],
  apply(ctx, p, context) {
    const value = interpolate(p.value || '', context);
    if (!context._exifWrites) context._exifWrites = {};
    context._exifWrites[p.field || 'copyright'] = value;
  }
});

// ─── Geocode ──────────────────────────────────────────────
registry.register({
  id: 'meta-geocode', name: 'Geocode', category: 'Metadata', categoryKey: 'meta',
  icon: 'location_on',
  description: 'Reverse-geocode GPS coords via Nominatim. Sets {{city}}, {{country}}, {{state}}, {{county}}, {{postcode}}, {{country_code}}, {{suburb}}, {{road}} — plus a combined {{location}} string.',
  params: [
    { name: 'template',    label: 'Combined template', type: 'text', defaultValue: '{city}, {country}',
      placeholder: 'Tokens: {city} {county} {state} {country} {country_code} {postcode} {suburb} {road}' },
    { name: 'targetField', label: 'Combined var name',  type: 'text', defaultValue: 'location' },
  ],
  async apply(ctx, p, context) {
    const gps = context.exif?.gps || context.meta?.gps;
    if (!gps?.lat || !gps?.lng) return;

    if (!context.meta)      context.meta      = {};
    if (!context.variables) context.variables = new Map();

    // Use cached geo data from a previous run (saved to asset store as sidecar.geo)
    if (context.sidecar?.geocodedAt) {
      const cached = {
        city:         context.sidecar.city         || '',
        county:       context.sidecar.county        || '',
        state:        context.sidecar.state         || '',
        country:      context.sidecar.country       || '',
        country_code: context.sidecar.country_code  || '',
        postcode:     context.sidecar.postcode       || '',
        suburb:       context.sidecar.suburb         || '',
        road:         context.sidecar.road           || '',
      };
      for (const [k, v] of Object.entries(cached)) {
        context.meta[k] = v;
        context.variables.set(k, v);
      }
      const location = (p.template || '{city}, {country}')
        .replace('{city}',         cached.city)
        .replace('{county}',       cached.county)
        .replace('{state}',        cached.state)
        .replace('{country}',      cached.country)
        .replace('{country_code}', cached.country_code)
        .replace('{postcode}',     cached.postcode)
        .replace('{suburb}',       cached.suburb)
        .replace('{road}',         cached.road);
      context.meta[p.targetField || 'location'] = location;
      context.variables.set(p.targetField || 'location', location);
      return;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${gps.lat}&lon=${gps.lng}&format=json`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'ImageChef/1.0' } });
      const data = await resp.json();
      const addr = data.address || {};

      // Store each address field individually so {{country}}, {{city}} etc. work
      const components = {
        city:     addr.city || addr.town || addr.village || addr.hamlet || '',
        county:   addr.county || '',
        state:    addr.state || addr.region || '',
        country:  addr.country || '',
        country_code: (addr.country_code || '').toUpperCase(),
        postcode: addr.postcode || '',
        suburb:   addr.suburb || addr.neighbourhood || '',
        road:     addr.road || '',
      };

      for (const [k, v] of Object.entries(components)) {
        context.meta[k] = v;
        context.variables.set(k, v);
      }

      const location = (p.template || '{city}, {country}')
        .replace('{city}',         components.city)
        .replace('{county}',       components.county)
        .replace('{state}',        components.state)
        .replace('{country}',      components.country)
        .replace('{country_code}', components.country_code)
        .replace('{postcode}',     components.postcode)
        .replace('{suburb}',       components.suburb)
        .replace('{road}',         components.road);

      context.meta[p.targetField || 'location'] = location;
      context.variables.set(p.targetField || 'location', location);

      // Persist to asset store so {{sidecar.city}} works on future runs without re-geocoding
      if (context.assetHash) {
        const geo = { ...components, location, geocodedAt: Date.now() };
        try {
          const { patchAsset } = await import('../../data/assets.js');
          await patchAsset(context.assetHash, { geo });
        } catch { /* non-fatal */ }
        // Also expose immediately in context.sidecar for downstream nodes in this run
        if (!context.sidecar) context.sidecar = {};
        Object.assign(context.sidecar, components, { location });
      }
    } catch (err) {
      console.warn('[meta-geocode] failed:', err);
    }
  }
});

// ─── Extract Dominant Colors ──────────────────────────────
registry.register({
  id: 'meta-dominant-color', name: 'Extract Dominant Color', category: 'Metadata', categoryKey: 'meta',
  icon: 'palette',
  description: 'Quickly analyses the image to extract the top 3 dominant colors. Can ignore near-transparent edges and solid black/white backgrounds.',
  params: [
    { name: 'ignoreNeutral', label: 'Ignore Black/White', type: 'boolean', defaultValue: true },
    { name: 'minAlpha',      label: 'Min Opacity (0-255)', type: 'range',   min: 0, max: 255, defaultValue: 250 },
  ],
  apply(ctx, p, context) {
    if (!context.meta) context.meta = {};
    if (!context.variables) context.variables = new Map();

    const ignoreNeutral = p.ignoreNeutral !== false;
    const minAlpha = p.minAlpha ?? 250;

    // Fast downsample to 32x32 for blazing fast dominant color extraction
    const tmp = document.createElement('canvas');
    tmp.width = 32;
    tmp.height = 32;
    const tctx = tmp.getContext('2d');
    
    // We draw from the current working canvas (ctx.canvas) to our 32x32 canvas
    tctx.drawImage(ctx.canvas, 0, 0, 32, 32);
    
    const id = tctx.getImageData(0, 0, 32, 32);
    const d = id.data;
    
    // Bucket pixels (5-bit truncation for better grouping/diversity)
    const buckets = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
      
      // Skip pixels that are below opacity threshold
      if (a < minAlpha) continue;
      
      // Calculate center-weighting factor (Saliency)
      // Images usually have the subject in the center. Center pixels get up to 2x weight.
      const pxIndex = i / 4;
      const x = pxIndex % 32;
      const y = Math.floor(pxIndex / 32);
      const dx = x - 16;
      const dy = y - 16;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const weight = 1 + Math.max(0, (16 - dist) / 16);

      // Slightly broader bucketing (step of 24) to group textured shades better
      const rB = Math.round(r / 24) * 24;
      const gB = Math.round(g / 24) * 24;
      const bB = Math.round(b / 24) * 24;
      const key = `${rB},${gB},${bB}`;
      
      const bkt = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      bkt.count += weight;
      bkt.r += (r * weight); 
      bkt.g += (g * weight); 
      bkt.b += (b * weight);
      buckets.set(key, bkt);
    }
    
    // Sort buckets by weighted frequency
    const sorted = [...buckets.values()].sort((a,b) => b.count - a.count);
    
    const hexArr = [];
    const nameArr = [];
    const nameSet = new Set();
    
    // Diversity Loop: Find top 3 colors that map to UNIQUE semantic names
    // This prevents "tan tan tan" results if the background has slight noise/gradients
    for (const bkt of sorted) {
      const r = Math.round(bkt.r / bkt.count);
      const g = Math.round(bkt.g / bkt.count);
      const b = Math.round(bkt.b / bkt.count);
      const name = getClosestColorName(r, g, b);
      
      // If ignoreNeutral is on, skip anything the matcher classified as black or white
      if (ignoreNeutral && (name === 'black' || name === 'white')) continue;
      
      if (!nameSet.has(name)) {
        nameSet.add(name);
        nameArr.push(name);
        hexArr.push('#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''));
      }
      
      if (nameArr.length >= 3) break;
    }
    
    // Inject arrays into meta
    context.meta.dominantColors = nameArr;
    context.meta.dominantHex = hexArr;
    
    // Expose dot-notation variables exactly as requested: {{dominantColors.0}} and {{dominantHex.0}}
    nameArr.forEach((name, i) => {
      context.variables.set(`dominantColors.${i}`, name);
    });
    hexArr.forEach((hex, i) => {
      context.variables.set(`dominantHex.${i}`, hex);
    });
  }
});

// ─── Blur / Sharpness Detection ───────────────────────────
registry.register({
  id: 'meta-blur-detect',
  name: 'Detect Blur / Sharpness',
  category: 'Metadata',
  categoryKey: 'meta',
  icon: 'blur_on',
  description: [
    'Scores how sharp or blurry the image is using a Laplacian variance',
    'analysis (no external models required). Exposes {{sharpnessScore}}',
    '(0–100) and {{blurLabel}} (Sharp / Soft / Blurry) for use in',
    'filename templates and conditional branches. Also persists the score',
    'to the asset record (vision.sharpnessScore) for future filtering.',
  ].join(' '),
  params: [
    {
      name: 'sampleSize',
      label: 'Sample Resolution',
      type: 'select',
      options: [
        { label: 'Fast (256 px)', value: 256 },
        { label: 'Balanced (512 px)', value: 512 },
        { label: 'Precise (1024 px)', value: 1024 },
      ],
      defaultValue: 512,
    },
    {
      name: 'sharpThreshold',
      label: 'Sharp threshold (0–100)',
      type: 'range',
      min: 0, max: 100,
      defaultValue: 60,
    },
    {
      name: 'blurryThreshold',
      label: 'Blurry threshold (0–100)',
      type: 'range',
      min: 0, max: 100,
      defaultValue: 30,
    },
  ],
  apply(ctx, p, context) {
    if (!context.meta)      context.meta      = {};
    if (!context.variables) context.variables = new Map();

    const size    = Number(p.sampleSize)    || 512;
    const sharpTh = Number(p.sharpThreshold)  ?? 60;
    const blurTh  = Number(p.blurryThreshold) ?? 30;

    // ── 1. Downsample to a square working canvas ──────────────
    const tmp  = document.createElement('canvas');
    const srcW = ctx.canvas.width;
    const srcH = ctx.canvas.height;
    const scale = Math.min(1, size / Math.max(srcW, srcH));
    tmp.width  = Math.round(srcW * scale);
    tmp.height = Math.round(srcH * scale);
    tmp.getContext('2d').drawImage(ctx.canvas, 0, 0, tmp.width, tmp.height);

    const W = tmp.width;
    const H = tmp.height;
    const imageData = tmp.getContext('2d').getImageData(0, 0, W, H);
    const d = imageData.data;

    // ── 2. Convert to grayscale ───────────────────────────────
    const gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const off = i * 4;
      gray[i] = 0.299 * d[off] + 0.587 * d[off + 1] + 0.114 * d[off + 2];
    }

    // ── 3. Apply 3×3 Laplacian kernel [0,1,0; 1,-4,1; 0,1,0] ─
    // Skip 1-pixel border to avoid edge artifacts.
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const val =
          -4 * gray[y * W + x]     +
               gray[(y - 1) * W + x] +
               gray[(y + 1) * W + x] +
               gray[y * W + (x - 1)] +
               gray[y * W + (x + 1)];
        sum   += val;
        sumSq += val * val;
        count++;
      }
    }

    const mean     = sum / count;
    const variance = sumSq / count - mean * mean;

    // ── 4. Log-normalise to 0–100 ─────────────────────────────
    // log1p(~500) ≈ 6.2 → maps "clearly sharp" photos to ~100.
    // Very blurry images score ~0–15; acceptable sharpness is 30+.
    const LOG_CAP = Math.log1p(500);
    const score   = Math.min(100, Math.round(Math.log1p(Math.max(0, variance)) / LOG_CAP * 100));

    const label =
      score >= sharpTh ? 'Sharp' :
      score >= blurTh  ? 'Soft'  :
      'Blurry';

    // ── 5. Expose as variables and meta ──────────────────────
    context.meta.sharpnessScore = score;
    context.meta.blurLabel      = label;
    context.variables.set('sharpnessScore', String(score));
    context.variables.set('blurLabel',      label);

    context.log?.('info', `[blur-detect] variance=${variance.toFixed(1)}  score=${score}  → ${label}`);

    // ── 6. Persist to asset store (non-blocking) ─────────────
    if (context.assetHash) {
      import('../../data/assets.js').then(({ patchAsset }) => {
        patchAsset(context.assetHash, {
          vision: {
            sharpnessScore: score,
            blurLabel:      label,
            blurAt:         Date.now(),
          },
        });
      }).catch(() => { /* non-fatal */ });
    }
  },
});

registry.register({
  id:          'meta-sidecar-write',
  name:        'Write Sidecar Field',
  category:    'Metadata',
  categoryKey: 'meta',
  icon:        'edit_note',
  description: 'Write a value into the sidecar JSON file\'s computed block. The sidecar is flushed to disk after each image is processed.',
  params: [
    {
      name: 'key',
      label: 'Field name',
      type: 'text',
      default: '',
      placeholder: 'e.g. myScore',
      description: 'Key written under sidecar.computed — use letters, numbers, underscores',
    },
    {
      name: 'value',
      label: 'Value',
      type: 'text',
      default: '',
      placeholder: '{{sharpnessScore}}',
      description: 'Value to store. Supports {{variable}} substitution.',
    },
  ],
  apply(ctx, p, context) {
    const key   = (p.key   || '').trim();
    const value = (p.value || '').trim();
    if (!key) return;

    // Resolve variables in value
    const resolved = context.variables instanceof Map && value.includes('{{')
      ? value.replace(/\{\{([^}]+)\}\}/g, (_, k) => context.variables.get(k.trim()) ?? context.meta?.[k.trim()] ?? `{{${k}}}`)
      : value;

    // Accumulate into sidecarWrites — batch.js flushes this after each file
    if (!context.sidecarWrites) context.sidecarWrites = {};
    context.sidecarWrites[key] = resolved;
  },
});
