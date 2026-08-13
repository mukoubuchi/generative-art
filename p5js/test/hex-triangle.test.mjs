import assert from "node:assert/strict";
import test from "node:test";
import {
  CYCLES,
  PATH_COUNT,
  PATH_RADIUS_RATIO,
  STEPS_PER_CYCLE,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  TRIANGLES_PER_PATH,
  TRIANGLE_COUNT,
  TRIANGLE_RADIUS_RATIO,
  gatheringAt,
  pathCorners,
  radiusAt,
  trianglesAt,
  triangleShape
} from "../artworks/hex-triangle/orbit.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const PATH_RADIUS = 1;
const TRIANGLE_RADIUS = PATH_RADIUS * TRIANGLE_RADIUS_RATIO;
const GATHERED_STEP = STEPS_PER_CYCLE / 2;

/** The six triangles as placed polygons at a given step. */
function placedTriangles(step) {
  return trianglesAt(step, PATH_RADIUS).map((placed) =>
    triangleShape(TRIANGLE_RADIUS, placed.rotation).map((vertex) => ({
      x: placed.x + vertex.x,
      y: placed.y + vertex.y
    })));
}

/**
 * A comparable key for a point. Anything below the precision being printed is zero,
 * so a coordinate that comes out as a hair under it does not print as a negative one.
 */
function pointKey({ x, y }) {
  const settle = (value) => (Math.abs(value) < 5e-10 ? 0 : value).toFixed(9);
  return `${settle(x)},${settle(y)}`;
}

function sideOf(point, from, to) {
  return (point.x - to.x) * (from.y - to.y) - (from.x - to.x) * (point.y - to.y);
}

/** Strictly inside, so triangles that merely share an edge do not count as overlapping. */
function strictlyInside(triangle, point) {
  const sides = [
    sideOf(point, triangle[0], triangle[1]),
    sideOf(point, triangle[1], triangle[2]),
    sideOf(point, triangle[2], triangle[0])
  ];
  return sides.every((side) => side > 1e-12) || sides.every((side) => side < -1e-12);
}

/**
 * The artwork is six triangles walking two triangular paths, and what it is for is the
 * moment they arrive: they close into one regular hexagon, exactly, which is the
 * sentence from the Timaeus the artwork carries — one figure come to be out of six in
 * number. That closing is not drawn anywhere. It is what the walk does, and these tests
 * measure it rather than take it on the picture's word.
 */

test("halfway along the walk the six close into one exact regular hexagon", () => {
  const triangles = placedTriangles(GATHERED_STEP);
  const vertices = triangles.flat();
  assert.equal(vertices.length, TRIANGLE_COUNT * 3);

  // Every vertex is either the centre or a corner of one hexagon: six meet in the
  // middle, one from each triangle, and the other twelve stand on a circle of exactly
  // sin sixty — the classical dissection of a hexagon into six equilateral triangles.
  const atCentre = vertices.filter((vertex) => Math.hypot(vertex.x, vertex.y) < 1e-12);
  assert.equal(atCentre.length, TRIANGLE_COUNT);
  const outer = vertices.filter((vertex) => Math.hypot(vertex.x, vertex.y) >= 1e-12);
  for (const vertex of outer) {
    assert.ok(Math.abs(Math.hypot(vertex.x, vertex.y) - PATH_RADIUS_RATIO) < 1e-12);
  }

  // And they stand on exactly six bearings, sixty degrees apart, each corner shared by
  // two of the triangles.
  const bearings = new Map();
  for (const vertex of outer) {
    const degrees = Math.round(((Math.atan2(vertex.y, vertex.x) * 180) / Math.PI + 360) % 360);
    bearings.set(degrees, (bearings.get(degrees) ?? 0) + 1);
  }
  assert.equal(bearings.size, 6);
  for (const [degrees, count] of bearings) {
    assert.equal(count, 2, `the corner at ${degrees} degrees is not shared by two`);
    assert.equal(degrees % 60, 30);
  }
});

test("they meet but never trespass: no two triangles ever overlap", () => {
  // The closing is a tiling, not a pile. If the six overlapped anywhere in the walk the
  // hexagon above would be a coincidence of outlines rather than a dissection.
  for (let step = 0; step < STEPS_PER_CYCLE; step += 1) {
    const triangles = placedTriangles(step);
    for (let first = 0; first < triangles.length; first += 1) {
      for (let second = 0; second < triangles.length; second += 1) {
        if (first === second) {
          continue;
        }
        // Sample the interior of one triangle: its centroid and points pulled towards
        // each of its corners, which is enough to catch any real overlap.
        const [a, b, c] = triangles[first];
        const centroid = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
        const samples = [centroid, ...triangles[first].map((corner) => ({
          x: centroid.x + (corner.x - centroid.x) * 0.9,
          y: centroid.y + (corner.y - centroid.y) * 0.9
        }))];
        for (const sample of samples) {
          assert.ok(
            !strictlyInside(triangles[second], sample),
            `triangles ${first} and ${second} overlap at step ${step}`
          );
        }
      }
    }
  }
});

