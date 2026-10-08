/**
 * Another Heaven and Earth: petals on one stretch of water, seen close and then from far off.
 *
 * There is one world here, the hyperbolic plane, drawn in the Poincaré disc. A bank, the
 * vertical diameter, which is a geodesic, stands through the centre; from points spaced
 * evenly along it by hyperbolic length the water runs off at right angles on both sides,
 * along geodesics: arcs that meet the rim at right angles, and the one diameter among them.
 * Petals fall on the water at the bank and are carried away at one speed.
 *
 * The clip begins close up, the disc magnified eight times about its centre, where the
 * streamlines pass for straight and evenly spaced -- the human world, as near as this world
 * comes to a plane -- and zooms out at a constant rate until the whole disc is in view: the
 * other heaven and earth. Two petals on neighbouring streamlines at the same distance t from
 * the bank are d apart with sinh(d / 2) = sinh(d0 / 2) cosh t, the summit of a Saccheri
 * quadrilateral, and either one is d' from the other's streamline with
 * sinh d' = sinh d0 cosh t: both grow without bound. A petal is moved by the isometries of
 * the disc, so it keeps its hyperbolic shape and size and in the disc it shrinks as it nears
 * the rim, and it does not reach it: the bank passes through the centre, so a petal's distance
 * from the centre is arcosh(cosh s cosh t), which only grows with t, and its Euclidean distance
 * from the centre is the tanh of half that, below 1 at every t.
 *
 * The water and the bank are laid in strokes of a brush, each a spindle between two circular
 * arcs that meet on its line, of a hyperbolic length drawn at random, one after another with a
 * short gap between them from the bank out to the rim. A stroke is the same in hyperbolic terms
 * wherever it lies, so close up the strokes are long and broad and from far off they shrink
 * toward the rim, many to a line, the way the same brushwork repeats at every scale.
 *
 * A petal's long axis turns as the line of water it lies along: the water spreads across the
 * stream as cosh t and not along it, so the petals lie down across the stream as they go,
 * after the spin each one lands with, which the water's drag takes away.
 *
 * Every position and angle is a closed form of the time since the petal fell, and the view a
 * closed form of the frame, so no step is integrated, and a frame depends on its index and on
 * nothing drawn before it.
 */

export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 22;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;
export const CENTRE = LOGICAL_SIZE / 2;

/** The disc is DISC_RADIUS logical pixels across the half when the whole of it is in view. */
export const DISC_RADIUS = 300;

/**
 * The view: the disc magnified OPENING_SCALE times about its centre for the first
 * HOLD_FRAMES frames, then brought down to the whole disc at a constant rate in the logarithm
 * of the scale over ZOOM_FRAMES frames, and held there to the end.
 */
export const OPENING_SCALE = 8;
export const HOLD_FRAMES = 150;
export const ZOOM_FRAMES = 240;
export const ZOOM_END = HOLD_FRAMES + ZOOM_FRAMES;

/** The scale of the view at a frame: OPENING_SCALE, then exp of a straight line in the frame, then 1. */
export function viewScale(frameIndex) {
  if (frameIndex <= HOLD_FRAMES) return OPENING_SCALE;
  if (frameIndex >= ZOOM_END) return 1;
  return Math.exp(Math.log(OPENING_SCALE) * (1 - (frameIndex - HOLD_FRAMES) / ZOOM_FRAMES));
}

/** The streamlines on each side of the bank: j runs from -STREAMLINES to STREAMLINES, 0 through the centre. */
export const STREAMLINES = 43;
/** The spacing of the streamlines along the bank and the speed of the water, both in hyperbolic length. */
export const D0 = 0.0925;
export const RATE = 0.24;

/**
 * The brush the water is laid with. A stroke reaches STROKE_WIDTH from its line at its widest,
 * by hyperbolic distance, on one side, and a share of that drawn from STROKE_LEAN on the other;
 * it is a hyperbolic length drawn from STROKE_LENGTH long, and the next begins a gap drawn from
 * STROKE_GAP further on. Strokes are laid out along each line until 1 - |z|^2 there falls
 * below STROKE_LIMIT, where a stroke is a hundredth of a pixel long in the whole view.
 */
