import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  BANK, CENTRE, D0, DISC_RADIUS, DURATION_SECONDS, HOLD_FRAMES, LOGICAL_SIZE, OPENING_SCALE,
  PETAL_ASPECT, PETAL_BASE, PETAL_BEND, PETAL_CORNERS, PETAL_LENGTH, PETAL_ROUND, PETAL_SIDE, PETAL_WIDEST,
  PLAYBACK_FPS, PRE_ROLL, RATE, SCHEDULE, SEED, SPIN_DECAY, SPIN_RATE,
  STREAMLINES, STREAMLINE_LIST, STREAM_GAP, STROKES, STROKE_GAP, STROKE_LEAN, STROKE_LENGTH, STROKE_LIMIT, STROKE_WIDTH,
  TOTAL_FRAMES, ZOOM_END, ZOOM_FRAMES,
  buildSchedule, discArcs, discDistance, discPoint, distanceToStreamline, layStrokes,
  pageFrame, sceneAt, sources, streamline, viewScale, walkAlong
} from "../artworks/another-heaven-and-earth/world.js";

/**
 * The numbers the clip is registered under, each measured by the test that holds it. A
 * change of seed, spacing, speed, view or timing moves one of them, and the test says which.
 */
const REGISTERED = {
  falls: 1616,
  readings: 754209,
  shown: 1613,
  movedBankInward: 12975,
  misattributedRejected: 734882,
  geodesicsDrawn: 88,
  strokes: 3400,
  raisedSides: 332,
  linesInTheOpening: 7,
  openingBow: { middleHalf: "1.692", frame: "6.772" },
  openingGap: { middleHalf: ["109.51", "111.48"], frame: ["109.51", "113.15"] },
  planeOffset: { opening: "10.3", openingLines: "4.65", openingPetals: 643, openingOutOfFrame: 8, whole: "1139.1", wholePetals: 1339, wholeOutOfFrame: 1112 },
  thumbnail: 465
};

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const ARTWORK = MANIFEST.artworks.find((entry) => entry.id === "another-heaven-and-earth");
const QUOTE = CATALOG.quotes.find((entry) => entry.id === "li-bai-peach-blossom-water");

/**
 * Every petal of every frame, one frame at a time: the readings the pins below are taken over.
 * A frame holds up to sixteen hundred petals, so the readings are visited, not kept.
 */
function forEachReading(visit, schedule = SCHEDULE) {
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    for (const petal of sceneAt(frame, schedule).petals) visit(petal, frame);
  }
}

/**
 * The test's own distances, not the module's. Between two points of the disc,
 * sinh(d / 2) = |z - w| / sqrt((1 - |z|^2)(1 - |w|^2)), with 1 - |z|^2 taken from the
 * coordinates. From a point to the geodesic on the circle (c, r), the Minkowski product of the
 * point's place on the hyperboloid, ((1 + |z|^2), 2x, 2y) / (1 - |z|^2), with the unit normal
 * (1, c) / r of the geodesic's plane; to the diameter through n, with (0, m), m the unit normal.
 */
function measuredDistance(z, w) {
  const rz = 1 - (z.x * z.x + z.y * z.y);
  const rw = 1 - (w.x * w.x + w.y * w.y);
  return 2 * Math.asinh(Math.hypot(z.x - w.x, z.y - w.y) / Math.sqrt(rz * rw));
}
function measuredDistanceToGeodesic(z, line) {
  const r2 = z.x * z.x + z.y * z.y;
  if (line.kind === "diameter") {
    const n = { x: line.to.x - line.from.x, y: line.to.y - line.from.y };
    const length = Math.hypot(n.x, n.y);
    return Math.asinh((2 * Math.abs(z.x * n.y - z.y * n.x)) / length / (1 - r2));
  }
  const product = (-(1 + r2) + 2 * (z.x * line.centre.x + z.y * line.centre.y)) / ((1 - r2) * line.radius);
  return Math.asinh(Math.abs(product));
}

/**
 * Pin 3's two laws, as relative misses. (a) Two petals on neighbouring streamlines, the same
 * distance t from the bank, are d apart with sinh(d / 2) = sinh(d0 / 2) cosh t. (b) Either is
 * d' from the other's streamline with sinh d' = sinh d0 cosh t.
 */
const summitMiss = (d, t, d0) => Math.abs(Math.sinh(d / 2) / (Math.sinh(d0 / 2) * Math.cosh(t)) - 1);
const sideMiss = (d, t, d0) => Math.abs(Math.sinh(d) / (Math.sinh(d0) * Math.cosh(t)) - 1);
/**
 * How close is close. The distances are measured with 1 - |z|^2 taken from the coordinates,
 * which next to the rim loses digits: its relative error is about 2e-16 / (1 - |z|^2), and
 * 1 - |z|^2 comes down to 2.5e-5 here, and sinh and cosh of arguments below 10 add an ulp or
 * two. The largest misses measured are 1.5e-11 for the summit law and 2.6e-11 for the side
 * law; 1e-10 is nearly four times the larger, and nine orders below what pin 4's control
 * misses by.
 */
const LAW_TOLERANCE = 1e-10;

/**
 * Pin 2's and pin 7's tolerance. Next to the rim a petal is a millionth of the disc across, and
 * the curve that rounds its tip a twentieth of that, where coordinates near 1 are good to about
 * 1.1e-16: the arcs' centres and ends carry relative errors of up to about 1e-8 of their size,
 * and so do the lengths and angles read from them. The largest misses measured over every
 * reading are 6.6e-9 of an arc's length, 1.4e-8 radians at a joint and 5.2e-10 radians in a
 * petal's heading; 1e-7 is seven times the largest.
 */
const SHAPE_TOLERANCE = 1e-7;

/**
 * Pin 5's tolerance for how far a stroke reaches from its line. The strokes run out to where
 * 1 - |z|^2 is 2e-4, and there the distance read from the coordinates carries a relative error
 * of about 1e-16 over the product of 1 - |z|^2, the line's radius and the brush's width. The
 * largest miss measured is 1.9e-8 of the width; 1e-7 is five times that.
 */
const REACH_TOLERANCE = 1e-7;

/** The sweep of an arc from its start, the way it runs. */
function sweepOf(arc) {
  const a0 = Math.atan2(arc.from.y - arc.centre.y, arc.from.x - arc.centre.x);
  const a1 = Math.atan2(arc.to.y - arc.centre.y, arc.to.x - arc.centre.x);
  const d = arc.anticlockwise ? a0 - a1 : a1 - a0;
  return { a0, sweep: ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), way: arc.anticlockwise ? -1 : 1 };
}

/**
 * Gauss-Legendre nodes and weights on [-1, 1], the roots of the Legendre polynomial found by
 * Newton's method: n of them integrate a polynomial of degree 2n - 1 exactly.
 */
