/**
 * ImageChef — Face Mesh Triangulation
 *
 * Reconstructs the exact internal triangle mesh from MediaPipe's
 * FACE_LANDMARKS_TESSELATION edge list.
 */

let _cachedTriangles = null;

export async function getFaceMeshTriangles() {
  if (_cachedTriangles) return _cachedTriangles;

  const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
  
  // MediaPipe provides edges, not triangles. We must find all 3-cliques.
  const edges = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
  const adj = Array.from({ length: 478 }, () => new Set());
  
  for (const { start, end } of edges) {
    adj[start].add(end);
    adj[end].add(start);
  }

  const triangles = [];
  const seen = new Set();

  for (let u = 0; u < 478; u++) {
    for (const v of adj[u]) {
      if (v > u) {
        for (const w of adj[v]) {
          if (w > v && adj[u].has(w)) {
            const key = `${u},${v},${w}`;
            if (!seen.has(key)) {
              seen.add(key);
              triangles.push([u, v, w]);
            }
          }
        }
      }
    }
  }

  _cachedTriangles = triangles;
  return triangles;
}
