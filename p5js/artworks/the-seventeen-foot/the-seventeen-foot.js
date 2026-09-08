/**
 * Theodorus's roots, each in its turn, up to the seventeen-foot: sixteen right triangles on
 * one origin, a seventeenth that comes as far as crossing the opening side and goes back.
 *
 * Plato's sentence has Theodorus selecting the roots one by one as far as the seventeen-foot
 * and somehow stopping there. The figure that puts each new unit outward at a right angle to
 * the radius just drawn is this project's construction: the dialogue names the roots and the
 * stop and nothing else. What the construction measures for itself is that the turn passes a
 * full circle between the seventeenth radius and the eighteenth, so the seventeenth triangle
 * is the first whose radius crosses the opening unit side. The clip shows that crossing and
 * the retreat from it, and gives no reason: none is in the text.
 */

export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 10;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/** Sixteen triangles take the radius from one to the square root of seventeen. */
export const TRIANGLE_COUNT = 16;
export const LAST_RADIUS = TRIANGLE_COUNT + 1;
/** The intruder: the seventeenth triangle, whose new vertex is the square root of eighteen. */
export const INTRUDER = TRIANGLE_COUNT + 1;
export const INTRUDER_RADIUS = INTRUDER + 1;
export const ORIGIN = Object.freeze([0, 0]);

/**
 * The clip: the sixteen laid one after another, a rest, the seventeenth arriving along its
 * unit side, a stay across the opening side, the retreat, the sixteen at rest, and the
 * dissolve back to the empty ground the clip opens on.
 */
export const ACTS = Object.freeze([
  ["lay", 160], ["rest", 12], ["cross", 24], ["crossed", 12], ["retreat", 24], ["hold", 38], ["dissolve", 30]
].map(([name, frames]) => Object.freeze({ name, frames })));

const CLOSE = 1e-12;
const TWO_PI = 2 * Math.PI;