function gaussLegendre(n) {
  const nodes = [];
  const weights = [];
  for (let i = 1; i <= n; i += 1) {
    let x = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let slope = 1;
    for (let step = 0; step < 100; step += 1) {
      let p0 = 1;
      let p1 = x;
      for (let k = 2; k <= n; k += 1) {
        const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      slope = (n * (x * p1 - p0)) / (x * x - 1);
      const dx = p1 / slope;
      x -= dx;
      if (Math.abs(dx) < 1e-16) break;
    }
    nodes.push(x);
    weights.push(2 / ((1 - x * x) * slope * slope));
  }
  return { nodes, weights };
}
const GAUSS = gaussLegendre(16);

/** The integral of 2 |dw| / (1 - |w|^2) along a circular arc of the disc, by the rule `point(k, n)` names. */
function lengthBy(arc, nodes, weights) {
  const { a0, sweep, way } = sweepOf(arc);
  let sum = 0;
  for (let k = 0; k < nodes.length; k += 1) {
    const a = a0 + (way * sweep * (1 + nodes[k])) / 2;
    const x = arc.centre.x + arc.radius * Math.cos(a);
    const y = arc.centre.y + arc.radius * Math.sin(a);
    sum += (weights[k] * 2 * arc.radius) / (1 - (x * x + y * y));
  }
  return (sum * sweep) / 2;
}
/** The hyperbolic length of an arc by sixteen-point Gauss-Legendre: the integrand is smooth over a petal. */
const hyperbolicLength = (arc) => lengthBy(arc, GAUSS.nodes, GAUSS.weights);
/** The same by Simpson's rule on 512 intervals, the instrument the first rule is checked against. */
function simpsonLength(arc) {
  const n = 512;
  const nodes = [];
  const weights = [];
  for (let k = 0; k <= n; k += 1) {
    nodes.push((2 * k) / n - 1);
    weights.push(((k === 0 || k === n ? 1 : k % 2 ? 4 : 2) * 2) / (3 * n));
  }
  return lengthBy(arc, nodes, weights);
}

/** The angle the outline turns through where each arc meets the next: the disc is conformal, so these are hyperbolic angles. */
function joints(arcs) {
  const tangent = (arc, atEnd) => {
    const p = atEnd ? arc.to : arc.from;
    const a = Math.atan2(p.y - arc.centre.y, p.x - arc.centre.x);
    const way = arc.anticlockwise ? -1 : 1;
    return [-way * Math.sin(a), way * Math.cos(a)];
  };
  return arcs.map((arc, k) => {
    const inward = tangent(arc, true);
    const outward = tangent(arcs[(k + 1) % arcs.length], false);
    return Math.atan2(inward[0] * outward[1] - inward[1] * outward[0], inward[0] * outward[0] + inward[1] * outward[1]);
  });
}

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Each petal's own shape, the reference its every frame is held to: its arcs' hyperbolic lengths and its joints' angles. */
const REFERENCE = new Map();
function referenceOf(petal) {
  if (!REFERENCE.has(petal.index)) {
    const arcs = petal.shape.arcs;
    REFERENCE.set(petal.index, { lengths: arcs.map(hyperbolicLength), angles: joints(arcs) });
  }
  return REFERENCE.get(petal.index);
}

/**
 * Where a drawn petal points, read off its outline: the direction at its anchor of the
 * geodesic toward its tip, found by taking the anchor to the centre with the isometry
 * w -> (w - z) / (1 - conj(z) w), whose derivative there is real and positive, less the angle
 * its tip lies off its axis in its own shape (the geodesic from the centre to the tip is a
 * diameter); and the direction the water runs at the anchor, the tangent of the streamline's
 * circle, turned away from the bank.
 */
function drawnHeading(petal) {
  const z = petal.z;
  const tip = petal.arcs[1].to;
  const top = [tip.x - z.x, tip.y - z.y];
  const bottom = [1 - (z.x * tip.x + z.y * tip.y), -(z.x * tip.y - z.y * tip.x)];
  const own = petal.shape.arcs[1].to;
  return Math.atan2(top[1] * bottom[0] - top[0] * bottom[1], top[0] * bottom[0] + top[1] * bottom[1]) - Math.atan2(own.y, own.x);
}
function measuredFlow(petal) {
  const line = streamline(petal.j);
  if (line.kind === "diameter") return petal.side > 0 ? 0 : Math.PI;
  let tx = -(petal.z.y - line.centre.y);
  let ty = petal.z.x - line.centre.x;
  if (tx * petal.side < 0) { tx = -tx; ty = -ty; }
  return Math.atan2(ty, tx);
}

/**
 * Pin 7's law: the angle a petal landed at, plus the turn its landing spin has made,
 * omega0 tau (1 - e^(-age / tau)), carried by the turn of the line of water it lies along,
 * tan theta = tan psi cosh t in psi's half-plane. The plane's rule is psi alone.
 */
const landed = (petal) => petal.theta0 + petal.omega0 * SPIN_DECAY * (1 - Math.exp(-petal.age / SPIN_DECAY));
const lawAngle = (petal) => {
  const psi = landed(petal);
  return Math.atan2(Math.sin(psi) * Math.cosh(petal.t), Math.cos(psi));
};

/**
 * How far a drawn line is from being a geodesic of the disc: for a straight line, its
 * distance from the centre (a geodesic through the rim at right angles is a diameter); for a
 * circle, how far |c|^2 - r^2 is from 1, relative to |c|^2 (the condition for meeting the rim
 * at right angles).
 */
function geodesicDefect(line) {
  if (line.kind === "diameter") {
    const { from, to } = line;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    return Math.abs(from.x * to.y - from.y * to.x) / length;
  }
  const c2 = line.centre.x ** 2 + line.centre.y ** 2;
  return Math.abs(c2 - line.radius ** 2 - 1) / c2;
}

/** Points along the inside of a circle between two of its points, the way an arc runs, ends left out. */
function along(arc, count) {
  const { a0, sweep, way } = sweepOf(arc);
  return Array.from({ length: count }, (_, k) => {
    const a = a0 + (way * sweep * (k + 1)) / (count + 1);
    return { x: arc.centre.x + arc.radius * Math.cos(a), y: arc.centre.y + arc.radius * Math.sin(a) };
  });
}

/** Points along an arc the way it runs, both ends included. */
function arcPoints(arc, count) {
  const { a0, sweep, way } = sweepOf(arc);
  return Array.from({ length: count + 1 }, (_, k) => {
    const a = a0 + (way * sweep * k) / count;
    return { x: arc.centre.x + arc.radius * Math.cos(a), y: arc.centre.y + arc.radius * Math.sin(a) };
  });
}


/** Pixels per unit of the disc at a frame: the disc's radius in the whole view, times the view's scale. */
const pixelsPerUnit = (frame) => DISC_RADIUS * viewScale(frame);

/**
 * Where streamline j crosses the vertical line x of the disc, on the branch through the bank:
 * the centreline's height. The diameter is y = 0.
 */
function heightAt(line, x) {
  if (line.kind === "diameter") return 0;
  const below = Math.sqrt(line.radius ** 2 - x * x);
  return line.bank > 0 ? line.centre.y - below : line.centre.y + below;
}

test("the world and the view are the registered ones, and every petal is its own", () => {
  assert.equal(SEED, 2026);
  assert.equal(LOGICAL_SIZE, 680);
  assert.equal(CENTRE, 340);
  assert.equal(DISC_RADIUS, 300);
  assert.equal(STREAMLINES, 43);
  assert.equal(D0, 0.0925);
  assert.equal(RATE, 0.24);
  assert.equal(OPENING_SCALE, 8);
  assert.equal(HOLD_FRAMES, 5 * PLAYBACK_FPS);
  assert.equal(ZOOM_FRAMES, 8 * PLAYBACK_FPS);
  assert.equal(ZOOM_END, 13 * PLAYBACK_FPS);
  assert.equal(TOTAL_FRAMES, PLAYBACK_FPS * DURATION_SECONDS);
  assert.equal(TOTAL_FRAMES, 660);
  // The outermost streamlines leave the bank about 4 from the centre, by hyperbolic length,
  // 11 pixels inside the rim in the whole view.
  assert.ok(Math.abs(STREAMLINES * D0 - 3.9775) < 1e-12);
  assert.equal((DISC_RADIUS * (1 - Math.tanh((STREAMLINES * D0) / 2))).toFixed(1), "11.0");

  assert.equal(SCHEDULE.falls.length, REGISTERED.falls);
  // Every fall is at one of the bank's points, from PRE_ROLL seconds before the clip to its
  // end, in time order, and every point lets petals go.
  const points = new Set(sources().map(({ j, side }) => `${j}:${side}`));
  assert.equal(points.size, 2 * (2 * STREAMLINES + 1));
  assert.equal(PRE_ROLL, 16);
  assert.deepEqual(STREAM_GAP, [2, 6]);
  SCHEDULE.falls.forEach((petal, k) => {
    assert.ok(points.has(`${petal.j}:${petal.side}`));
    assert.ok(petal.release >= -PRE_ROLL && petal.release < DURATION_SECONDS);
    if (k > 0) assert.ok(petal.release >= SCHEDULE.falls[k - 1].release);
    assert.equal(petal.index, k);
  });
  assert.equal(new Set(SCHEDULE.falls.map(({ j, side }) => `${j}:${side}`)).size, points.size);
  // Each petal lands at an angle drawn evenly round the circle, with a spin of 2 to 6
  // radians a second either way that the water's drag takes away over 1.2 seconds.
  assert.equal(SPIN_DECAY, 1.2);
  assert.deepEqual(SPIN_RATE, [2, 6]);
  for (const petal of SCHEDULE.falls) {
    assert.ok(petal.theta0 >= -Math.PI && petal.theta0 < Math.PI);
    assert.ok(Math.abs(petal.omega0) >= SPIN_RATE[0] && Math.abs(petal.omega0) <= SPIN_RATE[1]);
  }
  // Each petal's own shape: 13 to 23 pixels long in the whole view at the centre, 1.8 to 3.2
  // times as long as it is wide, each side widest between 30 and 60 per cent of the way from
  // the base but never nearer the base than 1.5 times its half-width, half the width give or
  // take 20 per cent, the tip off the axis by up to a quarter of the width either way, and
  // rounded by a circle of 3 to 60 per cent of the narrower half-width.
  assert.deepEqual(PETAL_LENGTH, [13, 23]);
  assert.deepEqual(PETAL_ASPECT, [1.8, 3.2]);
  assert.deepEqual(PETAL_WIDEST, [0.3, 0.6]);
  assert.deepEqual(PETAL_SIDE, [0.8, 1.2]);
  assert.equal(PETAL_BASE, 1.5);
  assert.deepEqual(PETAL_BEND, [-0.25, 0.25]);
  assert.deepEqual(PETAL_ROUND, [0.03, 0.6]);
  const lengths = new Set();
  const shapes = new Set();
  const counts = { up: 0, down: 0, darkUp: 0, darkDown: 0, raised: 0 };
  for (const { shape } of SCHEDULE.falls) {
    assert.ok(shape.lengthPixels >= 13 && shape.lengthPixels <= 23);
    assert.ok(shape.aspect >= 1.8 && shape.aspect <= 3.2);
    assert.equal(shape.length, shape.lengthPixels / DISC_RADIUS);
    assert.equal(shape.width, shape.length / shape.aspect);
    for (const side of [shape.upper, shape.lower]) {
      const fromBase = side.at + shape.length / 2;
      assert.ok(fromBase >= PETAL_BASE * side.half - 1e-15, "a side is widest too near the base");
      assert.ok(fromBase / shape.length <= 0.6 + 1e-15);
      if (fromBase / shape.length < 0.3) assert.ok(false, "a side is widest nearer the base than 30 per cent");
      if (Math.abs(fromBase - PETAL_BASE * side.half) < 1e-15) counts.raised += 1;
      const half = side.half / (shape.width / 2);
      assert.ok(half >= 0.8 && half <= 1.2);
    }
    const bend = shape.bend / shape.width;
    assert.ok(bend >= -0.25 && bend <= 0.25);
    counts[bend > 0 ? "up" : "down"] += 1;
    assert.ok(shape.round >= 0.03 && shape.round <= 0.6);
    counts[shape.dark > 0 ? "darkUp" : "darkDown"] += 1;
    // The outline runs base, upper side, the rounded tip, lower side, base: five arcs, the base
    // on the axis, the rounding arc of the drawn radius.
    const arcs = shape.arcs;
    assert.equal(arcs.length, 5);
    assert.ok(Math.abs(arcs[0].from.x + shape.length / 2) < 1e-15 && arcs[0].from.y === 0);
    assert.deepEqual(arcs[4].to, arcs[0].from);
    assert.ok(Math.abs(arcs[2].radius - shape.round * Math.min(shape.upper.half, shape.lower.half)) < 1e-15);
    lengths.add(shape.lengthPixels);
    shapes.add([shape.lengthPixels, shape.aspect, shape.upper.at, shape.upper.half, shape.lower.at, shape.lower.half, shape.bend, shape.round].join(" "));
  }
  // No two petals alike: all 1,616 differ in the numbers their shapes are drawn from, and every
  // one is drawn its own length; they bend both ways and are dark on both sides; and some sides
  // are widest where the base's rule put them.
  assert.equal(SCHEDULE.falls.length, 1616);
  assert.equal(shapes.size, SCHEDULE.falls.length);
  assert.equal(lengths.size, SCHEDULE.falls.length);
  for (const key of ["up", "down", "darkUp", "darkDown"]) assert.ok(counts[key] > 0.4 * SCHEDULE.falls.length, key);
  assert.equal(counts.raised, REGISTERED.raisedSides);
});
test("pin 1: every petal stays inside the disc and only ever moves away from its centre", () => {
  const lastRadius = new Map();
  let readings = 0;
  let nearest = 1;
  let compared = 0;
  forEachReading(({ index, z, arcs }) => {
    readings += 1;
    const r2 = z.x * z.x + z.y * z.y;
    assert.ok(r2 < 1, `petal ${index} is at |z|^2 = ${r2}`);
    // The closed form's 1 - |z|^2 is the one measured from the point.
    assert.ok(Math.abs(z.rest - (1 - r2)) < 1e-14, `petal ${index}: rest ${z.rest} against ${1 - r2}`);
    // The whole drawn petal is inside too: every circle of its outline lies within the rim.
    for (const arc of arcs) assert.ok(Math.hypot(arc.centre.x, arc.centre.y) + arc.radius < 1);
    const radius = Math.sqrt(r2);
    if (lastRadius.has(index)) {
      assert.ok(radius >= lastRadius.get(index), `petal ${index} moved toward the centre`);
      compared += 1;
    }
    lastRadius.set(index, radius);
    nearest = Math.min(nearest, z.rest);
  });
  // Not vacuous: every petal that falls before the last frame was followed across frames,
  // and they came close to the rim. The few that fall after the last frame are never shown.
  const lastSeconds = (TOTAL_FRAMES - 1) / PLAYBACK_FPS;
  assert.equal(readings, REGISTERED.readings);
  assert.equal(lastRadius.size, REGISTERED.shown);
  assert.equal(SCHEDULE.falls.filter((petal) => petal.release <= lastSeconds).length, REGISTERED.shown);
  assert.equal(compared, REGISTERED.readings - REGISTERED.shown);
  assert.ok(nearest < 1e-4, `the nearest any petal came to the rim leaves 1 - |z|^2 = ${nearest}`);
});

test("pin 1's control: the same streams with the bank moved off the centre carry some petal toward it", () => {
  // A hyperbolic translation along the x axis by a = 0.3 moves the bank off the centre and is
  // an isometry, so every distance between petals is kept; only "away from the centre" fails.
  const a = 0.3;
  const moved = (z) => {
    const re = z.x + a;
    const den = (1 + a * z.x) ** 2 + (a * z.y) ** 2;
    const x = (re * (1 + a * z.x) + z.y * (a * z.y)) / den;
    const y = (z.y * (1 + a * z.x) - re * (a * z.y)) / den;
    return Math.hypot(x, y);
  };
  const last = new Map();
  let inward = 0;
  forEachReading(({ index, z }) => {
    const radius = moved(z);
    if (last.has(index) && radius < last.get(index)) inward += 1;
    last.set(index, radius);
  });
  assert.equal(inward, REGISTERED.movedBankInward);
});

test("pin 2: each petal keeps its own shape in every frame: each arc's hyperbolic length, and the angle at each joint", () => {
  // The instrument first: sixteen-point Gauss-Legendre agrees with Simpson's rule on 512
  // intervals over the first petal's arcs, at the centre and next to the rim.
  const first = SCHEDULE.falls[0];
  for (const z of [{ x: 0, y: 0, rest: 1 }, discPoint(40 * D0, 1, 8)]) {
    for (const arc of discArcs(first.shape.arcs, z, 0.7)) {
      assert.ok(Math.abs(hyperbolicLength(arc) / simpsonLength(arc) - 1) < 1e-12);
    }
  }
  // Each petal as built: five arcs, joined smoothly where each side is widest and where the
  // tip's rounding meets the sides, and turning a real corner only at the base, the same way
  // round as the outline runs.
  assert.deepEqual(PETAL_CORNERS, [4]);
  const perimeters = [];
  let sharpest = Infinity;
  for (const petal of SCHEDULE.falls) {
    const { lengths, angles } = referenceOf(petal);
    assert.equal(lengths.length, 5);
    angles.forEach((angle, k) => {
      if (PETAL_CORNERS.includes(k)) assert.ok(angle > 0.7, `petal ${petal.index}: joint ${k} is meant to be a corner and turns ${angle}`);
      else assert.ok(Math.abs(angle) < 1e-12, `petal ${petal.index}: joint ${k} is meant to be smooth and turns ${angle}`);
    });
    sharpest = Math.min(sharpest, angles[4]);
    // Drawn at the centre with no turn, the petal is its own shape.
    const placed = discArcs(petal.shape.arcs, { x: 0, y: 0, rest: 1 }, 0);
    placed.forEach((arc, k) => assert.ok(Math.abs(hyperbolicLength(arc) / lengths[k] - 1) < 1e-14));
    perimeters.push(lengths.reduce((sum, length) => sum + length, 0));
  }
  let worstLength = 0;
  let worstAngle = 0;
  let smallest = Infinity;
  forEachReading((petal) => {
    const { lengths, angles } = referenceOf(petal);
    petal.arcs.forEach((arc, k) => { worstLength = Math.max(worstLength, Math.abs(hyperbolicLength(arc) / lengths[k] - 1)); });
    joints(petal.arcs).forEach((angle, k) => { worstAngle = Math.max(worstAngle, Math.abs(wrap(angle - angles[k]))); });
    smallest = Math.min(smallest, Math.hypot(petal.arcs[2].mid.x - petal.arcs[0].from.x, petal.arcs[2].mid.y - petal.arcs[0].from.y));
  });
  assert.ok(worstLength < SHAPE_TOLERANCE, `an arc's length is off by ${worstLength} of itself`);
  assert.ok(worstAngle < SHAPE_TOLERANCE, `a joint is off by ${worstAngle} radians`);
  // Not vacuous: the petals differ, the longest outline more than half as long again as the
  // shortest, every base a point, and the drawn petal did shrink, by orders of magnitude, while
  // its shape held.
  assert.ok(Math.max(...perimeters) / Math.min(...perimeters) > 1.5);
  assert.ok(sharpest > 0.75, `the bluntest base turns only ${sharpest}`);
  assert.ok(smallest * DISC_RADIUS < 0.001, `the smallest petal is ${smallest * DISC_RADIUS} pixels from base to tip`);
  // The control: the plane's rule, the petal moved rigidly at its size at the centre, set about
  // the same points of the disc: away from the centre its arcs' hyperbolic lengths are not the
  // petal's.
  let considered = 0;
  let unequal = 0;
  forEachReading((petal) => {
    const { z, heading, shape } = petal;
    if (Math.hypot(z.x, z.y) < 0.01) return;
    considered += 1;
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    const move = (p) => ({ x: z.x + c * p.x - s * p.y, y: z.y + s * p.x + c * p.y });
    const rigid = shape.arcs.map((arc) => ({ ...arc, centre: move(arc.centre), from: move(arc.from), to: move(arc.to) }));
    const outside = rigid.some((arc) => Math.hypot(arc.centre.x, arc.centre.y) + arc.radius >= 1);
    if (outside || Math.abs(hyperbolicLength(rigid[1]) / referenceOf(petal).lengths[1] - 1) >= SHAPE_TOLERANCE) unequal += 1;
  });
  assert.equal(unequal, considered);
  assert.ok(considered > 0.99 * REGISTERED.readings);
});
test("pin 3: neighbouring streamlines part by the Saccheri summit and by the distance to a geodesic", () => {
  let worstSummit = 0;
  let worstSide = 0;
  let farthest = 0;
  let checks = 0;
  forEachReading(({ j, side, t, z }) => {
    if (j === STREAMLINES) return;
    const other = discPoint((j + 1) * D0, side, t);
    worstSummit = Math.max(worstSummit, summitMiss(measuredDistance(z, other), t, D0));
    worstSide = Math.max(worstSide, sideMiss(measuredDistanceToGeodesic(z, streamline(j + 1)), t, D0));
    // The module's own distances agree with the test's.
    assert.ok(Math.abs(discDistance(z, other) - measuredDistance(z, other)) < 1e-9);
    assert.ok(Math.abs(distanceToStreamline(z, j + 1) - measuredDistanceToGeodesic(z, streamline(j + 1))) < 1e-9);
    farthest = Math.max(farthest, t);
    checks += 1;
  });
  assert.ok(worstSummit < LAW_TOLERANCE, `the summit law misses by ${worstSummit}`);
  assert.ok(worstSide < LAW_TOLERANCE, `the side law misses by ${worstSide}`);
  // Not vacuous: the readings reach far enough from the bank for d0 to have grown many times.
  assert.ok(farthest > 9, `the farthest petal is only ${farthest} from the bank`);
  assert.ok(2 * Math.asinh(Math.sinh(D0 / 2) * Math.cosh(farthest)) > 100 * D0);
  assert.ok(checks > 0.97 * REGISTERED.readings);

  // The two laws are different laws: the distances drawn between two petals reject (b).
  let rejected = 0;
  let considered = 0;
  forEachReading(({ j, side, t, z }) => {
    if (j === STREAMLINES || t < 0.1) return;
    considered += 1;
    if (sideMiss(measuredDistance(z, discPoint((j + 1) * D0, side, t)), t, D0) > LAW_TOLERANCE) rejected += 1;
  });
  assert.equal(rejected, considered);
  assert.equal(rejected, REGISTERED.misattributedRejected);
});

test("pin 4: the plane's rule keeps its spacing, and the disc's check says so", () => {
  // The plane rule with the disc's spacing and the disc's distances from the bank: petals at
  // (t, j d0) and (t, (j + 1) d0). The same check that the disc passes fails here, at every
  // reading a hundredth or more from the bank.
  let held = 0;
  let failed = 0;
  let checked = 0;
  forEachReading(({ j, t }) => {
    if (j === STREAMLINES || t < 0.01) return;
    const here = { x: t, y: j * D0 };
    const there = { x: t, y: (j + 1) * D0 };
    const d = Math.hypot(there.x - here.x, there.y - here.y);
    assert.ok(Math.abs(d - D0) < 1e-15, "the plane rule does not keep d0");
    if (summitMiss(d, t, D0) < LAW_TOLERANCE) held += 1;
    else failed += 1;
    checked += 1;
  });
  assert.equal(held, 0);
  assert.equal(failed, checked);
  assert.ok(checked > 0.97 * REGISTERED.readings);
  // And the other way: the disc's distances do not keep d0.
  let constant = 0;
  forEachReading(({ j, side, t, z }) => {
    if (j === STREAMLINES || t < 0.1) return;
    if (Math.abs(measuredDistance(z, discPoint((j + 1) * D0, side, t)) - D0) < 1e-12) constant += 1;
  });
  assert.equal(constant, 0);
});

test("pin 5: every line drawn is a geodesic, every stroke of the brush has its ends on its own and reaches the brush's width from it, and every petal is on its own", () => {
  const drawn = [BANK, ...STREAMLINE_LIST];
  assert.equal(drawn.length, REGISTERED.geodesicsDrawn);
  assert.equal(STREAMLINE_LIST.length, 2 * STREAMLINES + 1);
  let arcs = 0;
  let diameters = 0;
  for (const line of drawn) {
    assert.ok(geodesicDefect(line) < 1e-12, `streamline ${line.j} is not a geodesic`);
    if (line.kind === "diameter") {
      // A chord of the rim through the centre: its ends are opposite points of the rim.
      assert.equal(Math.hypot(line.from.x, line.from.y), 1);
      assert.equal(line.from.x + line.to.x, 0);
      assert.equal(line.from.y + line.to.y, 0);
      diameters += 1;
      continue;
    }
    const c2 = line.centre.x ** 2 + line.centre.y ** 2;
    assert.ok(Math.abs(c2 - line.radius ** 2 - 1) < 1e-12 * c2, `streamline ${line.j}: |c|^2 - r^2 = ${c2 - line.radius ** 2}`);
    // It crosses the bank at right angles at the bank's point, and meets the rim at its ends.
    assert.ok(Math.abs(line.centre.x) === 0);
    assert.ok(Math.abs(Math.abs(line.centre.y - line.bank) - line.radius) < 1e-12 * line.radius);
    assert.ok(Math.abs(line.bank - Math.tanh((line.j * D0) / 2)) < 1e-15);
    for (const end of line.ends) {
      assert.ok(Math.abs(Math.hypot(end.x, end.y) - 1) < 1e-12);
      assert.ok(Math.abs(Math.hypot(end.x - line.centre.x, end.y - line.centre.y) - line.radius) < 1e-12 * line.radius);
    }
    arcs += 1;
  }
  assert.equal(arcs, 2 * STREAMLINES);
  assert.equal(diameters, 2);

  // Each line is laid in strokes of a brush. A stroke is a spindle between two circular arcs
  // through the same two ends, and those ends are the line's own points at the stroke's two
  // distances along it. At its middle each arc reaches the brush's width times its lean from the
  // line, by the test's own distance, and nowhere along it more; one of the two leans is 1, so
  // the stroke reaches the brush's width; the two arcs lie on opposite sides of the line. The
  // strokes are each as long as drawn, the gaps between them too, and they run out both ways
  // to where the line is too near the rim to see.
  assert.equal(STROKE_WIDTH, 0.0042);
  assert.deepEqual(STROKE_LENGTH, [0.25, 0.6]);
  assert.deepEqual(STROKE_GAP, [0.015, 0.04]);
  assert.deepEqual(STROKE_LEAN, [0.5, 1]);
  assert.equal(STROKE_LIMIT, 2e-4);
  assert.equal(STROKES.length, drawn.length);
  const sideOf = (point, line) => (line.kind === "diameter"
    ? Math.sign((line.to.x - line.from.x) * point.y - (line.to.y - line.from.y) * point.x)
    : Math.sign(2 * (point.x * line.centre.x + point.y * line.centre.y) - (1 + point.x * point.x + point.y * point.y)));
  let strokes = 0;
  let worstEnd = 0;
  let worstReach = 0;
  let beyond = 0;
  let samples = 0;
  STROKES.forEach(({ line, strokes: list }, k) => {
    assert.equal(line, drawn[k]);
    const walk = walkAlong(line);
    list.forEach((stroke, n) => {
      strokes += 1;
      const length = stroke.to - stroke.from;
      assert.ok(length >= STROKE_LENGTH[0] && length <= STROKE_LENGTH[1]);
      if (n > 0) {
        const gap = stroke.from - list[n - 1].to;
        assert.ok(gap >= STROKE_GAP[0] && gap <= STROKE_GAP[1], `a gap of ${gap}`);
      }
      assert.ok(stroke.lean.includes(1));
      const other = stroke.lean[0] === 1 ? stroke.lean[1] : stroke.lean[0];
      assert.ok(other >= STROKE_LEAN[0] && other <= STROKE_LEAN[1]);
      const [over, under] = stroke.arcs;
      const P = walk.point(stroke.from);
      const Q = walk.point(stroke.to);
      for (const [a, b] of [[over.from, P], [over.to, Q], [under.from, Q], [under.to, P]]) {
        worstEnd = Math.max(worstEnd, Math.hypot(a.x - b.x, a.y - b.y) / b.rest);
      }
      for (const arc of stroke.arcs) {
        for (const end of [P, Q]) assert.ok(Math.abs(Math.hypot(end.x - arc.centre.x, end.y - arc.centre.y) - arc.radius) < 1e-9 * arc.radius);
      }
      stroke.arcs.forEach((arc, side) => {
        const want = STROKE_WIDTH * stroke.lean[side];
        worstReach = Math.max(worstReach, Math.abs(measuredDistanceToGeodesic(arc.mid, line) / want - 1));
        for (const point of arcPoints(arc, 32).slice(1, -1)) {
          beyond = Math.max(beyond, measuredDistanceToGeodesic(point, line) / want - 1);
          samples += 1;
        }
      });
      assert.equal(sideOf(over.mid, line) * sideOf(under.mid, line), -1, `a stroke of line ${k} lies on one side of it`);
    });
    const [first, last] = [list[0], list.at(-1)];
    assert.ok(walk.point(first.to).rest >= STROKE_LIMIT && walk.point(first.from).rest < 1.05 * STROKE_LIMIT);
    assert.ok(walk.point(last.from).rest >= STROKE_LIMIT && walk.point(last.to).rest < 1.05 * STROKE_LIMIT);
  });
  assert.equal(strokes, REGISTERED.strokes);
  assert.equal(samples, strokes * 2 * 31);
  assert.ok(worstEnd < 1e-10, `a stroke's end is ${worstEnd} off its line's point`);
  assert.ok(worstReach < REACH_TOLERANCE, `a stroke reaches ${worstReach} off its width`);
  assert.ok(beyond < REACH_TOLERANCE, `a stroke goes ${beyond} of its width beyond it`);
  // The control: the plane's stroke, the spindle at its size at the centre moved rigidly to the
  // stroke's middle, its arcs as far from the line in the drawing as at the centre. Away from
  // the centre it does not reach the brush's width.
  let considered = 0;
  let missed = 0;
  for (const { line, strokes: list } of STROKES) {
    const walk = walkAlong(line);
    for (const stroke of list) {
      const middle = walk.point((stroke.from + stroke.to) / 2);
      if (Math.hypot(middle.x, middle.y) < 0.01) continue;
      considered += 1;
      const heading = walk.heading((stroke.from + stroke.to) / 2);
      const reach = Math.tanh(STROKE_WIDTH / 2);
      const apex = { x: middle.x - reach * Math.sin(heading), y: middle.y + reach * Math.cos(heading) };
      if (Math.abs(measuredDistanceToGeodesic(apex, line) / STROKE_WIDTH - 1) > 1e-6) missed += 1;
    }
  }
  assert.equal(missed, considered);
  assert.ok(considered > 0.99 * REGISTERED.strokes);

  // Every petal lies on the streamline it fell on.
  let worst = 0;
  forEachReading(({ j, z }) => {
    const line = streamline(j);
    const off = line.kind === "diameter"
      ? Math.abs(z.y)
      : Math.abs(Math.hypot(z.x - line.centre.x, z.y - line.centre.y) - line.radius) / line.radius;
    worst = Math.max(worst, off);
  });
  assert.ok(worst < 1e-12, `a petal is ${worst} off its streamline`);
  // The control: the plane's streamlines drawn in the disc, horizontal chords at the bank's
  // points, put through the same test. A straight geodesic must pass through the centre, and
  // none of these does but the diameter.
  let chords = 0;
  for (const line of STREAMLINE_LIST) {
    const a = line.kind === "diameter" ? 0 : line.bank;
    const half = Math.sqrt(1 - a * a);
    if (geodesicDefect({ kind: "diameter", from: { x: -half, y: a }, to: { x: half, y: a } }) > 1e-12) chords += 1;
  }
  assert.equal(chords, 2 * STREAMLINES);
});
test("pin 6: the view holds close, zooms out at one rate in the logarithm, and holds the whole disc; close up it passes for the plane, and far off it does not", () => {
  // The scale never grows; it is the opening scale to frame 150, the whole disc from frame 390,
  // and between them its logarithm falls by ln 8 / 240 every frame, to within rounding.
  const rate = Math.log(OPENING_SCALE) / ZOOM_FRAMES;
  let zooming = 0;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const scale = viewScale(frame);
    assert.equal(sceneAt(frame).scale, scale);
    if (frame <= HOLD_FRAMES) assert.equal(scale, OPENING_SCALE);
    if (frame >= ZOOM_END) assert.equal(scale, 1);
    if (frame + 1 < TOTAL_FRAMES) {
      const next = viewScale(frame + 1);
      assert.ok(next <= scale, `the view grows at frame ${frame}`);
      if (frame >= HOLD_FRAMES && frame < ZOOM_END) {
        assert.ok(Math.abs(Math.log(scale) - Math.log(next) - rate) < 1e-12, `frame ${frame} zooms at ${Math.log(scale) - Math.log(next)}`);
        zooming += 1;
      } else {
        assert.equal(next, scale);
      }
    }
  }
  assert.equal(zooming, ZOOM_FRAMES);
  assert.ok(Math.abs(rate - 0.008664) < 1e-6);

  // Close up, the lines in the frame pass for straight and evenly spaced. A line's bow is how
  // far its centreline runs from its tangent at the bank, at 170 pixels from the bank (the
  // middle half of the frame) and at the frame's edge, 340; its gap is the height between it and
  // the next line in.
  const k = pixelsPerUnit(0);
  const inFrame = STREAMLINE_LIST.filter((line) => Math.abs(k * heightAt(line, 0)) <= CENTRE);
  assert.equal(inFrame.length, REGISTERED.linesInTheOpening);
  // The next lines out lie beyond the frame.
  for (const j of [-(inFrame.length + 1) / 2, (inFrame.length + 1) / 2]) assert.ok(Math.abs(k * heightAt(streamline(j), 0)) > CENTRE);
  const bow = (reach) => Math.max(...inFrame.map((line) => Math.abs(k * (heightAt(line, reach / k) - heightAt(line, 0)))));
  assert.equal(bow(170).toFixed(3), REGISTERED.openingBow.middleHalf);
  assert.equal(bow(340).toFixed(3), REGISTERED.openingBow.frame);
  assert.ok(bow(170) < 2 && bow(340) < 0.01 * LOGICAL_SIZE);
  const gaps = (reaches) => {
    const all = [];
    for (const reach of reaches) {
      for (let j = 1; j <= (inFrame.length - 1) / 2; j += 1) {
        for (const sign of [-1, 1]) {
          all.push(Math.abs(k * (heightAt(streamline(sign * j), reach / k) - heightAt(streamline(sign * (j - 1)), reach / k))));
        }
      }
    }
    return [Math.min(...all).toFixed(2), Math.max(...all).toFixed(2)];
  };
  const steps = (limit) => Array.from({ length: 2 * limit + 1 }, (_, n) => n - limit);
  assert.deepEqual(gaps(steps(170)), REGISTERED.openingGap.middleHalf);
  assert.deepEqual(gaps(steps(340)), REGISTERED.openingGap.frame);

  // The plane's rule in the same view: line j straight across at j d0 / 2 from the centre, and
  // a petal t from the bank at t / 2 along it, the lengths of the disc's centre. How far each
  // petal in view, and each line's centreline in the frame, is from where that rule would put
  // it, in pixels: a few while the view holds close, hundreds in the whole view, where the rule
  // would put most petals outside the frame altogether.
  const offsets = (frames) => {
    let largest = 0;
    let outside = 0;
    let petals = 0;
    for (const frame of frames) {
      const scale = pixelsPerUnit(frame);
      for (const { j, side, t, z } of sceneAt(frame).petals) {
        if (Math.abs(scale * z.x) > CENTRE || Math.abs(scale * z.y) > CENTRE) continue;
        const plane = { x: (side * t) / 2, y: (j * D0) / 2 };
        largest = Math.max(largest, scale * Math.hypot(z.x - plane.x, z.y - plane.y));
        if (Math.abs(scale * plane.x) > CENTRE || Math.abs(scale * plane.y) > CENTRE) outside += 1;
        petals += 1;
      }
    }
    return { largest, outside, petals };
  };
  const opening = offsets(Array.from({ length: HOLD_FRAMES + 1 }, (_, frame) => frame));
  const whole = offsets([REGISTERED.thumbnail]);
  const lineOffset = Math.max(...inFrame.flatMap((line) => steps(340).map((reach) => Math.abs(k * heightAt(line, reach / k) - (k * line.j * D0) / 2))));
  assert.equal(opening.largest.toFixed(1), REGISTERED.planeOffset.opening);
  assert.equal(lineOffset.toFixed(2), REGISTERED.planeOffset.openingLines);
  assert.equal(opening.outside, REGISTERED.planeOffset.openingOutOfFrame);
  assert.equal(opening.petals, REGISTERED.planeOffset.openingPetals);
  assert.equal(whole.largest.toFixed(1), REGISTERED.planeOffset.whole);
  assert.equal(whole.petals, REGISTERED.planeOffset.wholePetals);
  assert.equal(whole.outside, REGISTERED.planeOffset.wholeOutOfFrame);
  assert.ok(whole.largest > 50 * opening.largest);
});

