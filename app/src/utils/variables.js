/**
 * ImageChef — Variable interpolation
 *
 * Resolves {{variable}} tokens in strings against a context object.
 * Supports:
 *   {{filename}}                  → base filename without extension
 *   {{ext}}                       → file extension without dot
 *   {{exif.key}}                  → EXIF metadata field
 *   {{meta.key}}                  → generic metadata field
 *   {{exif.date | date("DD-MMM-YYYY")}}  → formatted date
 *   {{exif.author | "fallback"}}  → value with fallback
 *   {{loop.index}}                → reserved (v1.2) — rendered as literal until implemented
 *   {{sidecar.geo.city}}           → sidecar field (nested dotted paths: annotation.rating, geo.city, etc.)
 */

const TOKEN_RE = /\{\{([^}]+)\}\}/g;

/**
 * @param {string} template   — string containing {{tokens}}
 * @param {object} context    — { filename, ext, exif, meta, loop, sidecar }
 * @returns {string}
 */
export function interpolate(template, context = {}) {
  if (typeof template !== 'string') return String(template ?? '');

  let result = template.replace(TOKEN_RE, (_, expr) => {
    try {
      return resolveExpr(expr.trim(), context);
    } catch {
      return `{{${expr}}}`;
    }
  });

  // Allow explicit literal \n in UI inputs to act as newlines
  return result.replace(/\\n/g, '\n');
}

function resolveExpr(expr, ctx) {
  // Split off pipe: "exif.date | date("DD-MMM-YYYY")"
  const pipeIdx = expr.indexOf('|');
  const raw  = pipeIdx >= 0 ? expr.slice(0, pipeIdx).trim() : expr;
  const pipe = pipeIdx >= 0 ? expr.slice(pipeIdx + 1).trim() : null;

  const value = resolveKey(raw, ctx);

  if (pipe) return applyPipe(value, pipe, ctx);
  return value ?? `{{${expr}}}`;
}

function resolveKey(key, ctx) {
  if (key === 'br' || key === 'break' || key === 'newline') return '\n';
  if (key === 'filename') return ctx.filename ?? '';
  if (key === 'ext')      return ctx.ext ?? '';

  const [ns, ...rest] = key.split('.');
  const field = rest.join('.');

  if (ns === 'exif' || ns === 'meta') {
    // Try flat key first (keys with dots in the name, e.g. "Exif.DateTimeOriginal")
    const src = ns === 'exif' ? ctx.exif : ctx.meta;
    if (src && src[field] != null && typeof src[field] !== 'object') return String(src[field]);
    // Fall back to walking the dotted path for nested objects (e.g. exif.gps.lat)
    const parts = field.split('.');
    let val = src;
    for (const p of parts) {
      if (val == null || typeof val !== 'object') return null;
      val = val[p];
    }
    if (Array.isArray(val)) return val.join(', ');
    if (val != null && typeof val !== 'object') return String(val);
    // Last resort — check the other namespace (legacy: exif|meta were aliased)
    const other = ns === 'exif' ? ctx.meta : ctx.exif;
    return other?.[field] != null ? String(other[field]) : null;
  }
  if (ns === 'recipe')  return ctx.recipe?.[field] != null ? String(ctx.recipe[field]) : null;
  if (ns === 'loop')    return `{{loop.${field}}}`;   // v1.2 reserved
  if (ns === 'sidecar') {
    // Support nested dotted paths: sidecar.annotation.rating, sidecar.geo.city, etc.
    const parts = field.split('.');
    let val = ctx.sidecar;
    for (const p of parts) {
      if (val == null || typeof val !== 'object') return null;
      val = val[p];
    }
    if (Array.isArray(val)) return val.join(', ');
    return val != null ? String(val) : null;
  }

  // Bare key (no namespace) — check variables Map, then meta, then exif
  if (ctx.variables instanceof Map && ctx.variables.has(key)) return ctx.variables.get(key);
  if (ctx.meta?.[key]  != null) return String(ctx.meta[key]);
  if (ctx.exif?.[key]  != null) return String(ctx.exif[key]);

  return null;
}

