const CHILD_COUNT = 3;
const ANGLE_STEP = Math.PI * 2 / CHILD_COUNT;

function pointAround(center, distance, index) {
  const angle = index * ANGLE_STEP;
  return {
    x: center.x + distance * Math.cos(angle),
    y: center.y + distance * Math.sin(angle)
  };
}

/**
 * Builds the self-similar tree. Halving the radius on every generation guarantees
 * termination at minimumRadius, and placing each child one child-radius away from the
 * parent centre makes the child's outward vertex land exactly on the parent's vertex.
 */
export function buildGasket(center, radius, minimumRadius) {
  const childRadius = radius / 2;
  const children = radius > minimumRadius
    ? Array.from(
      { length: CHILD_COUNT },
      (unused, index) => buildGasket(
        pointAround(center, childRadius, index),
        childRadius,
        minimumRadius
      )
    )
    : [];
  return { center, radius, children };
}

function triangleOf(node) {
  return Array.from(
    { length: CHILD_COUNT },
    (unused, index) => pointAround(node.center, node.radius, index)
  );
}

/**
 * Walks the finished tree iteratively and returns one vertex triple per node, in the
 * pre-order the Processing sketch draws them.
 */
export function flattenTriangles(gasket) {
  const triangles = [];
  const pending = [gasket];
  while (pending.length > 0) {
    const node = pending.pop();
    triangles.push(triangleOf(node));
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]);
    }
  }
  return triangles;
}

export function countTriangles(gasket) {
  return flattenTriangles(gasket).length;
}

/**
 * Axis-aligned bounds of every triangle. The root is anchored on its circumcentre, which
 * sits a quarter radius right of the bounding box centre, so callers need this to place
 * the figure rather than the anchor point.
 */
export function boundingBox(gasket) {
  const vertices = flattenTriangles(gasket).flat();
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  };
}

/** Generation count including the root, so a childless root has depth 1. */
export function gasketDepth(gasket) {
  let depth = 0;
  let node = gasket;
  while (node) {
    depth += 1;
    node = node.children[0];
  }
  return depth;
}

/** The three vertices a node's triangle stands on, outward past its children. */
export function triangleVertices(center, radius) {
  return Array.from({ length: CHILD_COUNT }, (unused, index) =>
    pointAround(center, radius, index));
}

function sameSide(point, from, to, reference) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return cross(from, to, point) * cross(from, to, reference) >= 0;
}

export function pointInTriangle(point, vertices) {
  const [a, b, c] = vertices;
  return sameSide(point, a, b, c) && sameSide(point, b, c, a) && sameSide(point, c, a, b);
}

/**
 * How many generations down the tree a point can be followed, each step into the one
 * child triangle that holds it. A point of the true gasket can be followed to the
 * tree's whole depth; a point of the removed middles is orphaned within a level or
 * two. This is what lets the chaos game be checked against the built skeleton: the
 * two constructions never mention each other, and agree anyway.
 */
export function deepestContainment(gasket, point) {
  if (!pointInTriangle(point, triangleVertices(gasket.center, gasket.radius))) {
    return -1;
  }
  let depth = 0;
  let node = gasket;
  while (node.children.length > 0) {
    const next = node.children.find((child) =>
      pointInTriangle(point, triangleVertices(child.center, child.radius)));
    if (!next) {
      return depth;
    }
    node = next;
    depth += 1;
  }
  return depth;
}

/**
 * The chaos game: from anywhere, jump halfway to a randomly chosen vertex of the root
 * triangle, forever. No rule mentions the gasket; the rain simply cannot land
 * anywhere else. Twenty burnt-in jumps bring the wanderer within a hair of the
 * attractor before a single point is kept.
 */
export function chaosPoints(center, radius, count, random) {
  const vertices = triangleVertices(center, radius);
  let x = center.x;
  let y = center.y;
  const points = [];
  const burnIn = 20;
  for (let step = 0; step < count + burnIn; step += 1) {
    const vertex = vertices[Math.floor(random() * CHILD_COUNT) % CHILD_COUNT];
    x = (x + vertex.x) / 2;
    y = (y + vertex.y) / 2;
    if (step >= burnIn) {
      points.push({ x, y });
    }
  }
  return points;
}

/**
 * The deepest triangles, in the order their addresses count up in base three: a cell's
 * index is the path taken to reach it, child by child from the root. This is the order
 * deepestCellOf answers in, so its number indexes straight into this list.
 */