test("pin 7: a petal's heading follows the line of water it lies along, turning across the stream as it goes", () => {
  let worst = 0;
  let turned = 0;
  let failed = 0;
  let considered = 0;
  forEachReading((petal) => {
    const theta = wrap(drawnHeading(petal) - measuredFlow(petal));
    worst = Math.max(worst, Math.abs(wrap(theta - lawAngle(petal))));
    if (Math.abs(wrap(petal.theta - landed(petal))) > 0.5) turned += 1;
    // The control: the plane's angle, the landing angle and the spin's turn and nothing from
    // the water, fails the disc's law once the water has carried the petal a tenth from the bank.
    if (petal.t >= 0.1) {
      considered += 1;
      if (Math.abs(wrap(landed(petal) - lawAngle(petal))) >= SHAPE_TOLERANCE) failed += 1;
    }
  });
  assert.ok(worst < SHAPE_TOLERANCE, `a heading is off the law by ${worst} radians`);
  // Not vacuous: the petals did turn, many of them far.
  assert.ok(turned > 0.25 * REGISTERED.readings, `only ${turned} readings turned by more than half a radian`);
  assert.ok(failed > 0.99 * considered && considered > 0.9 * REGISTERED.readings, `${failed} of ${considered} failed`);
});

test("the clip is reproduced from the seed alone, and a frame depends on its index and nothing else", () => {
  const again = buildSchedule();
  assert.deepEqual(again, SCHEDULE);
  assert.deepEqual(layStrokes(), STROKES);
  const digest = (scene) => {
    const hash = createHash("sha256");
    hash.update(`${scene.frameIndex} ${scene.seconds} ${scene.scale} ${scene.petals.length}`);
    for (const petal of scene.petals) {
      hash.update(`${petal.index} ${petal.z.x} ${petal.z.y} ${petal.heading} ${petal.fade}`);
      for (const arc of petal.arcs) hash.update(` ${arc.centre.x} ${arc.centre.y} ${arc.radius} ${arc.anticlockwise}`);
    }
    return hash.digest("hex");
  };
  const forward = [];
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const scene = sceneAt(frame);
    assert.equal(scene.frameIndex, frame);
    forward.push(digest(scene));
  }
  for (let frame = TOTAL_FRAMES - 1; frame >= 0; frame -= 7) assert.equal(digest(sceneAt(frame)), forward[frame]);
  assert.equal(new Set(forward).size, TOTAL_FRAMES);
  assert.equal(sceneAt(-1).frameIndex, 0);
  assert.equal(sceneAt(TOTAL_FRAMES + 9).frameIndex, TOTAL_FRAMES - 1);
  assert.equal(pageFrame(0), 0);
  assert.equal(pageFrame(1), PLAYBACK_FPS);
  assert.equal(pageFrame(DURATION_SECONDS), TOTAL_FRAMES - 1);
  assert.equal(pageFrame(1000), TOTAL_FRAMES - 1);
  // A petal appears at the bank, on the bank diameter.
  const start = discPoint(5 * D0, -1, 0);
  assert.ok(start.x === 0);
  assert.ok(Math.abs(start.y - Math.tanh((5 * D0) / 2)) < 1e-16);
  // The water is full when the clip begins: petals have been falling since nearly PRE_ROLL
  // seconds before it.
  assert.ok(sceneAt(0).petals.length > 600);
  assert.ok(SCHEDULE.falls[0].release < 1 - PRE_ROLL);
  const sketch = readFileSync(new URL("../artworks/another-heaven-and-earth/sketch.js", import.meta.url), "utf8");
  assert.match(sketch, /const frame = pageFrame\(\(performance\.now\(\) - startedAt\) \/ 1000\);\n {4}publishState\(drawFrame\(frame\)\);/u);
  assert.match(sketch, /if \(frame === TOTAL_FRAMES - 1\) p\.noLoop\(\);/u);
});

