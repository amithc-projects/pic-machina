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
 *   {{sidecar.key}}               → reserved (v1.1) — rendered as literal until implemented
 */

const TOKEN_RE = /\{\{([^}]+)\}\}/g;

/**
 * @param {string} template   — string containing {{tokens}}
 * @param {object} context    — { filename, ext, exif, meta, loop, sidecar }
 * @returns {string}
 */
export function interpolate(template, context = {}) {
  if (typeof template !== 'string') return String(template ?? '');

  return template.replace(TOKEN_RE, (_, expr) => {
    try {
      return resolveExpr(expr.trim(), context);
    } catch {
      return `{{${expr}}}`;
    }
  });
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
  if (key === 'filename') return ctx.filename ?? '';
  if (key === 'ext')      return ctx.ext ?? '';

  const [ns, ...rest] = key.split('.');
  const field = rest.join('.');

  if (ns === 'exif' || ns === 'meta') return ctx.exif?.[field] ?? ctx.meta?.[field] ?? null;
  if (ns === 'recipe')  return ctx.recipe?.[field] != null ? String(ctx.recipe[field]) : null;
  if (ns === 'loop')    return `{{loop.${field}}}`;   // v1.2 reserved
  if (ns === 'sidecar') return `{{sidecar.${field}}}`; // v1.1 reserved

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
 * Format a date value (EXIF string "YYYY:MM:DD HH:MM:SS" or epoch) using a simple template.
 * Supported tokens: YYYY, MM, DD, MMM (month abbrev), HH, mm, SS
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

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return fmt
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM',   String(d.getMonth() + 1).padStart(2, '0'))
    .replace('DD',   String(d.getDate()).padStart(2, '0'))
    .replace('MMM',  MONTHS[d.getMonth()])
    .replace('HH',   String(d.getHours()).padStart(2, '0'))
    .replace('mm',   String(d.getMinutes()).padStart(2, '0'))
    .replace('SS',   String(d.getSeconds()).padStart(2, '0'));
}
