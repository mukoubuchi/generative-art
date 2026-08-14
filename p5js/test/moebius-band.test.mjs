import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STAGE_TURNS,
  backToFront,
  bandNormal,
  bandPoint,
  bandRows,
  cellCentres,
  edgePoint,
  glassShade,
  markerState,
  sceneState,
  viewDirection
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

const STAGE_TILT = 0.9;
const GLASS = [168, 206, 198];

/** The stage's rotation, written out again here rather than borrowed from the module. */
function staged(point, tilt, spin) {
  const turned = [
    point[0] * Math.cos(spin) - point[1] * Math.sin(spin),
    point[0] * Math.sin(spin) + point[1] * Math.cos(spin),
    point[2]
  ];
  return [
    turned[0],
    turned[1] * Math.cos(tilt) - turned[2] * Math.sin(tilt),
    turned[1] * Math.sin(tilt) + turned[2] * Math.cos(tilt)
  ];
}

test("the eye's direction is the stage's own, and it is a direction", () => {
  for (const spin of [0, 0.7, Math.PI, 4.9, 2 * Math.PI]) {
    const view = viewDirection(STAGE_TILT, spin);
    assert.ok(Math.abs(Math.hypot(...view) - 1) < 1e-12, "the view must be a unit direction");
    // How far along the eye a point stands is what the stage's rotation makes of its
    // depth, and the test builds that rotation itself rather than asking for it back.
    for (const point of [[185, 0, 0], [-40, 90, 22], [0, 0, 62], [12, -200, -7]]) {
      const alongTheEye = point[0] * view[0] + point[1] * view[1] + point[2] * view[2];
      assert.ok(Math.abs(alongTheEye - staged(point, STAGE_TILT, spin)[2]) < 1e-9,
        `the view direction disagrees with the stage at spin ${spin}`);
    }
  }
});

test("nothing in the glass reads which way the normal points", () => {
  // The band's one-sidedness is not a claim the shading is allowed to contradict: carry a
  // normal round the ring and it comes back negated, so a model that reads its sign would
  // paint the same piece of surface two ways and tear the band along a seam. Every term
  // is folded in absolute value, and this is the check that says so.
  const rows = bandRows(60, 6, 190, 60);
  const view = viewDirection(STAGE_TILT, 1.3);
  let tested = 0;
  for (const row of rows) {
    for (const { normal } of row) {
      const flipped = normal.map((component) => -component);
      assert.deepEqual(glassShade(normal, view, GLASS), glassShade(flipped, view, GLASS));
      tested += 1;
    }
  }
  assert.equal(tested, 61 * 7);

  // Negative control: the same model with the folds taken out -- which is the ordinary
  // way to shade a surface, and exactly the defect the band cannot survive.
  const signed = (normal) => {
    const key = normal[0] * -0.37 + normal[1] * 0.45 + normal[2] * -0.81;
    return GLASS.map((component) => component * (0.24 + 0.57 * key));
  };
  const seam = rows[17][2].normal;
  assert.notDeepEqual(signed(seam), signed(seam.map((component) => -component)));
});

test("the glass is glass: what shows is what is turned away from the eye", () => {
  const view = [0, 0, 1];
  const facing = glassShade([0, 0, 1], view, GLASS);
  const grazing = glassShade([1, 0, 0], view, GLASS);
  // Face on it is nearly invisible; edge on it turns bright and nearly solid. Between
  // them the transparency only ever moves one way.
  assert.ok(facing.at(-1) < 60, `face on it is ${facing.at(-1)} opaque`);
  assert.ok(grazing.at(-1) > 200, `edge on it is only ${grazing.at(-1)} opaque`);
  assert.ok(grazing[1] > facing[1], "the grazing edge must be the brighter one");
  let last = -Infinity;
  for (let step = 0; step <= 20; step += 1) {
    const angle = (step / 20) * (Math.PI / 2);
    const alpha = glassShade([Math.sin(angle), 0, Math.cos(angle)], view, GLASS).at(-1);
    assert.ok(alpha >= last, "the transparency must not wobble as the surface turns");
    last = alpha;
  }
  // Over the real mesh, through the whole turn, the band is mostly see-through -- which
  // is what retired the marker's ghost, since the glass shows the far half by itself.
  // Measured over 120 stations of the stage: at its most solid 54.5 per cent of the
  // surface is less than half opaque, at its clearest 93.5. The claim is the floor.
  const surface = bandRows(180, 8, 185, 62).flat();
  let solidest = 1;
  for (let station = 0; station < 120; station += 1) {
    const view = viewDirection(STAGE_TILT, (station / 120) * 2 * Math.PI);
    const clear = surface.filter(({ normal }) =>
      glassShade(normal, view, GLASS).at(-1) < 128).length;
    solidest = Math.min(solidest, clear / surface.length);
  }
  assert.ok(solidest > 0.5, `at its most solid only ${(solidest * 100).toFixed(1)}% is clear`);
});

test("the band is painted from the back, cell by cell", () => {
  // Transparency has no depth buffer to fall back on -- what is drawn later is mixed
  // over what is there -- so the paint order has to be the depth order.
  const rows = bandRows(180, 8, 185, 62);
  const centres = cellCentres(rows);
  assert.equal(centres.length, 180 * 8);
  for (const spin of [0, 1.9, 4.4]) {
    const view = viewDirection(STAGE_TILT, spin);
    const order = backToFront(centres, view);
    assert.equal(new Set(order).size, centres.length, "every cell must be painted once");
    const depths = order.map((index) => {
      const [x, y, z] = centres[index].point;
      return x * view[0] + y * view[1] + z * view[2];
    });
    for (let step = 1; step < depths.length; step += 1) {
      assert.ok(depths[step] >= depths[step - 1], `cell ${step} is painted out of order`);
    }
    // Negative control: the order the mesh happens to be built in is not that order.
    const asBuilt = centres.map((centre) => {
      const [x, y, z] = centre.point;
      return x * view[0] + y * view[1] + z * view[2];
    });
    assert.ok(asBuilt.some((depth, index) => index > 0 && depth < asBuilt[index - 1]),
      "the mesh order would already be sorted, so the test proves nothing");
  }
});

test("the opaque traveller is laid down first and the see-through things over it", async () => {
  // The pipeline the picture depends on. The traveller is the only solid thing on the
  // stage, so it is drawn first and writes its depth; the glass then goes over it with
  // the depth test on and the writing off, which is what lets the band cover the far
  // half of the journey instead of the marker always winning.
  const sketch = await readFile(
    new URL("../artworks/moebius-band/sketch.js", import.meta.url), "utf8");
  const scene = sketch.slice(sketch.indexOf("function drawScene"));
  const order = ["drawMarker(", "gl.depthMask(false)", "drawBand(", "drawEdge()", "gl.depthMask(true)"];
  let at = -1;
  for (const step of order) {
    const next = scene.indexOf(step);
    assert.ok(next > at, `${step} is out of order in drawScene`);
    at = next;
  }
  // The depth test is never turned off. Turning it off is how the marker used to be
  // drawn twice, and the second copy is what the glass replaced.
  assert.equal((sketch.match(/DEPTH_TEST/gu) ?? []).length, 0);
  assert.equal((sketch.match(/depthMask/gu) ?? []).length, 2);
  // Three colours, and the traveller is one colour rather than a pair.
  assert.equal((sketch.match(/^const (BACKGROUND|GLASS|PIN) = \[/gmu) ?? []).length, 3);
  assert.equal((sketch.match(/\.\.\.PIN/gu) ?? []).length, 2);
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