test("the quotation is the couplet, credited to the poem without a date, and fits a post", () => {
  assert.deepEqual(ARTWORK.quoteIds, ["li-bai-peach-blossom-water"]);
  assert.equal(QUOTE.author, "Li Bai");
  assert.equal(QUOTE.source, "Question and Answer in the Mountains");
  assert.equal(QUOTE.rendering, "English rendering");
  assert.equal(QUOTE.year, null);
  assert.equal(QUOTE.original.lang, "lzh");
  assert.equal(QUOTE.original.author, "李白");
  assert.equal(QUOTE.original.source, "山中問荅");
  assert.equal(QUOTE.original.text, "桃花流水窅然去，別有天地非人間。");
  assert.equal(QUOTE.original.year, null);
  assert.equal(QUOTE.sourceUrl, "https://zh.wikisource.org/wiki/%E5%85%A8%E5%94%90%E8%A9%A9/%E5%8D%B7178");
  assert.equal(QUOTE.original.sourceUrl, QUOTE.sourceUrl);

  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">Another Heaven and Earth</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.match(card, /<cite class="card__cite">—&nbsp;<b>Li Bai<\/b>, Question and Answer in the Mountains<\/cite>/u);

  const body = buildPostBody(ARTWORK, QUOTE, MANIFEST.defaults.interactiveBaseUrl);
  const weight = validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters);
  assert.ok(weight <= MANIFEST.defaults.maxWeightedCharacters);
  assert.ok(body.includes("— Li Bai, Question and Answer in the Mountains\n"));
});

