export const WIDTH = 900;
export const HEIGHT = 680;
export const GROUND = [8, 11, 14];
// Ember from Kissing Circles; sea glass and pearl from Nautilus.
export const INKS = [[196, 106, 74], [88, 144, 128], [252, 238, 200]];
export const CORNERS = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];
export const OUTER = 17;
export const INNER = 4.2;
export const STROKE = 1.45;

export function plane([u, v]) {
  return [u / 2, v * Math.sqrt(3) / 2];
}

/** Integer vertex identities and shared edges survive every drawing transform. */
export function buildFabric() {
  const vertices = [];
  const byPoint = new Map();
  const edges = [];
  const byEdge = new Map();
  const faces = [];
  function vertex(u, v) {
    const key = `${u},${v}`;
    if (!byPoint.has(key)) {
      byPoint.set(key, vertices.length);
      vertices.push([u, v]);
    }
    return byPoint.get(key);
  }
  for (let q = -16; q <= 16; q += 1) {
    for (let r = -20; r <= 20; r += 1) {
      const centre = [3 * q, 2 * r + q];
      const radius = Math.hypot(...plane(centre));
      if (radius < INNER || radius > OUTER) continue;
      const ids = CORNERS.map(([u, v]) => vertex(centre[0] + u, centre[1] + v));
      const boundary = ids.map((a, i) => {
        const b = ids[(i + 1) % ids.length];
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        if (!byEdge.has(key)) {
          const du = vertices[b][0] - vertices[a][0];
          const dv = vertices[b][1] - vertices[a][1];
          byEdge.set(key, edges.length);
          edges.push({ a, b, colour: dv === 0 ? 0 : du * dv < 0 ? 1 : 2 });
        }
        return byEdge.get(key);
      });
      faces.push({ centre, vertices: ids, edges: boundary });
    }
  }
  return { vertices, edges, faces };
}

/**
 * Strictly increasing radius followed by a radius-dependent rotation and an affine
 * stretch. On the punctured plane this is a homeomorphism: a radius is recovered
 * uniquely, then its angle by subtraction. The finite polylines still need checking.
 */
export function warp([x, y]) {
  const r = Math.hypot(x, y);
  const u = r / 18;
  const radius = 290 * (0.2 * u + 0.8 * u ** 0.55);
  const angle = Math.atan2(y, x) + 1.9 * (1 - u) ** 2 - 0.28;
  return [WIDTH / 2 + 1.19 * radius * Math.cos(angle), HEIGHT / 2 + radius * Math.sin(angle)];
}

export function unwarp([screenX, screenY]) {
  const x = (screenX - WIDTH / 2) / 1.19;
  const y = screenY - HEIGHT / 2;
  const radius = Math.hypot(x, y);
  let lo = 0;
  let hi = 2;
  for (let i = 0; i < 60; i += 1) {
    const u = (lo + hi) / 2;
    if (290 * (0.2 * u + 0.8 * u ** 0.55) < radius) lo = u;
    else hi = u;
  }
  const u = (lo + hi) / 2;
  const angle = Math.atan2(y, x) - 1.9 * (1 - u) ** 2 + 0.28;
  return [18 * u * Math.cos(angle), 18 * u * Math.sin(angle)];
}

/** Every edge uses the same endpoint objects; only its curved interior is sampled. */
export function traceEdges(fabric, subdivisions = 16) {
  const points = fabric.vertices.map((point) => warp(plane(point)));
  return fabric.edges.map((edge) => {
    const a = plane(fabric.vertices[edge.a]);
    const b = plane(fabric.vertices[edge.b]);
    const path = [points[edge.a]];
    for (let i = 1; i < subdivisions; i += 1) {
      const t = i / subdivisions;
      path.push(warp([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]));
    }
    path.push(points[edge.b]);
    return { ...edge, points: path };
  });
}

export function cycleRank(fabric, edges = fabric.edges) {
  const parents = fabric.vertices.map((_, i) => i);
  function root(i) {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  }
  let cycles = 0;
  for (const { a, b } of edges) {
    const ra = root(a);
    const rb = root(b);
    if (ra === rb) cycles += 1;
    else parents[ra] = rb;
  }
  return cycles;
}

/** One opaque stroke per edge: colour is its contribution, never an extra crossing. */
export function drawFabric(context, paths) {
  context.lineWidth = STROKE;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const edge of paths) {
    context.strokeStyle = `rgb(${INKS[edge.colour].join(",")})`;
    context.beginPath();
    context.moveTo(...edge.points[0]);
    for (const point of edge.points.slice(1)) context.lineTo(...point);
    context.stroke();
  }
}