test("the gathering is a distance, measured, not a number given to each triangle", () => {
  // Colour keys to this, so it has to be the geometry: a walk carries a triangle from a
  // corner at the full path radius to the midpoint of an edge at exactly half of it,
  // the inradius of an equilateral triangle being half its circumradius.
  assert.ok(Math.abs(radiusAt(0) - 1) < 1e-12);
  assert.ok(Math.abs(radiusAt(GATHERED_STEP) - 0.5) < 1e-12);
  assert.ok(Math.abs(gatheringAt(0)) < 1e-12);
  assert.ok(Math.abs(gatheringAt(GATHERED_STEP) - 1) < 1e-12);

  // It closes in on the meeting and opens out again, without a kink or a plateau.
  for (let step = 1; step <= GATHERED_STEP; step += 1) {
    assert.ok(radiusAt(step) < radiusAt(step - 1), `the six stopped closing at ${step}`);
    assert.ok(gatheringAt(step) > gatheringAt(step - 1));
  }
  for (let step = GATHERED_STEP + 1; step < STEPS_PER_CYCLE; step += 1) {
    assert.ok(radiusAt(step) > radiusAt(step - 1), `the six stopped opening at ${step}`);
  }
  // Every step of the walk is somewhere on the journey, so the colour never runs off it.
  for (let step = 0; step < STEPS_PER_CYCLE; step += 1) {
    assert.ok(gatheringAt(step) >= -1e-12 && gatheringAt(step) <= 1 + 1e-12);
  }
});

test("the walk closes because the six are interchangeable, not because they return", () => {
  // Each triangle walks one edge, so at the end of a cycle it is standing on the corner
  // its neighbour started from — and the next cycle starts it back at its own. That is a
  // jump for the triangle and no jump at all for the picture, because the six places are
  // the same six places and the triangles of a family are identical.
  const places = (step) => trianglesAt(step, PATH_RADIUS).map(pointKey).sort();
  const nearlyRoundTrip = STEPS_PER_CYCLE - 1e-9;
  assert.deepEqual(places(nearlyRoundTrip), places(0));

  // Individually, though, every triangle has crossed to its neighbour's corner.
  const began = trianglesAt(0, PATH_RADIUS);
  const ended = trianglesAt(nearlyRoundTrip, PATH_RADIUS);
  ended.forEach((triangle, index) => {
    const travelled = Math.hypot(triangle.x - began[index].x, triangle.y - began[index].y);
    assert.ok(travelled > PATH_RADIUS, `triangle ${index} travelled only ${travelled}`);
  });
  // And the drawn figure is the same figure at both ends of the cycle.
  const outline = (step) => placedTriangles(step).flat().map(pointKey).sort();
  assert.deepEqual(outline(nearlyRoundTrip), outline(0));
});

test("the two paths point opposite ways, which is what makes the hexagram", () => {
  const placed = trianglesAt(0, PATH_RADIUS);
  const rising = placed.slice(0, TRIANGLES_PER_PATH);
  const falling = placed.slice(TRIANGLES_PER_PATH);
  assert.equal(rising.length, TRIANGLES_PER_PATH);
  assert.equal(falling.length, TRIANGLES_PER_PATH);
  for (const triangle of rising) {
    assert.ok(Math.abs(triangle.rotation) < 1e-12);
  }
  for (const triangle of falling) {
    assert.ok(Math.abs(triangle.rotation - Math.PI / 3) < 1e-12);
  }
  // A sixth of a turn on a three-fold figure is a full reversal, so the second family
  // points exactly against the first.
  const first = triangleShape(TRIANGLE_RADIUS, 0)[0];
  const second = triangleShape(TRIANGLE_RADIUS, Math.PI / 3)[0];
  assert.ok(Math.abs(Math.atan2(second.y, second.x) - Math.PI / 3) < 1e-12);
  assert.ok(Math.abs(Math.hypot(first.x, first.y) - Math.hypot(second.x, second.y)) < 1e-12);
});

test("each triangle is equilateral, and half the path it walks", () => {
  assert.equal(TRIANGLE_COUNT, PATH_COUNT * TRIANGLES_PER_PATH);
  assert.ok(Math.abs(TRIANGLE_RADIUS_RATIO - 0.5) < 1e-12);
  const shape = triangleShape(TRIANGLE_RADIUS, 0);
  const sides = shape.map((vertex, index) => {
    const next = shape[(index + 1) % shape.length];
    return Math.hypot(next.x - vertex.x, next.y - vertex.y);
  });
  for (const side of sides) {
    assert.ok(Math.abs(side - Math.sqrt(3) * TRIANGLE_RADIUS) < 1e-12);
  }
  // The path's corners are an equilateral triangle too, of the radius asked for.
  const corners = pathCorners(0, PATH_RADIUS);
  assert.equal(corners.length, TRIANGLES_PER_PATH);
  for (const point of corners) {
    assert.ok(Math.abs(Math.hypot(point.x, point.y) - PATH_RADIUS) < 1e-12);
  }
});

test("the clip is five gatherings, three hundred frames, ten seconds", () => {
  assert.equal(TOTAL_STEPS, CYCLES * STEPS_PER_CYCLE);
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 10);
  // The clip is a whole number of walks, so it ends on the figure it opened with.
  assert.equal(TOTAL_STEPS % STEPS_PER_CYCLE, 0);
  assert.ok(Math.abs(gatheringAt(TOTAL_STEPS) - gatheringAt(0)) < 1e-12);
});
