import assert from "node:assert/strict";
import test from "node:test";
import {
  WIDTH, HEIGHT, FPS, DURATION, FRAMES, potential,
  makeDrawing, inkSegments, travelled, pageFrame
} from "../artworks/through-both/field.js";

const drawing = makeDrawing();
const cross = (ax, ay, bx, by) => ax * by - ay * bx;

/** Intersections of deposited polyline segments, without consulting the analytic field. */
function crossings(first, second) {
  const size = 12, cells = new Map();
  const keys = ([x0, y0, x1, y1]) => {
    const result = [];
    for (let x = Math.floor(Math.min(x0, x1) / size); x <= Math.floor(Math.max(x0, x1) / size); x++) {
      for (let y = Math.floor(Math.min(y0, y1) / size); y <= Math.floor(Math.max(y0, y1) / size); y++) {
        result.push(`${x},${y}`);
      }
    }
    return result;
  };
  for (const line of first) for (const a of inkSegments(line)) {
    for (const key of keys(a)) {
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(a);
    }
  }
  const deviations = [];
  for (const line of second) for (const b of inkSegments(line)) {
    const candidates = new Set(keys(b).flatMap((key) => cells.get(key) ?? []));
    for (const a of candidates) {
      const ax = a[2] - a[0], ay = a[3] - a[1];
      const bx = b[2] - b[0], by = b[3] - b[1];
      const denominator = cross(ax, ay, bx, by);
      if (Math.abs(denominator) < 1e-12) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const ta = cross(dx, dy, bx, by) / denominator;
      const tb = cross(dx, dy, ax, ay) / denominator;
      if (ta < 0 || ta >= 1 || tb < 0 || tb >= 1) continue;
      const cosine = Math.abs((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)));
      deviations.push(Math.asin(Math.min(1, cosine)) * 180 / Math.PI);
    }
  }
  deviations.sort((a, b) => a - b);
  return { count: deviations.length, maximum: deviations.at(-1),
    median: deviations[Math.floor(deviations.length / 2)] };
}

// Undo the specified 173 px scale, -0.34 rad rotation and screen-y reflection.
// This deliberately does not call the production screenPoint or root solver.
function pointResidual({ x, y, u, v }) {
  const sx = (x - WIDTH / 2) / 173, sy = -(y - HEIGHT / 2) / 173;
  const zx = Math.cos(-0.34) * sx + Math.sin(-0.34) * sy;
  const zy = -Math.sin(-0.34) * sx + Math.cos(-0.34) * sy;
  const [actualU, actualV] = potential(zx, zy);
  return Math.hypot(actualU - u, actualV - v);
}

test("the saved drawing coordinates satisfy the prescribed field at every sampled path point", () => {
  let residual = 0;
  for (const line of [...drawing.warp, ...drawing.weft]) for (const point of line.points) {
    residual = Math.max(residual, pointResidual(point));
  }
  assert.ok(residual < 1e-12, `maximum residual ${residual}`);
  const saved = drawing.warp[0].points[0];
  const displaced = { ...saved, x: saved.x + 1 };
  assert.ok(pointResidual(displaced) > 0.01);
  assert.throws(() => assert.ok(pointResidual(displaced) < 1e-12));
});

test("the drawn branches fit, remain continuous, and finish within the film", (t) => {
  let largestStep = 0, lastArrival = 0;
  for (const line of [...drawing.warp, ...drawing.weft]) {
    assert.ok(line.length > 50);
    lastArrival = Math.max(lastArrival, line.end);
    for (let i = 0; i < line.points.length; i++) {
      const p = line.points[i];
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.x > 25 && p.x < WIDTH - 25 && p.y > 25 && p.y < HEIGHT - 25);
      if (i) largestStep = Math.max(largestStep, p.s - line.points[i - 1].s);
    }
  }
  assert.ok(largestStep < 5, `largest step ${largestStep}`);
  assert.ok(lastArrival < DURATION - 1, `last arrival ${lastArrival}`);
  t.diagnostic(JSON.stringify({ largestStep, lastArrival,
    firstFamily: drawing.warp.length, secondFamily: drawing.weft.length }));
});

test("removing either family leaves every point, timing and drawn segment of the other unchanged", () => {
  assert.deepEqual(makeDrawing({ warp: false }).weft, drawing.weft);
  assert.deepEqual(makeDrawing({ weft: false }).warp, drawing.warp);
  for (const family of ["warp", "weft"]) {
    const alone = makeDrawing({ [family === "warp" ? "weft" : "warp"]: false });
    for (const time of [0, 6, 12, 18, 24]) for (let i = 0; i < alone[family].length; i++) {
      const a = alone[family][i], b = drawing[family][i];
      assert.deepEqual(inkSegments(a, 0, travelled(a, time)), inkSegments(b, 0, travelled(b, time)));
    }
  }
});

test("the actual deposited segments cross near right angles; a different second field breaks that relation", (t) => {
  const shared = crossings(drawing.warp, drawing.weft);
  assert.ok(shared.count > 500, JSON.stringify(shared));
  assert.ok(shared.maximum < 1, JSON.stringify(shared));
  const altered = makeDrawing({ weftVariant: 1 });
  assert.deepEqual(altered.warp, drawing.warp);
  const different = crossings(altered.warp, altered.weft);
  assert.ok(different.count > 100, JSON.stringify(different));
  assert.ok(different.median > 10 && different.maximum > 45, JSON.stringify(different));
  // A detector that reports zero for every angle fails this deliberately oblique specimen.
  const line = (points) => ({ length: 2, points: points.map(([x, y], i) => ({ x, y, s: i * 2, ink: true })) });
  const specimen = crossings([line([[0, 0], [2, 0]])], [line([[0, -1], [2, 1]])]);
  assert.equal(specimen.count, 1);
  assert.ok(Math.abs(specimen.maximum - 45) < 1e-10);
  t.diagnostic(JSON.stringify({ shared, different }));
});

test("normal playback holds the completed drawing rather than resetting it", () => {
  assert.equal(FRAMES, FPS * DURATION);
  assert.equal(pageFrame(0), 0);
  assert.equal(pageFrame(12), 360);
  assert.equal(pageFrame(DURATION), FRAMES - 1);
  assert.equal(pageFrame(10000), FRAMES - 1);
  for (const line of [...drawing.warp, ...drawing.weft]) {
    assert.equal(travelled(line, 0), 0);
    assert.equal(travelled(line, (FRAMES - 1) / FPS), line.length);
  }
});
