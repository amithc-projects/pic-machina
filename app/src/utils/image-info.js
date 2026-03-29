/**
 * ImageChef — Image Info / Metadata utility
 *
 * Extracts image dimensions + full EXIF/XMP/IPTC metadata from a File or Blob.
 * Provides a renderer that returns a styled info panel HTML element.
 */

// Well-known EXIF tag groups for organised display
const CAMERA_TAGS = new Set([
  'Make','Model','LensModel','LensMake','LensSpecification',
  'BodySerialNumber','CameraOwnerName','Software',
]);
const CAPTURE_TAGS = new Set([
  'DateTimeOriginal','DateTime','DateTimeDigitized','OffsetTimeOriginal',
  'ExposureTime','FNumber','ISOSpeedRatings','FocalLength','FocalLengthIn35mmFilm',
  'Flash','WhiteBalance','ExposureBiasValue','ExposureProgram','ExposureMode',
  'MeteringMode','SceneCaptureType','SubjectDistance','BrightnessValue',
  'SensitivityType','RecommendedExposureIndex','ShutterSpeedValue','ApertureValue',
]);
const META_TAGS = new Set([
  'Artist','Copyright','ImageDescription','UserComment',
]);
const GPS_DISPLAY_KEYS = new Set([
  'Latitude','Longitude','Altitude','GPSSpeed','GPSImgDirection',
  'GPSDateStamp','GPSTimeStamp',
]);