function applyPipe(value, pipe, ctx) {
  // date("DD-MMM-YYYY") or date("YYYY")
  const dateMatch = pipe.match(/^date\("([^"]+)"\)$/);
  if (dateMatch) {
    return formatDateValue(value, dateMatch[1]);
  }

  // sanitized — strip file extension, replace hyphens/underscores with spaces
  if (pipe === 'sanitized') {
    return String(value ?? '')
      .replace(/\.[^.]+$/, '')  // remove extension
      .replace(/[-_]/g, ' ');   // hyphens and underscores → spaces
  }

  // "fallback string" — literal string fallback
  const fallbackMatch = pipe.match(/^"([^"]*)"$/);
  if (fallbackMatch) {
    return value != null ? String(value) : fallbackMatch[1];
  }

  return value ?? '';
}

/**
 * Resolve a param that may be a {{recipe.x}} variable reference or a plain value.
 * Returns the raw interpolated string — caller should cast as needed (parseFloat etc.).
 * If the string is EXACTLY a single token (e.g. "{{fileVar}}"), it returns the raw object (File, Array, etc.).
 * If val is not a string or doesn't contain tokens, it is returned as-is.
 */
export function resolveParam(val, context) {
  if (typeof val === 'string' && val.includes('{{')) {
    // Check if it's an exact single token
    const exactMatch = val.trim().match(/^\{\{([^}]+)\}\}$/);
    if (exactMatch) {
      try {
        const rawValue = resolveExpr(exactMatch[1].trim(), context);
        if (rawValue !== null && rawValue !== undefined) {
          return rawValue;
        }
      } catch {
        // Fallthrough to standard string interpolation if it fails
      }
    }
    return interpolate(val, context);
  }
  return val;
}

/**
 * Walk a node params object and resolve any {{...}} variable references against context.
 * Returns a new object with resolved values (numeric-looking strings are cast to numbers).
 */
export function resolveParams(params, context) {
  if (!params) return params;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v.includes('{{')) {
      const resolved = resolveParam(v, context);
      
      // If the original param was a template token and resolved to a string, try to cast
      if (typeof resolved === 'string' && /^\{\{([^}]+)\}\}$/.test(v.trim())) {
        if (resolved === 'true')  { out[k] = true;  continue; }
        if (resolved === 'false') { out[k] = false; continue; }
        const n = Number(resolved);
        if (!isNaN(n) && resolved.trim() !== '') { out[k] = n; continue; }
      }
      out[k] = resolved;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Format a date value (EXIF string "YYYY:MM:DD HH:MM:SS" or epoch) using a simple template.
 * Supported tokens: YYYY, MMMM (full month), MMM (abbrev), MM, DD, D (unpadded), HH, mm, SS
 * Single-pass regex ensures longer tokens (MMMM, DD) are matched before shorter ones (MM, D).
 */
export function formatDateValue(raw, fmt) {
  if (!raw) return '';

  let d;
  if (typeof raw === 'number') {
    d = new Date(raw);
  } else if (typeof raw === 'string') {
    // EXIF format: "2023:06:15 14:30:00"
    const exifNorm = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
    d = new Date(exifNorm);
    if (isNaN(d.getTime())) d = new Date(raw);
  } else {
    return String(raw);
  }

  if (isNaN(d.getTime())) return String(raw);

  const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // Single-pass replace: alternation order ensures MMMM > MMM > MM and DD > D
  return fmt.replace(/YYYY|MMMM|MMM|MM|DD|D|HH|mm|SS/g, token => {
    switch (token) {
      case 'YYYY': return String(d.getFullYear());
      case 'MMMM': return FULL_MONTHS[d.getMonth()];
      case 'MMM':  return MONTHS[d.getMonth()];
      case 'MM':   return String(d.getMonth() + 1).padStart(2, '0');
      case 'DD':   return String(d.getDate()).padStart(2, '0');
      case 'D':    return String(d.getDate());
      case 'HH':   return String(d.getHours()).padStart(2, '0');
      case 'mm':   return String(d.getMinutes()).padStart(2, '0');
      case 'SS':   return String(d.getSeconds()).padStart(2, '0');
    }
  });
}