export const STROKE_WIDTH = 0.0042;
export const STROKE_LENGTH = [0.25, 0.6];
export const STROKE_GAP = [0.015, 0.04];
export const STROKE_LEAN = [0.5, 1];
export const STROKE_LIMIT = 2e-4;

/**
 * The petals: their lengths in pixels in the whole view at the centre, how slender they are,
 * where along its length each side is widest and how wide against half the petal's width, how
 * far the tip lies off the axis as a share of the width, and how round the tip is, as the
 * radius of its curve against the narrower side's half-width. A side is never widest nearer
 * the base than PETAL_BASE times its half-width, so the base is always a point: a side leaves it
 * at 2 atan(half / (widest - base)) to the axis, at most 67 degrees.
 */
export const PETAL_LENGTH = [13, 23];
export const PETAL_ASPECT = [1.8, 3.2];
export const PETAL_WIDEST = [0.3, 0.6];
export const PETAL_SIDE = [0.8, 1.2];
export const PETAL_BASE = 1.5;
export const PETAL_BEND = [-0.25, 0.25];
export const PETAL_ROUND = [0.03, 0.6];
/** A petal that has just fallen comes up over this many seconds. */
export const FADE_SECONDS = 0.2;

/**
 * The spin a petal lands with, which the water's drag takes away: its rate in radians a
 * second, either way, and the seconds the drag takes to cut it by e. The fastest turns 11.5
 * degrees a frame, so it reads as a turn and not a flicker; in all, a spin turns a petal between
 * 0.38 and 1.15 of a revolution, and three decay times in, less than a twentieth of it is left.
 */
export const SPIN_RATE = [2, 6];
export const SPIN_DECAY = 1.2;

/** At each point of the bank, the next petal falls this many seconds after the last. */
export const STREAM_GAP = [2, 6];
/**
 * Petals have been falling since this many seconds before the clip begins, so that when the
 * whole disc comes into view the water is full from the bank to the rim; they go on falling to
 * the end.
 */
export const PRE_ROLL = 16;

export const SEED = 2026;

/** A 32-bit generator (mulberry32), seeded once; every fall is drawn from its stream. */
export function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (random, [low, high]) => low + random() * (high - low);

/** The points of the bank petals fall at: every streamline, on both sides. */
export function sources() {
  const list = [];
  for (let j = -STREAMLINES; j <= STREAMLINES; j += 1) {
    for (const side of [-1, 1]) list.push({ j, side });
  }
  return list;
}

/**
 * The point t along the geodesic that leaves the bank at right angles at signed distance s
 * from the centre, in the unit disc with y pointing down the page. It is the hyperboloid's
 * point (cosh t cosh s, cosh t sinh s, sinh t) seen from (-1, 0, 0), and `rest` is 1 - |z|^2,
 * taken from the closed form rather than from x and y so that it keeps its digits next to the rim.
 */
export function discPoint(s, side, t) {
  const ch = Math.cosh(t);
  const denominator = 1 + ch * Math.cosh(s);
  return { x: (side * Math.sinh(t)) / denominator, y: (ch * Math.sinh(s)) / denominator, rest: 2 / denominator };
}

/**
 * The hyperbolic distance between two points of the disc, from
 * sinh(d / 2) = |z - w| / sqrt((1 - |z|^2)(1 - |w|^2)), written with each point's `rest`.
 */
export function discDistance(z, w) {
  return 2 * Math.asinh(Math.hypot(z.x - w.x, z.y - w.y) / Math.sqrt(z.rest * w.rest));
}

/**
 * Streamline j: the diameter for j = 0; otherwise the circle that crosses the bank at right
 * angles at (0, a), a = tanh(j d0 / 2), with centre (0, c) and radius r such that c - r = a and
 * c^2 - r^2 = 1, the condition for meeting the rim at right angles. It meets the rim at
 * (+-sqrt(1 - 1/c^2), 1/c).
 */
export function streamline(j) {
  if (j === 0) return { j, kind: "diameter", from: { x: -1, y: 0 }, to: { x: 1, y: 0 } };
  const a = Math.tanh((j * D0) / 2);
  const centreY = (1 + a * a) / (2 * a);
  const radius = (1 - a * a) / (2 * Math.abs(a));
  const meetY = 1 / centreY;
  const meetX = Math.sqrt(1 - meetY * meetY);
  return { j, kind: "arc", bank: a, centre: { x: 0, y: centreY }, radius, ends: [{ x: -meetX, y: meetY }, { x: meetX, y: meetY }] };
}

