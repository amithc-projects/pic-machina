/**
 * ImageChef — EXIF / metadata reader
 * Wraps ExifReader to extract date, GPS, dimensions, and common fields.
 */

/**
 * @param {File|Blob} fileOrBlob
 * @returns {Promise<{ date, gps, faceCount, artist, copyright, description, [key]: any }>}
 */
export async function extractExif(fileOrBlob) {
  try {
    const ExifReader = (await import('exifreader')).default;
    const buffer = await fileOrBlob.arrayBuffer();
    const tags   = ExifReader.load(buffer, { expanded: true });
    const result = {};

    // Date
    const dateTag = tags.exif?.DateTimeOriginal || tags.exif?.DateTime || tags.xmp?.CreateDate;
    if (dateTag?.description) result.date = dateTag.description;

    // GPS
    const gps = tags.gps;
    if (gps?.Latitude != null && gps?.Longitude != null) {
      result.gps = {
        lat: gps.Latitude,
        lng: gps.Longitude,
      };
    }

    // Author / copyright
    if (tags.exif?.Artist?.description)             result.author    = tags.exif.Artist.description;
    if (tags.exif?.Copyright?.description)          result.copyright = tags.exif.Copyright.description;
    if (tags.exif?.ImageDescription?.description)   result.description = tags.exif.ImageDescription.description;
    if (tags.exif?.Make?.description)               result.cameraMake  = tags.exif.Make.description;
    if (tags.exif?.Model?.description)              result.cameraModel = tags.exif.Model.description;
    if (tags.exif?.ExposureTime?.description)       result.exposure    = tags.exif.ExposureTime.description;
    if (tags.exif?.FNumber?.description)            result.aperture    = tags.exif.FNumber.description;
    if (tags.exif?.ISOSpeedRatings?.description)    result.iso         = tags.exif.ISOSpeedRatings.description;
    if (tags.exif?.FocalLength?.description)        result.focalLength = tags.exif.FocalLength.description;

    return result;
  } catch (err) {
    // Not all images have EXIF — this is normal
    return {};
  }
}

/**
 * Format a raw EXIF date string (YYYY:MM:DD HH:MM:SS) → Date object.
 */
export function parseExifDate(raw) {
  if (!raw) return null;
  const norm = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const d = new Date(norm);
  return isNaN(d.getTime()) ? null : d;
}
