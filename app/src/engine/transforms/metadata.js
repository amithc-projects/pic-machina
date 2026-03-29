/**
 * ImageChef — Metadata transforms
 */

import { registry } from '../registry.js';
import { interpolate } from '../../utils/variables.js';

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

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${gps.lat}&lon=${gps.lng}&format=json`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'ImageChef/1.0' } });
      const data = await resp.json();
      const addr = data.address || {};

      if (!context.meta)      context.meta      = {};
      if (!context.variables) context.variables = new Map();

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
    } catch (err) {
      console.warn('[meta-geocode] failed:', err);
    }
  }
});
