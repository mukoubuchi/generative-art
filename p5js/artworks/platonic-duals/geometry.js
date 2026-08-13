/**
 * The icosahedron, the dodecahedron, and the operation that turns each into the other.
 *
 * Dualizing a solid stands a vertex on the centre of every face: the icosahedron's
 * twenty faces become the dodecahedron's twenty vertices, its twelve vertices become
 * twelve pentagons, and the thirty edges answer the thirty edges, each new edge crossing
 * the old one it came from at a right angle. Dualize again and the original returns —
 * same vertex directions exactly — only smaller, by the square of the inradius over the
 * circumradius. That the shrink is the *square* of one ratio is the artwork's quiet
 * theorem: the icosahedron and the dodecahedron, alone among their siblings, share the
 * same inradius-to-circumradius ratio, so the two steps of the round trip cost exactly
 * the same, and a clip that dualizes forever can zoom at one constant rate and never
 * show a seam. The tests measure all of it from the solids rather than from formulas.
 *
 * A solid here is `{ vertices, faces }`: vertices as [x, y, z], faces as cycles of
 * vertex indices wound so their normals point outward.
 */

export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

function scale(a, factor) {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

export function centroidOf(points) {
  const sum = points.reduce(
    (total, point) => [total[0] + point[0], total[1] + point[1], total[2] + point[2]],
    [0, 0, 0]
  );
  return scale(sum, 1 / points.length);
}

/**
 * The icosahedron on its classical coordinates — the cyclic permutations of
 * (0, ±1, ±φ) — normalized to circumradius 1 so every later scale is a plain number.
 */
export function icosahedronVertices() {
  const phi = GOLDEN_RATIO;
  const raw = [];
  for (const one of [-1, 1]) {
    for (const big of [-phi, phi]) {
      raw.push([0, one, big], [one, big, 0], [big, 0, one]);
    }
  }
  const radius = Math.hypot(1, GOLDEN_RATIO);
  return raw.map((vertex) => scale(vertex, 1 / radius));
}

/** Every unordered pair of vertices at the solid's shortest pairwise distance. */
export function shortestPairs(vertices) {
  let shortest = Infinity;
  for (let a = 0; a < vertices.length; a += 1) {
    for (let b = a + 1; b < vertices.length; b += 1) {
      shortest = Math.min(shortest, length(subtract(vertices[a], vertices[b])));
    }
  }
  const pairs = [];
  for (let a = 0; a < vertices.length; a += 1) {
    for (let b = a + 1; b < vertices.length; b += 1) {
      if (length(subtract(vertices[a], vertices[b])) < shortest * (1 + 1e-9)) {
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

/** A face cycle rewound, if needed, so its normal points away from the origin. */
function windOutward(vertices, face) {
  const [a, b, c] = face.map((index) => vertices[index]);
  const normal = cross(subtract(b, a), subtract(c, a));
  return dot(normal, centroidOf(face.map((index) => vertices[index]))) > 0
    ? face
    : [...face].reverse();
}

/**
 * The icosahedron as a solid. Its faces are exactly the triangles of nearest
 * neighbours: every 3-clique of the edge graph is a face, and there are twenty.
 */
export function icosahedron() {
  const vertices = icosahedronVertices();
  const edges = shortestPairs(vertices);
  const adjacent = vertices.map(() => new Set());
  for (const [a, b] of edges) {
    adjacent[a].add(b);
    adjacent[b].add(a);
  }
  const faces = [];
  for (const [a, b] of edges) {
    for (const c of adjacent[a]) {
      if (c > b && adjacent[b].has(c)) {
        faces.push(windOutward(vertices, [a, b, c]));
      }
    }
  }
  return { vertices, faces };
}

/** The unordered edge pairs a solid's face cycles trace. */
export function edgesOf(solid) {
  const seen = new Set();
  const edges = [];
  for (const face of solid.faces) {
    for (let step = 0; step < face.length; step += 1) {
      const a = face[step];
      const b = face[(step + 1) % face.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push(a < b ? [a, b] : [b, a]);
      }
    }
  }
  return edges;
}

/**
 * The dual: one vertex on the centre of every face, one face around every vertex.
 *
 * The new face for an old vertex collects the centres of the faces that met there,
 * ordered by angle around the vertex's own direction — the vertex looks along its
 * radius and sees them as a ring — and wound outward like every other face.
 */
export function dualOf(solid) {
  const centres = solid.faces.map((face) =>
    centroidOf(face.map((index) => solid.vertices[index]))
  );
  const faces = solid.vertices.map((vertex, vertexIndex) => {
    const around = [];
    solid.faces.forEach((face, faceIndex) => {
      if (face.includes(vertexIndex)) {
        around.push(faceIndex);
      }
    });
    // Two directions spanning the plane the ring is seen against.
    const axis = scale(vertex, 1 / length(vertex));
    const seed = subtract(centres[around[0]], scale(axis, dot(centres[around[0]], axis)));
    const east = scale(seed, 1 / length(seed));
    const north = cross(axis, east);
    around.sort((first, second) => {
      const angleOf = (faceIndex) => {
        const centre = centres[faceIndex];
        return Math.atan2(dot(centre, north), dot(centre, east));
      };
      return angleOf(first) - angleOf(second);
    });
    return windOutward(centres, around);
  });
  return { vertices: centres, faces };
}

/** Circumradius and inradius, measured — no formulas, so the tests can bring their own. */
export function circumradiusOf(solid) {
  return Math.max(...solid.vertices.map(length));
}

export function inradiusOf(solid) {
  return Math.min(
    ...solid.faces.map((face) =>
      length(centroidOf(face.map((index) => solid.vertices[index])))
    )
  );
}