function formatBytes(b) {
  if (b == null) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * Extract all metadata from a File/Blob.
 * Returns a structured info object.
 */
export async function getImageInfo(file) {
  const info = {
    filename: file.name,
    fileSize: file.size,
    mimeType: file.type || '',
    width:    null,
    height:   null,
    camera:   {},  // make, model, lens, software
    capture:  {},  // exposure, iso, aperture, date, etc.
    meta:     {},  // artist, copyright, description
    gps:      null,// { lat, lng, altitude? }
    gpsRaw:   {},  // all GPS tags
    exifOther:{},  // everything else in exif
    xmp:      {},
    iptc:     {},
  };

  // Dimensions via ImageBitmap (works for JPEG, PNG, WebP, etc.)
  try {
    const bmp = await createImageBitmap(file);
    info.width  = bmp.width;
    info.height = bmp.height;
    bmp.close?.();
  } catch {}

  // Full EXIF via ExifReader
  try {
    const ExifReader = (await import('exifreader')).default;
    const buf  = await file.arrayBuffer();
    const tags = ExifReader.load(buf, { expanded: true });

    // Fallback dimensions from file header tags
    if (!info.width  && tags.file?.['Image Width']?.value)  info.width  = tags.file['Image Width'].value;
    if (!info.height && tags.file?.['Image Height']?.value) info.height = tags.file['Image Height'].value;
    if (!info.mimeType && tags.file?.['MIME Type']?.description) info.mimeType = tags.file['MIME Type'].description;

    // Parse EXIF section
    if (tags.exif) {
      for (const [key, tag] of Object.entries(tags.exif)) {
        const val = tag?.description ?? tag?.value;
        if (val == null || val === '') continue;
        const str = String(val);
        if (CAMERA_TAGS.has(key))       info.camera[key]    = str;
        else if (CAPTURE_TAGS.has(key)) info.capture[key]   = str;
        else if (META_TAGS.has(key))    info.meta[key]      = str;
        else                            info.exifOther[key] = str;
      }
    }

    // GPS
    if (tags.gps) {
      const g = tags.gps;
      if (g.Latitude != null && g.Longitude != null) {
        info.gps = { lat: g.Latitude, lng: g.Longitude };
        if (g.Altitude != null) info.gps.altitude = g.Altitude;
      }
      for (const [key, tag] of Object.entries(g)) {
        if (GPS_DISPLAY_KEYS.has(key)) {
          const val = tag?.description ?? tag?.value ?? tag;
          if (val != null) info.gpsRaw[key] = String(val);
        }
      }
    }

    // XMP
    if (tags.xmp) {
      for (const [key, tag] of Object.entries(tags.xmp)) {
        const val = tag?.description ?? tag?.value;
        if (val != null && val !== '') info.xmp[key] = String(val);
      }
    }

    // IPTC
    if (tags.iptc) {
      for (const [key, tag] of Object.entries(tags.iptc)) {
        const val = tag?.description ?? tag?.value;
        if (val != null && val !== '') info.iptc[key] = String(val);
      }
    }
  } catch {}

  return info;
}

/**
 * Returns a DOM element containing a formatted metadata panel.
 * Inject injectImageInfoStyles() once before using.
 */
export function renderImageInfoPanel(info) {
  const el = document.createElement('div');
  el.className = 'img-info-panel';

  const ext = info.filename
    ? info.filename.slice(info.filename.lastIndexOf('.') + 1).toUpperCase()
    : '';
  const fmt = info.mimeType || ext || '—';

  // File section (always shown)
  const basicRows = [
    ['Filename',   info.filename || '—'],
    ['Format',     fmt],
    ['File Size',  formatBytes(info.fileSize)],
    ['Dimensions', info.width && info.height ? `${info.width} × ${info.height} px` : '—'],
  ];
  el.appendChild(buildSection('File', basicRows));

  // Camera
  if (Object.keys(info.camera).length) {
    el.appendChild(buildSection('Camera', Object.entries(info.camera)));
  }

  // Capture settings
  if (Object.keys(info.capture).length) {
    el.appendChild(buildSection('Capture Settings', Object.entries(info.capture)));
  }

  // Author / rights
  if (Object.keys(info.meta).length) {
    el.appendChild(buildSection('Author / Rights', Object.entries(info.meta)));
  }

  // GPS
  if (info.gps) {
    const gpsRows = [
      ['Latitude',  info.gps.lat.toFixed(6) + '°'],
      ['Longitude', info.gps.lng.toFixed(6) + '°'],
    ];
    if (info.gps.altitude != null) gpsRows.push(['Altitude', info.gps.altitude.toFixed(1) + ' m']);
    Object.entries(info.gpsRaw).forEach(([k, v]) => {
      if (!['Latitude','Longitude','Altitude'].includes(k)) gpsRows.push([k, v]);
    });
    el.appendChild(buildSection('GPS', gpsRows));
  }

  // Other EXIF
  if (Object.keys(info.exifOther).length) {
    el.appendChild(buildSection('EXIF (Other)', Object.entries(info.exifOther), true));
  }

  // XMP
  if (Object.keys(info.xmp).length) {
    el.appendChild(buildSection('XMP', Object.entries(info.xmp), true));
  }

  // IPTC
  if (Object.keys(info.iptc).length) {
    el.appendChild(buildSection('IPTC', Object.entries(info.iptc), true));
  }

  // No metadata at all
  const hasMeta = Object.keys(info.camera).length + Object.keys(info.capture).length +
    Object.keys(info.meta).length + Object.keys(info.exifOther).length +
    Object.keys(info.xmp).length + Object.keys(info.iptc).length + (info.gps ? 1 : 0);
  if (!hasMeta) {
    const note = document.createElement('div');
    note.className = 'img-info-empty';
    note.textContent = 'No embedded metadata found in this file.';
    el.appendChild(note);
  }

  return el;
}

function buildSection(title, rows, collapsible = false) {
  const sec = document.createElement('details');
  sec.className = 'img-info-section';
  if (!collapsible) sec.open = true;

  const summary = document.createElement('summary');
  summary.className = 'img-info-section-title';
  summary.textContent = title;
  sec.appendChild(summary);

  const table = document.createElement('table');
  table.className = 'img-info-table';
  for (const [k, v] of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="img-info-key">${escHtml(k)}</td><td class="img-info-val">${escHtml(v)}</td>`;
    table.appendChild(tr);
  }
  sec.appendChild(table);
  return sec;
}

let _infoStyles = false;
export function injectImageInfoStyles() {
  if (_infoStyles) return;
  _infoStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .img-info-panel {
      overflow-y:auto; height:100%; padding:8px 0;
      font-size:12px; color:var(--ps-text);
    }
    .img-info-section {
      border-bottom:1px solid var(--ps-border);
    }
    .img-info-section-title {
      display:flex; align-items:center; gap:6px;
      padding:7px 14px; font-size:11px; font-weight:600;
      text-transform:uppercase; letter-spacing:.06em;
      color:var(--ps-text-faint); cursor:pointer;
      user-select:none; list-style:none;
    }
    .img-info-section-title::-webkit-details-marker { display:none; }
    .img-info-section-title::after {
      content:'expand_more'; font-family:'Material Symbols Outlined';
      font-size:14px; margin-left:auto; color:var(--ps-text-faint);
      transition:transform 200ms;
    }
    details[open] > .img-info-section-title::after { transform:rotate(180deg); }
    details[open] > .img-info-section-title { color:var(--ps-text-muted); }
    .img-info-table { width:100%; border-collapse:collapse; padding:0 14px 8px; display:block; }
    .img-info-table tr:hover td { background:var(--ps-bg-hover); }
    .img-info-key {
      padding:3px 8px 3px 14px; color:var(--ps-text-faint);
      font-family:var(--font-mono); font-size:10.5px; white-space:nowrap;
      width:40%; vertical-align:top;
    }
    .img-info-val {
      padding:3px 14px 3px 4px; color:var(--ps-text);
      font-family:var(--font-mono); font-size:10.5px;
      word-break:break-word; vertical-align:top;
    }
    .img-info-empty {
      padding:16px 14px; color:var(--ps-text-faint); font-size:12px; font-style:italic;
    }
  `;
  document.head.appendChild(s);
}
