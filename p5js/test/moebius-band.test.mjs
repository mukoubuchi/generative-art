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
  sceneState,
  viewDirection
} from "../artworks/moebius-band/geometry.js";

/**
 * The band's famous properties are all consequences of one identity — going once around
 * glues the strip to itself with a flip — so that identity is tested first and each
 * consequence after it: one side, and one edge. The properties hold for any radius and
 * half-width with 0 < w < R, so they are checked at two arbitrary sizes rather than at
 * the sketch's own, which keeps the mathematics and the staging separately replaceable.
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
  // is folded in absolute value, and this is the check that says so. It is now the only
  // shading model in the artwork, so it answers for the whole picture.
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

  // The mesh's normals lie where the surface puts them, which is a sample with an axis
  // in it. These have none: spread over the sphere by the golden angle, they ask the
  // same question of directions the band never takes.
  for (let i = 0; i < 64; i += 1) {
    const z = 1 - (2 * i + 1) / 64;
    const ring = Math.sqrt(1 - z * z);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const normal = [ring * Math.cos(angle), ring * Math.sin(angle), z];
    assert.deepEqual(
      glassShade(normal, view, GLASS),
      glassShade(normal.map((component) => -component), view, GLASS),
      `the glass answered differently for [${normal}] and its opposite`
    );
  }

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
  // Over the real mesh, through the whole turn, the band is mostly see-through, which is
  // what keeps the far half of the surface showing through the near half instead of being
  // hidden by it. Measured over 120 stations of the stage: at its most solid 54.5 per
  // cent of the surface is less than half opaque, at its clearest 93.5. The claim is the
  // floor.
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

/**
 * Every call the sketch makes that puts paint on the canvas or decides how paint is made,
 * in the order it makes them. A fill through a shading model and a fill of a flat colour
 * are different acts, so the two are told apart by what is handed to them.
 */
function paintingCalls(source) {
  return [...source.matchAll(
    /\bp\.(fill|stroke|strokeWeight|noFill|noStroke|line|beginShape|endShape)\s*\(\s*(\.\.\.)?(\w+)?/gu)]
    .map(([, call, spread, argument]) =>
      call === "fill" || call === "stroke"
        ? `${call}(${spread ? "..." : ""}${argument ?? ""})`
        : call);
}

/** Everything the sketch says to the renderer behind p5's back. */
function rendererCalls(source) {
  return [...source.matchAll(/\bgl\.(\w+)\s*\(([^)]*)\)/gu)]
    .map(([, call, argument]) => `${call}(${argument})`);
}

/** The colours the sketch states, in the order it states them. */
function colourNames(source) {
  return [...source.matchAll(/^const (\w+) = \[[\d, ]+\];$/gmu)].map(([, name]) => name);
}

test("the picture is glass, and the only line in it is the band's own edge", async () => {
  // What the artwork is, read out of the file it ships as: one surface of glass, painted
  // once through the one shading model that can answer for a one-sided surface, and one
  // stroke, which is the rim. Nothing is filled flat, since a flat fill is a shape rather
  // than a body of glass, and no second colour is stated anywhere.
  const sketch = await readFile(
    new URL("../artworks/moebius-band/sketch.js", import.meta.url), "utf8");
  assert.deepEqual(paintingCalls(sketch), [
    "noStroke", "beginShape", "fill(...glassShade)", "endShape",
    "noFill", "stroke(...GLASS)", "strokeWeight", "beginShape", "endShape"
  ]);
  assert.deepEqual(colourNames(sketch), ["BACKGROUND", "GLASS"]);
  // The depth buffer is held off across the whole scene and handed back afterwards. With
  // it written, a fragment the sort put late is thrown away instead of mixed in, and the
  // band stops being see-through exactly where it runs through itself.
  assert.deepEqual(rendererCalls(sketch), ["depthMask(false)", "depthMask(true)"]);
  const scene = sketch.slice(sketch.indexOf("function drawScene"));
  let at = -1;
  for (const step of ["gl.depthMask(false)", "drawBand(", "drawEdge()", "gl.depthMask(true)"]) {
    const next = scene.indexOf(step);
    assert.ok(next > at, `${step} is out of order in drawScene`);
    at = next;
  }
});

test("the scan finds the traveller in the sketch that shipped with it", async () => {
  // The negative control, and it is the real thing rather than one invented for the
  // occasion: the sketch as it stood through v1.7.0, when a gold body stood on the band
  // and was the only opaque thing on the stage. What the scan rejects it for is that
  // body -- a second colour, and a fill through a second shading model.
  const specimen = await readFile(
    new URL("./fixtures/moebius-band-traveller/sketch.js", import.meta.url), "utf8");
  assert.deepEqual(paintingCalls(specimen), [
    "noStroke", "beginShape", "fill(...glassShade)", "endShape",
    "noFill", "stroke(...GLASS)", "strokeWeight", "beginShape", "endShape",
    "noStroke", "beginShape", "fill(...solidShade)", "endShape"
  ]);
  assert.deepEqual(colourNames(specimen), ["BACKGROUND", "GLASS", "GOLD"]);
  // And the specimen is otherwise this artwork, staged and shaded the same way, so what
  // the scan rejects it for is the body and nothing else about it.
  assert.deepEqual(rendererCalls(specimen), ["depthMask(false)", "depthMask(true)"]);
  assert.ok(specimen.includes("bandRows(SEGMENTS_AROUND"), "the specimen is not this artwork");
  assert.ok(specimen.includes("rotateX(STAGE_TILT)"), "the specimen is not on this stage");
});

test("the clip's last frame hands back to its first", () => {
  const frames = 300;
  assert.equal(sceneState(0, frames).spin, 0);
  assert.ok(Number.isInteger(STAGE_TURNS), "partial stage turns would put a seam in the loop");
  assert.ok(
    Math.abs(sceneState(frames, frames).spin - STAGE_TURNS * 2 * Math.PI) < 1e-12,
    "the stage must end exactly where it began"
  );
  // The frame is the only argument: ask twice for the same one and the same scene comes
  // back, whatever was asked for in between.
  assert.deepEqual(sceneState(97, frames), sceneState(97, frames));
});
