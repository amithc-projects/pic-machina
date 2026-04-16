/**
 * Utility for processing images for thumbnails and covers.
 */

/**
 * Resize a File/Blob to a small JPEG and return both Data URL and Blob.
 * @param {File|Blob} file
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @returns {Promise<{dataUrl: string, blob: Blob}>}
 */
export async function processImageThumbnail(file, maxWidth = 480, maxHeight = 300) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  
  // Fill background with white (for transparent PNGs converted to JPEG)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));

  return { dataUrl, blob };
}
