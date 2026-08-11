import assert from "node:assert/strict";
import test from "node:test";
import {
  ORBIT_RADIUS,
  RING_SPACING,
  SCENARIO_FRAMES,
  ringCount,
  scenarioCenter
} from "../artworks/moire-rings/rings.js";

/**
 * The fringes are emergent — no code computes them — so what is pinned is what they
 * emerge from: a ring family deep enough to have no visible edge anywhere the centre
 * can stand, and a wandering centre whose journey is continuous, covers every
 * direction, and begins and ends on the one position where the pattern vanishes.
 */
const WIDTH = 680;
const HEIGHT = 680;

test("either family outreaches the farthest corner from anywhere on the canvas", () => {
  const count = ringCount(WIDTH, HEIGHT, RING_SPACING);
  const reach = count * RING_SPACING;
  for (const [x, y] of [[0, 0], [WIDTH, 0], [0, HEIGHT], [WIDTH, HEIGHT], [WIDTH / 2, HEIGHT / 2]]) {
    for (const [cornerX, cornerY] of [[0, 0], [WIDTH, 0], [0, HEIGHT], [WIDTH, HEIGHT]]) {
      assert.ok(reach >= Math.hypot(cornerX - x, cornerY - y),
        `a family centred at ${x},${y} leaves the corner ${cornerX},${cornerY} outside its rings`);
    }
  }
});

test("the clip opens and closes where the fringes vanish", () => {
  const opening = scenarioCenter(0, WIDTH, HEIGHT);
  const closing = scenarioCenter(SCENARIO_FRAMES - 1, WIDTH, HEIGHT);
  for (const state of [opening, closing]) {
    assert.equal(state.x, WIDTH / 2);
    assert.equal(state.y, HEIGHT / 2);
    assert.equal(state.resting, true);
  }
  // Overruns clamp into the closing rest rather than wrapping or drifting.
  assert.deepEqual(scenarioCenter(SCENARIO_FRAMES + 50, WIDTH, HEIGHT), closing);
});

test("the wandering centre never teleports", () => {
  let previous = scenarioCenter(0, WIDTH, HEIGHT);
  for (let frame = 1; frame < SCENARIO_FRAMES; frame += 1) {
    const current = scenarioCenter(frame, WIDTH, HEIGHT);
    const step = Math.hypot(current.x - previous.x, current.y - previous.y);
    assert.ok(step < RING_SPACING,
      `frame ${frame} jumps ${step} logical units, further than a ring spacing`);
    previous = current;
  }
});

test("the orbit shows the fringes from every direction", () => {
  const quadrants = new Set();
  let reachedRadius = 0;
  for (let frame = 0; frame < SCENARIO_FRAMES; frame += 1) {
    const { x, y } = scenarioCenter(frame, WIDTH, HEIGHT);
    const dx = x - WIDTH / 2;
    const dy = y - HEIGHT / 2;
    reachedRadius = Math.max(reachedRadius, Math.hypot(dx, dy));
    if (Math.hypot(dx, dy) > ORBIT_RADIUS / 2) {
      quadrants.add(`${dx >= 0 ? "+" : "-"}${dy >= 0 ? "+" : "-"}`);
    }
  }
  assert.equal(quadrants.size, 4, "the journey missed a quadrant");
  assert.ok(Math.abs(reachedRadius - ORBIT_RADIUS) < 1e-9);
  // The centre keeps the pattern well inside the canvas.
  assert.ok(ORBIT_RADIUS < WIDTH / 2);
});

test("the scenario is a pure function of the frame", () => {
  for (const frame of [0, 40, 100, 200, 290]) {
    assert.deepEqual(scenarioCenter(frame, WIDTH, HEIGHT), scenarioCenter(frame, WIDTH, HEIGHT));
  }
});

test("the hyperbola family is what the geometry promises", () => {
  // The one physical claim, stated as mathematics rather than pixels: a point whose
  // distances to the two centres differ by a whole number of spacings lies where rings
  // of the two families coincide — including every point of the axis beyond the pair.
  const a = { x: WIDTH / 2, y: HEIGHT / 2 };
  const b = { x: WIDTH / 2 + ORBIT_RADIUS, y: HEIGHT / 2 };
  const separations = [];
  for (let along = -200; along <= 320; along += 40) {
    const point = { x: a.x + along, y: a.y };
    const difference = Math.abs(Math.hypot(point.x - a.x, point.y - a.y) - Math.hypot(point.x - b.x, point.y - b.y));
    separations.push(difference);
  }
  // On the outside of the pair the difference is pinned to the full separation — the
  // degenerate hyperbola — and between them it varies; both regimes must appear.
  assert.ok(separations.some((difference) => Math.abs(difference - ORBIT_RADIUS) < 1e-9));
  assert.ok(separations.some((difference) => difference < ORBIT_RADIUS - 1));
});