function assertInteger(value, label) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer.`);
  }
}

/**
 * Vertex `index` of the spiral, 1-based: the point at distance √index from the origin. Each
 * step adds a unit perpendicular to the current radius, so the new triangle is right-angled
 * at the previous vertex and the squared radius rises by exactly one.
 */
export function vertexAt(index) {
  assertInteger(index, "A vertex index");
  if (index < 1) {
    throw new RangeError("Vertices are numbered from the unit foot.");
  }
  let x = 1;
  let y = 0;
  for (let step = 1; step < index; step += 1) {
    const radius = Math.hypot(x, y);
    const nextX = x - y / radius;
    const nextY = y + x / radius;
    x = nextX;
    y = nextY;
  }
  return [x, y];
}

/** The eighteen vertices the clip has any use for: the seventeen roots and the intruder's. */
export const VERTICES = Object.freeze(
  Array.from({ length: INTRUDER_RADIUS }, (unused, index) => Object.freeze(vertexAt(index + 1)))
);

/**
 * The angle turned from the unit foot to vertex `index`, accumulated step by step: the sum
 * of atan(1/√k) for k below the index. `atan2` of the vertex itself wraps into (−π, π] and
 * cannot tell a full turn from a return to the opening ray.
 */
export function bearingAt(index) {
  assertInteger(index, "A vertex index");
  if (index < 1) {
    throw new RangeError("Vertices are numbered from the unit foot.");
  }
  let angle = 0;
  for (let step = 1; step < index; step += 1) {
    angle += Math.atan(1 / Math.sqrt(step));
  }
  return angle;
}

/** Whether a whole number is a square, decided in whole numbers. */
export function isSquare(value) {
  assertInteger(value, "A radius index");
  if (value < 0) return false;
  const root = Math.round(Math.sqrt(value));
  return root * root === value;
}

/** The radii that are a whole number of the unit foot: the squares up to seventeen. */
export const COMMENSURABLE_RADII = Object.freeze(
  Array.from({ length: LAST_RADIUS }, (unused, index) => index + 1).filter(isSquare)
);

/**
 * The first radius to pass a full turn, found by counting: the smallest index whose bearing
 * exceeds 2π. The two margins are how far short the radius before it stands and how far
 * over this one goes.
 */
export const FIRST_PAST_THE_TURN = (() => {
  let index = 1;
  while (bearingAt(index) <= TWO_PI) index += 1;
  return index;
})();
export const TURN_SHORT = TWO_PI - bearingAt(FIRST_PAST_THE_TURN - 1);
export const OVERRUN = bearingAt(FIRST_PAST_THE_TURN) - TWO_PI;
/**
 * The same overrun read off the vertex itself, the angle of the eighteenth radius above the
 * opening ray. It agrees with the summed bearing to the last few places; the light is
 * measured against this one so that a fully arrived intruder lights the crossing exactly.
 */
export const OVERRUN_OF_THE_VERTEX = Math.atan2(VERTICES[INTRUDER_RADIUS - 1][1], VERTICES[INTRUDER_RADIUS - 1][0]);

/**
 * Where the intruder's radius, once past the opening ray, meets the first unit side: the
 * side from the unit foot to √2 stands on the line x = 1, so the height is the tangent of
 * the overrun, in feet.
 */
export const CROSSING_HEIGHT = VERTICES[INTRUDER_RADIUS - 1][1] / VERTICES[INTRUDER_RADIUS - 1][0];
export const CROSSING = Object.freeze([1, CROSSING_HEIGHT]);

/** Whether two finite segments cross properly, not at a shared endpoint. */
export function segmentsCross(firstFrom, firstTo, secondFrom, secondTo) {
  const orient = (origin, a, b) =>
    (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
  const first = orient(firstFrom, firstTo, secondFrom);
  const second = orient(firstFrom, firstTo, secondTo);
  const third = orient(secondFrom, secondTo, firstFrom);
  const fourth = orient(secondFrom, secondTo, firstTo);
  return (first > 0 !== second > 0) && (third > 0 !== fourth > 0);
}

export function hypotSquared(point) {
  return point[0] * point[0] + point[1] * point[1];
}

export function nearlyEqual(actual, expected, tolerance = CLOSE) {
  return Math.abs(actual - expected) <= tolerance;
}

/** Smoothstep: no jolt at either end of a movement. */
export function eased(share) {
  const t = Math.min(Math.max(share, 0), 1);
  return t * t * (3 - 2 * t);
}

export function wrapFrame(frameIndex) {
  assertInteger(frameIndex, "A frame index");
  return ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
}

/** Which act a frame is in, and how far through it. */
export function actAt(frameIndex) {
  let frame = wrapFrame(frameIndex);
  for (const act of ACTS) {
    if (frame < act.frames) {
      return { name: act.name, frame, frames: act.frames, share: frame / act.frames };
    }
    frame -= act.frames;
  }
  throw new RangeError("The acts do not fill the clip.");
}

/**
 * How many of the sixteen are on the page, counting a fraction for the one still arriving.
 * The sentence selects each root in turn, so the clock is even across the sixteen.
 */
export function reachAt(frameIndex) {
  const act = actAt(frameIndex);
  return act.name === "lay" ? TRIANGLE_COUNT * act.share : TRIANGLE_COUNT;
}

/** How far along its unit side the intruder's new vertex has come, nought to one and back. */
export function extraAt(frameIndex) {
  const act = actAt(frameIndex);
  if (act.name === "cross") return eased(act.share);
  if (act.name === "crossed") return 1;
  if (act.name === "retreat") return 1 - eased(act.share);
  return 0;
}

/** How present the figure is: whole until the dissolve, and nought on the clip's last frame. */
export function fadeAt(frameIndex) {
  const act = actAt(frameIndex);
  if (act.name !== "dissolve") return 1;
  return Math.max(0, 1 - act.frame / (act.frames - 1));
}

/** The intruder's new vertex at `extra` of the way along its unit side. */
export function tipAt(extra) {
  const from = VERTICES[INTRUDER - 1];
  const to = VERTICES[INTRUDER];
  return [from[0] + (to[0] - from[0]) * extra, from[1] + (to[1] - from[1]) * extra];
}

/**
 * How brightly the crossing is lit: the angle the intruder's radius stands past the opening
 * ray, as a share of the full overrun. Nought while the radius is short of the ray, one when
 * the intruder has fully arrived.
 */
export function lightAt(extra) {
  if (!(extra > 0)) return 0;
  const tip = tipAt(extra);
  const angle = Math.atan2(tip[1], tip[0]);
  return angle > 0 && angle < Math.PI ? Math.min(1, angle / OVERRUN_OF_THE_VERTEX) : 0;
}

export function sceneAt(frameIndex) {
  const frame = wrapFrame(frameIndex);
  const extra = extraAt(frame);
  return {
    frameIndex: frame,
    act: actAt(frame).name,
    reach: reachAt(frame),
    extra,
    light: lightAt(extra),
    fade: fadeAt(frame)
  };
}

/**
 * The new vertex of triangle `index` (1-based) at a fraction along its unit side, so a
 * triangle still arriving is drawn as far as it has come and no further.
 */
export function arrivingVertex(index, fraction) {
  assertInteger(index, "A triangle index");
  if (index < 1 || index > INTRUDER) {
    throw new RangeError("The clip draws sixteen triangles and the intruder.");
  }
  if (!(fraction >= 0 && fraction <= 1)) {
    throw new RangeError("A triangle arrives along its own unit side.");
  }
  const from = VERTICES[index - 1];
  const next = VERTICES[index];
  return [
    from[0] + fraction * (next[0] - from[0]),
    from[1] + fraction * (next[1] - from[1])
  ];
}

/** The bounding box of points, in the spiral's own units. */
export function boundsOf(points) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

/**
 * The page is fitted to the origin and all eighteen vertices, the intruder's included, so
 * that nothing moves when it comes: the figure is wider than it is tall and its origin is
 * not its middle, so what is centred is the envelope.
 */
export const FIGURE_POINTS = Object.freeze([ORIGIN, ...VERTICES]);
export const FIGURE_BOUNDS = boundsOf(FIGURE_POINTS);
export const FIGURE_SPAN = Math.max(
  FIGURE_BOUNDS.maxX - FIGURE_BOUNDS.minX,
  FIGURE_BOUNDS.maxY - FIGURE_BOUNDS.minY
);
export const PAGE_MARGIN = 48;
export const PAGE_SCALE = (LOGICAL_SIZE - 2 * PAGE_MARGIN) / FIGURE_SPAN;
const PAGE_MID_X = (FIGURE_BOUNDS.minX + FIGURE_BOUNDS.maxX) / 2;
const PAGE_MID_Y = (FIGURE_BOUNDS.minY + FIGURE_BOUNDS.maxY) / 2;

/** The spiral's coordinates onto the page: across stays across, up becomes down. */
export function onPage([x, y]) {
  return [
    LOGICAL_SIZE / 2 + (x - PAGE_MID_X) * PAGE_SCALE,
    LOGICAL_SIZE / 2 - (y - PAGE_MID_Y) * PAGE_SCALE
  ];
}