/** The bank, the vertical diameter. */
export const BANK = { kind: "diameter", from: { x: 0, y: -1 }, to: { x: 0, y: 1 } };

export const STREAMLINE_LIST = Array.from({ length: 2 * STREAMLINES + 1 }, (_, k) => streamline(k - STREAMLINES));

/**
 * The hyperbolic distance from z to the whole of a geodesic: for one on the circle (c, r) with
 * |c|^2 - r^2 = 1 it is arsinh(| |z - c|^2 - r^2 | / (r (1 - |z|^2))); for a diameter through
 * the unit vector n, arsinh(2 |z x n| / (1 - |z|^2)).
 */
export function distanceToGeodesic(z, line) {
  if (line.kind === "diameter") {
    const nx = line.to.x;
    const ny = line.to.y;
    return Math.asinh((2 * Math.abs(z.x * ny - z.y * nx)) / z.rest);
  }
  const dx = z.x - line.centre.x;
  const dy = z.y - line.centre.y;
  return Math.asinh(Math.abs(dx * dx + dy * dy - line.radius * line.radius) / (line.radius * z.rest));
}

/** The distance from z to streamline j. */
export function distanceToStreamline(z, j) {
  return distanceToGeodesic(z, streamline(j));
}

/**
 * Turns arcs worked with y up and run clockwise into the page's: y down, with the midpoint of
 * each arc and the sense it runs in on the canvas.
 */
function outline(arcs) {
  const down = ([x, y]) => ({ x, y: -y });
  const middle = (c, r, from, to) => {
    const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
    let a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
    while (a1 > a0) a1 -= 2 * Math.PI;
    const a = (a0 + a1) / 2;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  };
  return arcs.map(([c, r, from, to]) => {
    const arc = { centre: down(c), radius: r, from: down(from), mid: down(middle(c, r, from, to)), to: down(to) };
    return { ...arc, anticlockwise: arcRunsAnticlockwise(arc) };
  });
}