test("the palette is Truchet Tides' paper and ink, the petals in it shaded from full to pale and the water thinned, nothing glows, and nothing but the picture is drawn", () => {
  const sketch = readFileSync(new URL("../artworks/another-heaven-and-earth/sketch.js", import.meta.url), "utf8");
  const reference = readFileSync(new URL("../artworks/truchet-tides/sketch.js", import.meta.url), "utf8");
  const literal = (source, name) => {
    const match = source.match(new RegExp(`const ${name} = (\\[[^;]*\\]);`, "u"));
    assert.ok(match, `${name} is not declared`);
    return JSON.parse(match[1]);
  };
  for (const name of ["PAPER", "INK"]) assert.deepEqual(literal(sketch, name), literal(reference, name), name);
  const number = (name) => {
    const match = sketch.match(new RegExp(`const ${name} = ([0-9.]+);`, "u"));
    assert.ok(match, `${name} is not declared`);
    return Number(match[1]);
  };
  // One ink: the petals shaded from full strength to pale, the water thinned, the bank between.
  assert.equal(number("PETAL_ALPHA"), 1);
  assert.equal(number("PETAL_PALE"), 0.3);
  assert.equal(number("SHADED"), 4);
  assert.ok(number("WATER_ALPHA") < number("BANK_ALPHA") && number("BANK_ALPHA") < 1);
  assert.equal(number("SMALLEST"), 0.1);
  assert.match(sketch, /p\.background\(\.\.\.PAPER\);/u);
  assert.equal((sketch.match(/rgba\(INK, /gu) ?? []).length, 5);
  // Nothing glows: nothing is added to what lies beneath, nothing blurred, no halo; the one gradient
  // is the shading across a petal, from its darker side's widest point to the other's.
  assert.doesNotMatch(sketch, /globalCompositeOperation|shadowBlur|createRadialGradient|drawImage/u);
  assert.equal((sketch.match(/createLinearGradient/gu) ?? []).length, 1);
  // Every stroke and every petal is drawn as the arcs it is, and what is too small to see is not filled.
  assert.equal(number("THINNEST"), 0.05);
  assert.match(sketch, /if \(scale \* strokeLength\(stroke\) < SMALLEST \|\| scale \* strokeWidth\(stroke\) < THINNEST \|\| !inView\(stroke\.arcs, scale\)\) continue;\n {8}traceArcs\(stroke\.arcs, scale\);/u);
  assert.match(sketch, /scene\.petals\.filter\(\(petal\) => scale \* petalLength\(petal\) >= SMALLEST && inView\(petal\.arcs, scale\)\)/u);
  assert.match(sketch, /for \(const petal of list\) traceArcs\(petal\.arcs, scale\);/u);
  assert.match(sketch, /ctx\.fillStyle = shade;\n {4}ctx\.beginPath\(\);\n {4}traceArcs\(petal\.arcs, scale\);\n {4}ctx\.fill\(\);/u);
  assert.match(sketch, /for \(const petal of shown\) if \(scale \* petalLength\(petal\) >= SHADED\) fillShaded\(petal, scale\);/u);
  assert.match(sketch, /ctx\.arc\(CENTRE \+ scale \* arc\.centre\.x, CENTRE \+ scale \* arc\.centre\.y, scale \* arc\.radius, a0, a1, arc\.anticlockwise\);/u);
  assert.doesNotMatch(sketch, /drawKeyHint|fillText|strokeText|__KEY_HINT_BOUNDS__/u);
});
test("the manifest, notes and module agree on the clip", () => {
  assert.deepEqual(ARTWORK.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(ARTWORK.render, { kind: "video", artifact: "exports/p5js/AnotherHeavenAndEarth.mp4", durationSeconds: DURATION_SECONDS, scale: 2 });
  assert.equal(ARTWORK.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.equal(MANIFEST.defaults.fps, PLAYBACK_FPS);
  // The card shows the whole disc, two and a half seconds after the zoom ends.
  assert.equal(ARTWORK.thumbnail.frame, REGISTERED.thumbnail);
  assert.equal(viewScale(ARTWORK.thumbnail.frame), 1);
  assert.equal(sceneAt(ARTWORK.thumbnail.frame).seconds, 15.5);
  const notes = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(notes, /\| `another-heaven-and-earth` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 22 seconds,/u);
  const section = notes.slice(notes.indexOf("### Another Heaven and Earth"), notes.indexOf("## Install"));
  assert.ok(section.length > 1000, "the notes have no section for the artwork");
  assert.match(section, new RegExp(`${REGISTERED.readings.toLocaleString("en-US")} readings`, "u"));
  assert.match(section, new RegExp(`all ${REGISTERED.geodesicsDrawn} lines`, "u"));
  assert.match(section, new RegExp(`${REGISTERED.openingBow.middleHalf} pixels`, "u"));
  assert.match(section, new RegExp(`${REGISTERED.openingBow.frame} pixels`, "u"));
  assert.match(section, new RegExp(`the thumbnail is frame ${ARTWORK.thumbnail.frame}\\.`, "u"));
  const root = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  assert.match(root, /\| \[Another Heaven and Earth\]\(p5js\/artworks\/another-heaven-and-earth\/\) \|/u);
});
