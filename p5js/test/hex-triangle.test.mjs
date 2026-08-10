import assert from "node:assert/strict";
import test from "node:test";
import {
  PATH_COUNT,
  PATH_RADIUS_RATIO,
  PATH_ROTATION,
  STEPS_PER_CYCLE,
  STEPS_PER_SECOND,
  TRIANGLES_PER_PATH,
  TRIANGLE_COUNT,
  TRIANGLE_RADIUS_RATIO,
  trianglesAt,
  triangleShape
} from "../artworks/hex-triangle/orbit.js";

const PATH_RADIUS = 196.3;
const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const place = (step) => trianglesAt(step, PATH_RADIUS);
const asSet = (placed) => new Set(
  placed.map((item) => `${item.x.toFixed(6)},${item.y.toFixed(6)},${item.rotation.toFixed(6)}`)
);

test("six triangles ride two interleaved paths", () => {
  assert.equal(TRIANGLE_COUNT, PATH_COUNT * TRIANGLES_PER_PATH);
  assert.equal(place(0).length, TRIANGLE_COUNT);
  assert.equal(PATH_ROTATION, Math.PI / 3);
});

test("the radii are the ones the original actually produced", () => {
  // `(1 + 1/2)` was integer division in Java, so the factor was 1, not 1.5.
  assert.ok(Math.abs(PATH_RADIUS_RATIO - Math.sin(Math.PI / 3)) < 1e-12);
  assert.ok(Math.abs(TRIANGLE_RADIUS_RATIO - 0.5) < 1e-12);
  // Path radius plus triangle radius has to stay inside the half canvas.
  const reach = PATH_RADIUS_RATIO * (1 + TRIANGLE_RADIUS_RATIO);
  assert.ok(reach < 1.5, "the figure would not fit if the factor were 1.5");
  assert.ok(Math.abs(reach - 1.299) < 0.001);
});

test("at the start of a cycle the triangles stand on their corners", () => {
  for (const placed of place(0)) {
    assert.ok(Math.abs(Math.hypot(placed.x, placed.y) - PATH_RADIUS) < 1e-9);
  }
});

test("a whole cycle returns the same six places, so the clip loops", () => {
  assert.deepEqual(asSet(place(STEPS_PER_CYCLE)), asSet(place(0)));
  assert.deepEqual(asSet(place(3 * STEPS_PER_CYCLE + 17)), asSet(place(17)));
});

test("the two paths point their triangles opposite ways", () => {
  const shapes = place(0).map((placed) => triangleShape(1, placed.rotation));
  const firstPathApex = Math.atan2(shapes[0][0].y, shapes[0][0].x);
  const secondPathApex = Math.atan2(
    shapes[TRIANGLES_PER_PATH][0].y,
    shapes[TRIANGLES_PER_PATH][0].x
  );

  // A sixth of a turn on a three-fold shape is a half period, so the triangles invert.
  assert.ok(Math.abs(secondPathApex - firstPathApex - PATH_ROTATION) < 1e-9);
});

test("every triangle keeps its shape and size wherever it is", () => {
  for (const step of [0, 31, 63, 94, 125]) {
    for (const placed of place(step)) {
      const vertices = triangleShape(10, placed.rotation);
      const sides = vertices.map((vertex, index) => {
        const next = vertices[(index + 1) % vertices.length];
        return Math.hypot(next.x - vertex.x, next.y - vertex.y);
      });
      for (const side of sides) {
        assert.ok(Math.abs(side - 10 * Math.sqrt(3)) < 1e-9);
      }
    }
  }
});

test("the clip is a whole number of frames and cycles", () => {
  assert.equal(STEPS_PER_CYCLE % STEPS_PER_FRAME, 0);
  assert.equal(STEPS_PER_CYCLE / STEPS_PER_FRAME, 63);
  assert.equal(4 * STEPS_PER_CYCLE / STEPS_PER_FRAME, 252);
});
