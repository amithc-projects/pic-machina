// Spherical Mercator Math
export function lon2tile(lon, zoom) {
  return (lon + 180) / 360 * Math.pow(2, zoom);
}

export function lat2tile(lat, zoom) {
  return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
}

export function tile2lon(x, zoom) {
  return x / Math.pow(2, zoom) * 360 - 180;
}

export function tile2lat(y, zoom) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Downloads tiles from OSM for a specified bounding box and zoom level, 
 * stitching them into an OffscreenCanvas map.
 * 
 * @param {Array<{lat: number, lon: number}>} points GPS points
 * @param {number} paddingPixels Extra margin outside the bounding box
 * @param {Function} onLog Callback for progress
 * @returns {Promise<{ canvas: OffscreenCanvas, bbox: object, getLonLatCoords: Function }>}
 */
export async function fetchRenderedMap(points = [], paddingPixels = 200, onLog = null) {
  if (!points || points.length === 0) {
    throw new Error('No GPS coordinate data provided for the map timeline.');
  }

  // Calculate generic bounding box
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  for (const p of points) {
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }

  // Determine a default zoom level. If points are too close, zoom in, else zoom out.
  // Standard zoom ranges from 0 (world) to 19+ (street)
  // We want the entire route to fit within a reasonably sized tile grid.
  // We can calculate the maximum distance in degrees to rough out zoom:
  const lonDiff = Math.max(0.1, maxLon - minLon);
  const latDiff = Math.max(0.1, maxLat - minLat);
  const maxDiff = Math.max(lonDiff, latDiff);
  
  let zoom = 10; // default city-to-city scale
  if (maxDiff > 30) zoom = 3;
  else if (maxDiff > 10) zoom = 5;
  else if (maxDiff > 4)  zoom = 7;
  else if (maxDiff > 1)  zoom = 9;
  else if (maxDiff < 0.2) zoom = 12;

  // Let's get the absolute tile numbers (fractional to encompass exact bounds)
  const txMin = Math.floor(lon2tile(minLon, zoom));
  const txMax = Math.floor(lon2tile(maxLon, zoom));
  const tyMin = Math.floor(lat2tile(maxLat, zoom)); // maxLat is top, which correlates to min Y in mercator
  const tyMax = Math.floor(lat2tile(minLat, zoom));

  // Determine how many tiles we need to render the core area + padding
  // Pad the grid to ensure we have a seamless background for panning
  const mapGridW = (txMax - txMin + 1) + 4; 
  const mapGridH = (tyMax - tyMin + 1) + 4;
  
  onLog?.(`Downloading ${mapGridW * mapGridH} map tiles (Zoom Level: ${zoom})`);
  
  const TILE_SIZE = 256;
  const cWidth = mapGridW * TILE_SIZE;
  const cHeight = mapGridH * TILE_SIZE;
  
  // Use a fallback offscreen canvas
  let canvas;
  try {
    canvas = new OffscreenCanvas(cWidth, cHeight);
  } catch(e) {
    canvas = document.createElement('canvas');
    canvas.width = cWidth; canvas.height = cHeight;
  }
  const ctx = canvas.getContext('2d');
  
  // Base background (OSM water color or simple gray)
  ctx.fillStyle = '#aad3df';
  ctx.fillRect(0, 0, cWidth, cHeight);

  const tilePromises = [];
  
  const startX = txMin - 2;
  const startY = tyMin - 2;

  for (let x = 0; x < mapGridW; x++) {
    for (let y = 0; y < mapGridH; y++) {
      const gX = startX + x;
      const gY = startY + y;
      const url = `https://tile.openstreetmap.org/${zoom}/${gX}/${gY}.png`;
      
      const p = fetch(url, { headers: { 'User-Agent': 'PicMachina/1.0' }})
        .then(res => res.blob())
        .then(blob => createImageBitmap(blob))
        .then(bmp => {
           ctx.drawImage(bmp, x * TILE_SIZE, y * TILE_SIZE);
           bmp.close?.();
        })
        .catch(err => console.warn(`Tile ${gX}/${gY} failed to load`, err));
        
      tilePromises.push(p);
    }
  }

  await Promise.allSettled(tilePromises);
  onLog?.(`Map tiles rendered successfully (${mapGridW * mapGridH} tiles).`);

  // Helper factory to get [X, Y] absolute pixel coordinates on this generated canvas
  // given a GPS lat/lon.
  const getPixelCoordsForLonLat = (lon, lat) => {
    const absTileX = lon2tile(lon, zoom);
    const absTileY = lat2tile(lat, zoom);
    
    // Relative to the generated grid
    const relTileX = absTileX - startX;
    const relTileY = absTileY - startY;
    
    return {
      x: relTileX * TILE_SIZE,
      y: relTileY * TILE_SIZE
    };
  };

  return {
    canvas,
    zoom,
    getPixelCoordsForLonLat
  };
}