export function deepestCells(gasket) {
  const cells = [];
  (function walk(node) {
    if (node.children.length === 0) {
      cells.push({ center: node.center, radius: node.radius });
      return;
    }
    for (const child of node.children) {
      walk(child);
    }
  })(gasket);
  return cells;
}

/**
 * Which deepest cell a point falls in, or -1 for one that cannot be followed all the
 * way down. This is deepestContainment's answer turned from a depth into an address:
 * the rain needs to know not how far it got but exactly which triangle it wet.
 */
export function deepestCellOf(gasket, point) {
  if (!pointInTriangle(point, triangleVertices(gasket.center, gasket.radius))) {
    return -1;
  }
  let node = gasket;
  let index = 0;
  while (node.children.length > 0) {
    const child = node.children.findIndex((candidate) =>
      pointInTriangle(point, triangleVertices(candidate.center, candidate.radius)));
    if (child === -1) {
      return -1;
    }
    index = index * CHILD_COUNT + child;
    node = node.children[child];
  }
  return index;
}

/**
 * What the rain does to the figure, landing by landing: the cell each drop wets, and
 * whether it is the first drop ever to wet it. Nothing here chooses where to fall —
 * the landings are the chaos game's own — so the wetting is a reading of the rain
 * rather than a second rain drawn on top of it.
 */
export function wetting(gasket, points) {
  const seen = new Map();
  return points.map((point) => {
    const cell = deepestCellOf(gasket, point);
    if (cell === -1) {
      // A landing on a shared edge cannot be followed to one cell, so it wets none.
      return { cell, first: false, hits: 0 };
    }
    const before = seen.get(cell) ?? 0;
    seen.set(cell, before + 1);
    return { cell, first: before === 0, hits: before + 1 };
  });
}

/**
 * The clip's plan, in frames at thirty a second: the skeleton built level by level,
 * then the rain, then the whole held still.
 */
export const BUILD_FRAMES = 105;
export const RAIN_FRAMES = 165;
export const HOLD_FRAMES = 30;
export const TOTAL_FRAMES = BUILD_FRAMES + RAIN_FRAMES + HOLD_FRAMES;
export const RAIN_POINTS = 3200;
export const RAIN_SEED = 7;

/**
 * The weather, in frames and in landings.
 *
 * Every one of the three thousand two hundred landings wets its cell — that is the
 * evidence and it is not thinned. What is thinned is how many are drawn falling: at
 * nineteen and a third landings a frame, drawing them all is a downpour with no
 * separate drops in it, and the instruction was that the rain should drip. One in
 * DROP_STRIDE is drawn on its way down, which is the rate a viewer reads as drops;
 * the volume of the rain is carried by the film instead.
 */
export const DROP_FRAMES = 8;
export const DROP_STRIDE = 8;
export const RIPPLE_FRAMES = 6;
/** Landings after which a cell is as wet as it gets. The mean cell takes 4.44. */
export const FILM_SATURATION = 5;

/** The frame a landing happens on, which the accumulation has always counted by. */
export function landingFrameOf(index) {
  return BUILD_FRAMES + ((index + 1) * RAIN_FRAMES) / RAIN_POINTS;
}

/** How many landings have happened by a frame. */
export function fallenAt(frameIndex) {
  const share = (frameIndex - BUILD_FRAMES) / RAIN_FRAMES;
  return Math.min(Math.max(Math.floor(share * RAIN_POINTS), 0), RAIN_POINTS);
}

/** Whether this landing is one of the ones drawn falling. */
export function isDrawnFalling(index) {
  return index % DROP_STRIDE === 0;
}

/**
 * How far through its fall a drawn drop is, from 0 when it is released to 1 at its
 * landing, or null when it is not in the air on this frame. It is released
 * DROP_FRAMES before it lands, so the landing sequence itself is untouched.
 */
export function dropFallAt(index, frameIndex) {
  const progress = (frameIndex - landingFrameOf(index) + DROP_FRAMES) / DROP_FRAMES;
  return progress >= 0 && progress < 1 ? progress : null;
}

/** How far a ring has opened, 0 to 1, or null when it is not ringing on this frame. */
export function rippleAt(index, frameIndex) {
  const progress = (frameIndex - landingFrameOf(index)) / RIPPLE_FRAMES;
  return progress >= 0 && progress < 1 ? progress : null;
}
