import assert from "node:assert/strict";
import test from "node:test";
import { SIZE, FPS, DURATION, FRAMES, DARK, LIGHT, NEUTRAL, RIBBON_WIDTH,
  ribbonPoints, makeCells, cellColour, contextState, pageFrame } from "../artworks/beside-itself/field.js";

const cells = makeCells();

test("the context cells partition the canvas and contain their own nearest sites", () => {
  let area = 0;
  for (const cell of cells) {
    assert.ok(cell.polygon.length >= 3);
    let twiceArea = 0;
    for (let i = 0; i < cell.polygon.length; i++) {
      const a = cell.polygon[i], b = cell.polygon[(i + 1) % cell.polygon.length];
      twiceArea += a[0] * b[1] - b[0] * a[1];
      for (const other of cells) {
        const ownDistance = (a[0] - cell.x) ** 2 + (a[1] - cell.y) ** 2;
        const otherDistance = (a[0] - other.x) ** 2 + (a[1] - other.y) ** 2;
        assert.ok(ownDistance - otherDistance < 1e-7);
      }
    }
    assert.ok(twiceArea > 0);
    area += twiceArea / 2;
  }
  assert.ok(Math.abs(area - SIZE * SIZE) < 1e-7);
});

test("the spiral winds continuously, fits with its full width, and separates neighbouring turns", () => {
  const points = ribbonPoints();
  let turn = 0, previousAngle, largestStep = 0;
  const radii = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    assert.ok(x > RIBBON_WIDTH / 2 && x < SIZE - RIBBON_WIDTH / 2);
    assert.ok(y > RIBBON_WIDTH / 2 && y < SIZE - RIBBON_WIDTH / 2);
    const dx = (x - SIZE / 2) / 0.98, dy = (y - SIZE / 2) / 0.95;
    const angle = Math.atan2(dy, dx);
    if (previousAngle !== undefined) {
      let step = angle - previousAngle;
      if (step < -Math.PI) step += 2 * Math.PI;
      assert.ok(step > 0 && step < 0.02);
      turn += step;
      largestStep = Math.max(largestStep, Math.hypot(x - points[i - 1][0], y - points[i - 1][1]));
    }
    previousAngle = angle;
    radii.push(Math.hypot(dx, dy));
  }
  assert.ok(Math.abs(turn / (2 * Math.PI) - 10.35) < 1e-12);
  assert.ok(largestStep < 5);
  // Compare radii one complete revolution apart, interpolating the neighbouring sample.
  const pitch = 5000 / 10.35;
  let closest = Infinity;
  for (let i = 0; i + pitch + 1 < radii.length; i++) {
    const j = Math.floor(i + pitch), f = i + pitch - j;
    closest = Math.min(closest, (radii[j] * (1 - f) + radii[j + 1] * f - radii[i]) * 0.95);
  }
  assert.ok(closest > 2 * RIBBON_WIDTH);
});

test("the complete sequence has a genuinely uniform interval and moving contrasting surroundings", () => {
  assert.equal(FRAMES, FPS * DURATION);
  let uniformFrames = 0, changedCells = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    const colours = cells.map((cell) => cellColour(cell, frame));
    for (const colour of colours) for (let channel = 0; channel < 3; channel++) {
      assert.ok(Number.isInteger(colour[channel]));
      assert.ok(colour[channel] >= DARK[channel] && colour[channel] <= LIGHT[channel]);
    }
    if (contextState(frame).contrast === 0) {
      uniformFrames++;
      for (const colour of colours) assert.deepEqual(colour, NEUTRAL);
    }
  }
  assert.equal(uniformFrames, 61);
  for (const cell of cells) {
    assert.deepEqual(cellColour(cell, 0), cellColour(cell, FRAMES));
    if (Math.abs(cellColour(cell, 90)[0] - cellColour(cell, 540)[0]) > 100) changedCells++;
    assert.deepEqual(cellColour(cell, 90, { uniform: true }), NEUTRAL);
  }
  assert.ok(changedCells > cells.length / 3);
  const bright = cells.filter((c) => cellColour(c, 90)[0] > 210).length;
  const dark = cells.filter((c) => cellColour(c, 90)[0] < 40).length;
  assert.ok(bright > 10 && dark > 10);
  // Removing the context variation actually destroys the premise, not the ribbon.
  assert.equal(new Set(cells.map((c) => cellColour(c, 90, { uniform: true }).join(","))).size, 1);
  assert.ok(new Set(cells.map((c) => cellColour(c, 90).join(","))).size > 1);
});

test("ordinary playback follows elapsed time and closes at the full period", () => {
  assert.equal(pageFrame(3), 90);
  assert.equal(pageFrame(DURATION), 0);
  assert.equal(pageFrame(DURATION + 3), 90);
  assert.equal(pageFrame(-1), 0);
});

test("holding comparison leaves the ongoing phase intact at every frame", () => {
  for (let frame = 0; frame < FRAMES; frame++) {
    const running = contextState(frame), held = contextState(frame, true);
    assert.equal(held.phase, running.phase);
    assert.equal(held.contrast, 0);
    assert.equal(held.comparison, true);
  }
});
