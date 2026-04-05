/**
 * PicMachina — Perspective Rendering Utilities
 */

/**
 * Render one affine-mapped triangle from source space to destination space.
 *
 * s0/s1/s2 are source corners in source-image pixels.
 * d0/d1/d2 are destination corners in canvas pixels.
 *
 * The canvas 2D transform convention:
 *   x' = ta·x + tc·y + te
 *   y' = tb·x + td·y + tf
 *
 * We solve for [ta,tb,tc,td,te,tf] such that si → di for i ∈ {0,1,2}.
 */
export function drawAffineTriangle(ctx, source, sw, sh, s0, s1, s2, d0, d1, d2) {
  const dx1 = s1.x - s0.x, dy1 = s1.y - s0.y;
  const dx2 = s2.x - s0.x, dy2 = s2.y - s0.y;
  const det = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(det) < 1e-6) return; // degenerate triangle

  const ex1 = d1.x - d0.x, ey1 = d1.y - d0.y;
  const ex2 = d2.x - d0.x, ey2 = d2.y - d0.y;

  const ta = ( dy2 * ex1 - dy1 * ex2) / det;
  const tb = ( dy2 * ey1 - dy1 * ey2) / det;
  const tc = (-dx2 * ex1 + dx1 * ex2) / det;
  const td = (-dx2 * ey1 + dx1 * ey2) / det;
  const te =  d0.x - ta * s0.x - tc * s0.y;
  const tf =  d0.y - tb * s0.x - td * s0.y;

  ctx.save();
  // Clip to destination triangle (screen-space)
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();
  // Apply the source→screen affine transform, then draw the full source
  ctx.transform(ta, tb, tc, td, te, tf);
  ctx.drawImage(source, 0, 0, sw, sh);
  ctx.restore();
}

/**
 * Draw a VideoFrame (or ImageBitmap) into an arbitrary convex quadrilateral using bilinear
 * mesh subdivision. Each sub-quad is rendered as two affine-mapped triangles.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {VideoFrame|ImageBitmap}   source
 * @param {{x,y}[]}                  quad   — [TL, TR, BR, BL] in canvas pixels
 * @param {number}                   [N=12] — subdivisions per axis
 */
export function drawPerspectiveCell(ctx, source, quad, N = 12) {
  const [TL, TR, BR, BL] = quad;
  const sw = source.displayWidth  ?? source.codedWidth  ?? source.width;
  const sh = source.displayHeight ?? source.codedHeight ?? source.height;

  // Bilinear interpolation: (u,v) in [0,1]² → canvas point
  const bilerp = (u, v) => ({
    x: (1 - v) * ((1 - u) * TL.x + u * TR.x) + v * ((1 - u) * BL.x + u * BR.x),
    y: (1 - v) * ((1 - u) * TL.y + u * TR.y) + v * ((1 - u) * BL.y + u * BR.y),
  });

  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const u0 = col / N,       v0 = row / N;
      const u1 = (col + 1) / N, v1 = (row + 1) / N;

      // Destination corners (canvas pixels)
      const d00 = bilerp(u0, v0), d10 = bilerp(u1, v0);
      const d11 = bilerp(u1, v1), d01 = bilerp(u0, v1);

      // Source corners (source-image pixels)
      const s00 = { x: u0 * sw, y: v0 * sh };
      const s10 = { x: u1 * sw, y: v0 * sh };
      const s11 = { x: u1 * sw, y: v1 * sh };
      const s01 = { x: u0 * sw, y: v1 * sh };

      // Upper-left triangle of the sub-quad
      drawAffineTriangle(ctx, source, sw, sh, s00, s10, s11, d00, d10, d11);
      // Lower-right triangle
      drawAffineTriangle(ctx, source, sw, sh, s00, s11, s01, d00, d11, d01);
    }
  }
}
