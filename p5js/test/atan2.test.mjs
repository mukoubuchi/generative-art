import assert from "node:assert/strict";
import test from "node:test";
import {
  angleArc,
  polarAngle,
  projectionDots,
  sweptPoint
} from "../artworks/atan2/projection.js";

const TOTAL_FRAMES = 8 * 30;
const RADIUS = 680 * 0.25;

test("the sweep covers a full turn and returns to where it started", () => {
  const first = sweptPoint(0, TOTAL_FRAMES, RADIUS);
  const wrapped = sweptPoint(TOTAL_FRAMES, TOTAL_FRAMES, RADIUS);

  assert.ok(Math.abs(first.x - RADIUS) < 1e-9);
  assert.ok(Math.abs(first.y) < 1e-9);
  assert.ok(Math.abs(wrapped.x - first.x) < 1e-9);
  assert.ok(Math.abs(wrapped.y - first.y) < 1e-9);
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const point = sweptPoint(frame, TOTAL_FRAMES, RADIUS);
    assert.ok(Math.abs(Math.hypot(point.x, point.y) - RADIUS) < 1e-9);
  }
});

test("the sweep visits both branches of atan2, including the jump at PI", () => {
  const angles = [];
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    angles.push(polarAngle(sweptPoint(frame, TOTAL_FRAMES, RADIUS)));
  }

  assert.ok(angles.some((angle) => angle > 0));
  assert.ok(angles.some((angle) => angle < 0));
  // Exactly one step should cross the branch cut, where the reported angle drops by
  // about a full turn even though the point moved a fraction of a degree.
  const jumps = angles.filter(
    (angle, index) => index > 0 && Math.abs(angle - angles[index - 1]) > Math.PI
  );
  assert.equal(jumps.length, 1);
});

test("the angle arc is drawn from zero towards the point, whichever sign it has", () => {
  assert.deepEqual(angleArc(1.2), { start: 0, end: 1.2 });
  assert.deepEqual(angleArc(-1.2), { start: -1.2, end: 0 });
  assert.deepEqual(angleArc(0), { start: 0, end: 0 });
});

test("projection dots step from each axis towards the point and stop short of it", () => {
  const point = { x: 42, y: -37 };
  const spacing = 5;
  const dots = projectionDots(point, spacing);
  const horizontal = dots.filter((dot) => dot.y === point.y);
  const vertical = dots.filter((dot) => dot.x === point.x);

  assert.equal(horizontal.length, Math.ceil(Math.abs(point.x) / spacing));
  assert.equal(vertical.length, Math.ceil(Math.abs(point.y) / spacing));
  assert.ok(horizontal.every((dot) => dot.x >= 0 && dot.x < point.x));
  assert.ok(vertical.every((dot) => dot.y <= 0 && dot.y > point.y));
});

test("a point on an axis produces dots along that axis only", () => {
  const dots = projectionDots({ x: 30, y: 0 }, 5);

  assert.equal(dots.length, 6);
  assert.ok(dots.every((dot) => dot.y === 0));
});