/** Whether going from `from` to `to` through `mid` round the arc's centre is anticlockwise in the canvas's sense. */
function arcRunsAnticlockwise({ centre, from, mid, to }) {
  const turn = (p) => Math.atan2(p.y - centre.y, p.x - centre.x);
  const a0 = turn(from);
  const sweep = (p) => (((turn(p) - a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return !(sweep(mid) < sweep(to));
}

/**
 * A spindle between two circular arcs through p and q (y up), run clockwise: over the side
 * the normal of p -> q points to, reaching `over` from the chord at its middle, and back under
 * the other side, reaching `under`. A circle through both ends that reaches h from the chord
 * has radius (a^2 + h^2) / (2 h), a being half the chord.
 */
function spindle(p, q, over, under) {
  const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const a = Math.hypot(q[0] - p[0], q[1] - p[1]) / 2;
  const n = [-(q[1] - p[1]) / (2 * a), (q[0] - p[0]) / (2 * a)];
  const circle = (h, sign) => {
    const r = (a * a + h * h) / (2 * h);
    return [[m[0] + sign * (h - r) * n[0], m[1] + sign * (h - r) * n[1]], r];
  };
  const [cOver, rOver] = circle(over, 1);
  const [cUnder, rUnder] = circle(under, -1);
  return outline([[cOver, rOver, p, q], [cUnder, rUnder, q, p]]);
}

/**
 * One petal's outline: five circular arcs run clockwise (y up) from the base along the upper
 * side, round the tip and back along the lower side, the anchor at the origin and the axis
 * along +x, in units of the disc's radius at its centre. Each side is two arcs that meet with a
 * level tangent where that side is widest, so the side has no corner; the base is a point on
 * the axis, and the two sides would meet in a point `bend` above it at the tip, which is
 * rounded instead by a fifth arc, the circle of radius `round` times the narrower half-width
 * that lies inside both sides' tip circles and touches each, so the outline turns no corner
 * there either.
 */
export function petalArcs({ length, upper, lower, bend, round }) {
  const B = [-length / 2, 0];
  const T = [length / 2, bend];
  const side = ({ at, half }, sign) => {
    const baseRadius = ((at - B[0]) ** 2 + half * half) / (2 * half);
    const rise = half - sign * bend;
    const tipRadius = ((T[0] - at) ** 2 + rise * rise) / (2 * rise);
    return {
      widest: [at, sign * half],
      base: [[at, sign * (half - baseRadius)], baseRadius],
      tip: [[at, sign * (half - tipRadius)], tipRadius]
    };
  };
  const u = side(upper, 1);
  const l = side(lower, -1);
  // The rounding circle's centre is rho in from each tip circle: where the circles of radius
  // R - rho about their centres cross, on the side of the tip.
  const rho = round * Math.min(upper.half, lower.half);
  const [c1, r1] = u.tip;
  const [c2, r2] = l.tip;
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  const along = ((r1 - rho) ** 2 - (r2 - rho) ** 2 + d * d) / (2 * d);
  const across = Math.sqrt((r1 - rho) ** 2 - along * along);
  const foot = [c1[0] + (along * dx) / d, c1[1] + (along * dy) / d];
  const crossings = [1, -1].map((k) => [foot[0] - (k * across * dy) / d, foot[1] + (k * across * dx) / d]);
  const nearTip = (p) => Math.hypot(p[0] - T[0], p[1] - T[1]);
  const f = nearTip(crossings[0]) < nearTip(crossings[1]) ? crossings[0] : crossings[1];
  const touch = ([cx, cy], r) => [cx + ((f[0] - cx) * r) / (r - rho), cy + ((f[1] - cy) * r) / (r - rho)];
  const F1 = touch(c1, r1);
  const F2 = touch(c2, r2);
  return outline([
    [u.base[0], u.base[1], B, u.widest],
    [c1, r1, u.widest, F1],
    [f, rho, F1, F2],
    [c2, r2, F2, l.widest],
    [l.base[0], l.base[1], l.widest, B]
  ]);
}

/** The joints, counted from the one after arc 0, where a petal's outline turns a corner: the base alone. */
export const PETAL_CORNERS = [4];

/**
 * A petal's own shape, drawn from the random stream: its length in the whole view, how
 * slender it is, for each side where it is widest and how wide, how far its tip lies off its
 * axis, how round its tip is, and which side the ink is darker on. The two sides differ, the
 * petal leans and bends a little, and no two petals are alike.
 */
export function drawPetalShape(random) {
  const lengthPixels = between(random, PETAL_LENGTH);
  const aspect = between(random, PETAL_ASPECT);
  const length = lengthPixels / DISC_RADIUS;
  const width = length / aspect;
  const sideOf = () => {
    const at = length * (between(random, PETAL_WIDEST) - 0.5);
    const half = (width / 2) * between(random, PETAL_SIDE);
    return { at: Math.max(at, PETAL_BASE * half - length / 2), half };
  };
  const upper = sideOf();
  const lower = sideOf();
  const bend = width * between(random, PETAL_BEND);
  const round = between(random, PETAL_ROUND);
  const dark = random() < 0.5 ? 1 : -1;
  const shape = { lengthPixels, aspect, length, width, upper, lower, bend, round, dark };
  return { ...shape, arcs: petalArcs(shape) };
}

/**
 * When and where the petals fall, in seconds from the start of the clip, sorted by time: each
 * point of the bank lets its petals go at its own irregular pace, from PRE_ROLL seconds before
 * the clip begins to its end. Each petal's own shape, the angle it lands at and its spin come
 * from a stream of their own.
 */
export function buildSchedule({ seed = SEED } = {}) {
  const random = createRandom(seed);
  const falls = [];
  for (const { j, side } of sources()) {
    let at = -PRE_ROLL + random() * STREAM_GAP[1];
    while (at < DURATION_SECONDS) {
      falls.push({ j, side, release: at });
      at += between(random, STREAM_GAP);
    }
  }
  falls.sort((p, q) => p.release - q.release || p.j - q.j || p.side - q.side);
  const own = createRandom(seed + 1);
  return {
    seed,
    falls: falls.map((petal, index) => {
      const theta0 = (own() * 2 - 1) * Math.PI;
      const rate = between(own, SPIN_RATE);
      const omega0 = own() < 0.5 ? -rate : rate;
      return { ...petal, index, theta0, omega0, shape: drawPetalShape(own) };
    })
  };
}

export const SCHEDULE = buildSchedule();

/**
 * Arcs moved by the isometry of the disc that takes the centre to z and the +x direction there
 * to `heading` at z: M(w) = (a w + z) / (1 + conj(z) a w) with a = e^(i heading). A Möbius map
 * takes circles to circles, so every arc is drawn exactly: the circle |w - p| = r goes to the
 * one with centre ((a p + z) conj(c p + 1) - a conj(c) r^2) / (|c p + 1|^2 - |z|^2 r^2) and
 * radius r (1 - |z|^2) / | |c p + 1|^2 - |z|^2 r^2 |, where c = conj(z) a. The denominator is
 * |z|^2 (|p - w0|^2 - r^2), w0 = -1 / c being the point M sends to infinity; when it is
 * negative, w0 lies inside the circle, M turns the circle inside out, and an arc that ran one
 * way round its centre runs the other way round the new one. Written out in real and imaginary
 * parts, so that a frame of fifteen hundred petals makes no garbage.
 */
export function discArcs(arcs, z, heading) {
  const ax = Math.cos(heading);
  const ay = Math.sin(heading);
  const cx = z.x * ax + z.y * ay;
  const cy = z.x * ay - z.y * ax;
  const z2 = 1 - z.rest;
  const acx = ax * cx + ay * cy;
  const acy = ay * cx - ax * cy;
  const map = (p) => {
    const nx = ax * p.x - ay * p.y + z.x;
    const ny = ax * p.y + ay * p.x + z.y;
    const dx = 1 + cx * p.x - cy * p.y;
    const dy = cx * p.y + cy * p.x;
    const d = dx * dx + dy * dy;
    return { x: (nx * dx + ny * dy) / d, y: (ny * dx - nx * dy) / d };
  };
  return arcs.map((arc) => {
    const px = arc.centre.x;
    const py = arc.centre.y;
    const r = arc.radius;
    const ux = ax * px - ay * py + z.x;
    const uy = ax * py + ay * px + z.y;
    const vx = 1 + cx * px - cy * py;
    const vy = cx * py + cy * px;
    const den = vx * vx + vy * vy - z2 * r * r;
    const tx = ux * vx + uy * vy;
    const ty = uy * vx - ux * vy;
    const centre = { x: (tx - acx * r * r) / den, y: (ty - acy * r * r) / den };
    return { centre, radius: (r * z.rest) / Math.abs(den), from: map(arc.from), mid: map(arc.mid), to: map(arc.to), anticlockwise: den < 0 ? !arc.anticlockwise : arc.anticlockwise };
  });
}

/** The direction the water runs at a petal, on the page: the tangent of its geodesic, away from the bank. */
export function flowHeading(s, side, t) {
  // d/dt of discPoint: (side (cosh t + cosh s), sinh s sinh t) / (1 + cosh t cosh s)^2.
  return Math.atan2(Math.sinh(s) * Math.sinh(t), side * (Math.cosh(t) + Math.cosh(s)));
}

/**
 * A line of water walked by hyperbolic length: the point at signed distance tau along it, from
 * where a streamline crosses the bank (the bank's own from the centre, down the page), and the
 * direction tau grows in there.
 */
export function walkAlong(line) {
  if (line === BANK) {
    return {
      point: (tau) => ({ x: 0, y: Math.tanh(tau / 2), rest: 1 / Math.cosh(tau / 2) ** 2 }),
      heading: () => Math.PI / 2
    };
  }
  const s = line.kind === "diameter" ? 0 : line.j * D0;
  return {
    point: (tau) => discPoint(s, tau < 0 ? -1 : 1, Math.abs(tau)),
    heading: (tau) => (tau < 0 ? flowHeading(s, -1, -tau) + Math.PI : flowHeading(s, 1, tau))
  };
}

/**
 * One stroke of the brush on a line, from tau = from to tau = to: the spindle on the stretch
 * of the x axis of hyperbolic length to - from about the centre, reaching STROKE_WIDTH times
 * lean[0] above it and lean[1] below, a point at distance h from the axis being tanh(h / 2)
 * from it at the middle, carried by the isometry that takes the centre to the stroke's middle
 * on the line and the x axis along the line. Both ends land on the line, and the arcs are
 * circles.
 */
function strokeOn(walk, from, to, lean) {
  const middle = (from + to) / 2;
  const a = Math.tanh((to - from) / 4);
  const [over, under] = lean.map((share) => Math.tanh((STROKE_WIDTH * share) / 2));
  return { from, to, lean, arcs: discArcs(spindle([-a, 0], [a, 0], over, under), walk.point(middle), walk.heading(middle)) };
}

/**
 * The strokes along a line: the first begins up to a stroke's length before the bank, so that
 * where the strokes cross it falls where it may, and from there they run out both ways, each
 * of its own length and each gap its own, to where the line is too near the rim to see.
 */
function strokesAlong(line, random) {
  const walk = walkAlong(line);
  const near = (tau) => walk.point(tau).rest >= STROKE_LIMIT;
  const lean = () => {
    const share = between(random, STROKE_LEAN);
    return random() < 0.5 ? [1, share] : [share, 1];
  };
  const list = [];
  const start = -random() * STROKE_LENGTH[1];
  for (let at = start; near(at);) {
    const length = between(random, STROKE_LENGTH);
    list.push(strokeOn(walk, at, at + length, lean()));
    at += length + between(random, STROKE_GAP);
  }
  for (let at = start - between(random, STROKE_GAP); near(at);) {
    const length = between(random, STROKE_LENGTH);
    list.push(strokeOn(walk, at - length, at, lean()));
    at -= length + between(random, STROKE_GAP);
  }
  return list.sort((p, q) => p.from - q.from);
}

/** Every line's strokes, the bank's first, drawn from a stream of their own. */
export function layStrokes({ seed = SEED } = {}) {
  const random = createRandom(seed + 2);
  return [BANK, ...STREAMLINE_LIST].map((line) => ({ line, strokes: strokesAlong(line, random) }));
}

export const STROKES = layStrokes();

/**
 * A petal's angle from the direction the water runs, base to tip, `age` seconds after it fell
 * and t along its streamline. Its long axis turns as the line of water it lies along: the water
 * spreads across the stream as cosh t and not along it, so a line at angle psi when it left the
 * bank is at atan2(sin psi cosh t, cos psi), which is tan theta = tan psi cosh t kept in psi's
 * half-plane. psi is the angle it landed at plus the turn its landing spin has made,
 * omega0 tau (1 - e^(-age / tau)): the spin is added to the angle in the water's own
 * coordinates, which the spreading then carries -- a choice of model that keeps the angle a
 * closed form, not a torque added to the slender-body equation.
 */
export function swayAngle(theta0, omega0, age, t) {
  const psi = theta0 + omega0 * SPIN_DECAY * (1 - Math.exp(-age / SPIN_DECAY));
  return Math.atan2(Math.sin(psi) * Math.cosh(t), Math.cos(psi));
}

export const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));

/** The frame the page shows `elapsedSeconds` after it began: the clock's frame, then the last. */
export function pageFrame(elapsedSeconds) {
  return clamp(Math.floor(elapsedSeconds * PLAYBACK_FPS), 0, TOTAL_FRAMES - 1);
}

/**
 * What frame `frameIndex` shows: the scale of the view, the seconds into the clip, and every
 * petal that has fallen by then -- where its anchor is, the angle it lies at and the arcs it is
 * drawn with, all points of the unit disc.
 */
export function sceneAt(frameIndex, schedule = SCHEDULE) {
  const frame = clamp(Math.floor(frameIndex), 0, TOTAL_FRAMES - 1);
  const seconds = frame / PLAYBACK_FPS;
  const petals = [];
  for (const petal of schedule.falls) {
    const age = seconds - petal.release;
    if (age < 0) break;
    const fade = Math.min(1, age / FADE_SECONDS);
    const { index, j, side, theta0, omega0, shape } = petal;
    const t = RATE * age;
    const s = j * D0;
    const z = discPoint(s, side, t);
    const theta = swayAngle(theta0, omega0, age, t);
    const heading = flowHeading(s, side, t) + theta;
    petals.push({ index, j, side, age, t, fade, theta0, omega0, theta, heading, z, shape, arcs: discArcs(shape.arcs, z, heading) });
  }
  return { frameIndex: frame, totalFrames: TOTAL_FRAMES, seconds, scale: viewScale(frame), petals };
}
