import assert from "node:assert/strict";
import test from "node:test";
import {
  STAGE_TURNS,
  bandNormal,
  bandPoint,
  bandRows,
  edgePoint,
  markerState,
  sceneState
} from "../artworks/moebius-band/geometry.js";

/**
 * The band's famous properties are all consequences of one identity — going once around
 * glues the strip to itself with a flip — so that identity is tested first and each
 * consequence after it: one side, one edge, and a traveller who needs two laps to come
 * home. The properties hold for any radius and half-width with 0 < w < R, so they are
 * checked at two arbitrary sizes rather than at the sketch's own, which keeps the
 * mathematics and the staging separately replaceable.
 */
const SIZES = [
  { radius: 190, width: 60 },
  { radius: 3, width: 1 }
];

function assertClose(actual, expected, epsilon, message) {
  for (const [index, value] of actual.entries()) {
    assert.ok(
      Math.abs(value - expected[index]) < epsilon,
      `${message}: [${actual}] is not [${expected}]`
    );
  }
}

test("one lap glues the strip to itself with a flip", () => {
  for (const { radius, width } of SIZES) {
    for (let i = 0; i < 12; i += 1) {
      const u = (i / 12) * 2 * Math.PI;
      for (const v of [-width, -width / 3, 0, width / 2, width]) {
        assertClose(
          bandPoint(u + 2 * Math.PI, v, radius),
          bandPoint(u, -v, radius),
          1e-9 * radius,
          `P(u + 2 PI, v) must equal P(u, -v) at u=${u}, v=${v}`
        );
      }
    }
  }
});

test("the centre line is a plain circle", () => {
  for (const { radius } of SIZES) {
    for (let i = 0; i < 24; i += 1) {
      const [x, y, z] = bandPoint((i / 24) * 4 * Math.PI, 0, radius);
      assert.ok(Math.abs(Math.hypot(x, y) - radius) < 1e-9 * radius);
      assert.ok(Math.abs(z) < 1e-9 * radius);
    }
  }
});

test("the band has one side: a lap negates the normal", () => {
  for (const { radius } of SIZES) {
    for (let i = 0; i < 12; i += 1) {
      const u = (i / 12) * 2 * Math.PI;
      const before = bandNormal(u, 0, radius);
      const after = bandNormal(u + 2 * Math.PI, 0, radius);
      assert.ok(Math.abs(Math.hypot(...before) - 1) < 1e-9, "normals must be unit length");
      assertClose(after, before.map((component) => -component), 1e-9,
        `N(u + 2 PI) must be -N(u) at u=${u}`);
    }
  }
});

test("the band has one edge, which closes only after 4 PI", () => {
  for (const { radius, width } of SIZES) {
    const start = edgePoint(0, radius, width);
    const afterOneLap = edgePoint(2 * Math.PI, radius, width);
    const afterTwoLaps = edgePoint(4 * Math.PI, radius, width);
    // One lap along the rim lands on the opposite side of the strip, a full 2w away —
    // the "other" edge is the same curve half-travelled.
    const gap = Math.hypot(...start.map((component, index) => component - afterOneLap[index]));
    assert.ok(Math.abs(gap - 2 * width) < 1e-9 * radius);
    assertClose(afterTwoLaps, start, 1e-6 * radius, "the edge must close after two laps");
  }
});

test("the mesh rows end on the seam row, which is the first row flipped", () => {
  const around = 48;
  const across = 6;
  const { radius, width } = SIZES[0];
  const rows = bandRows(around, across, radius, width);
  assert.equal(rows.length, around + 1);
  for (const row of rows) {
    assert.equal(row.length, across + 1);
    for (const { point } of row) {
      // Every sample stays inside the swept torus shell the parameters promise.
      const [x, y, z] = point;
      assert.ok(Math.abs(Math.hypot(x, y) - radius) <= width + 1e-9);
      assert.ok(Math.abs(z) <= width + 1e-9);
    }
  }
  const first = rows[0];
  const seam = rows[around];
  for (let j = 0; j <= across; j += 1) {
    assertClose(seam[j].point, first[across - j].point, 1e-9 * radius,
      "the seam must reattach to the start with v reversed");
  }
});

test("the marker returns after one lap the wrong way up, after two the right way", () => {
  const { radius } = SIZES[0];
  const start = markerState(0, radius);
  const halfway = markerState(0.5, radius);
  const home = markerState(1, radius);

  // Same place on the centre line, opposite normal: standing where it started with its
  // pin through the band the other way is the artwork's whole argument.
  assertClose(halfway.position, start.position, 1e-9 * radius, "half way must revisit the start");
  assertClose(halfway.normal, start.normal.map((component) => -component), 1e-9,
    "half way must arrive the other way up");
  assert.equal(start.side, 1);
  assert.equal(halfway.side, -1);

  assertClose(home.position, start.position, 1e-9 * radius, "two laps must come home");
  assertClose(home.normal, start.normal, 1e-6, "home must be the same way up");
  assert.equal(home.side, 1);
});

test("the clip's last frame hands back to its first", () => {
  const { radius } = SIZES[0];
  const frames = 300;
  const first = sceneState(0, frames, radius);
  const closing = sceneState(frames, frames, radius);
  assert.equal(first.spin, 0);
  assert.ok(Number.isInteger(STAGE_TURNS), "partial stage turns would put a seam in the loop");
  assert.ok(
    Math.abs(closing.spin - STAGE_TURNS * 2 * Math.PI) < 1e-12,
    "the stage must end exactly where it began"
  );
  assertClose(closing.marker.position, first.marker.position, 1e-9 * radius);
  assertClose(closing.marker.normal, first.marker.normal, 1e-6);
});
