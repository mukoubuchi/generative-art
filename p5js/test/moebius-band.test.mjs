import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STAGE_TURNS,
  backToFront,
  bandAcross,
  bandNormal,
  bandPoint,
  bandRows,
  cellCentres,
  edgePoint,
  glassShade,
  markerState,
  sceneState,
  solidShade,
  travellerMesh,
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
  // Three colours, and the traveller's is handed to its shading once. It used to be
  // spread twice — a stroke for the pin and a fill for the two beads — which is the
  // shape of a marker assembled out of parts rather than one body.
  assert.equal((sketch.match(/^const (BACKGROUND|GLASS|GOLD) = \[/gmu) ?? []).length, 3);
  assert.equal((sketch.match(/\bGOLD\b/gu) ?? []).length, 2);
  // Nothing about the traveller is drawn in screen pixels. A stroke in WEBGL ignores the
  // model transform, so a marker made of lines is a marker whose parts do not shrink
  // with the distance they have travelled.
  const marker = sketch.slice(sketch.indexOf("function drawMarker"),
    sketch.indexOf("function drawScene"));
  assert.equal((marker.match(/p\.(stroke|strokeWeight|line)\(/gu) ?? []).length, 0);
  assert.match(marker, /p\.noStroke\(\)/u);
  // The traveller is shaded rather than painted: its gold reaches the canvas only through
  // the model that reads the sign of the normal. Filled flat it is a gold disc again,
  // which is what it was, and no amount of shape makes a flat disc look like a body.
  assert.equal((marker.match(/p\.fill\(/gu) ?? []).length, 1);
  assert.match(marker, /p\.fill\(\.\.\.solidShade\(/u);
});

/**
 * The traveller's own numbers, which live in the sketch. Unlike the band's properties
 * these are not scale-free — whether a body clears the surface depends on how it sizes
 * against the ring — so they are checked at the size the artwork actually uses.
 */
const TRAVELLER = { radius: 8.5, height: 38, taper: 0.72, rings: 16, sectors: 24 };
const RING = 185;

function bodyAt(marker, shape = TRAVELLER) {
  return travellerMesh(marker.position, marker.normal, bandAcross(marker.u), shape);
}

/** How far a point stands off the surface, along the normal the traveller is standing on. */
function standoff(point, marker) {
  return [0, 1, 2].reduce(
    (total, axis) => total + (point[axis] - marker.position[axis]) * marker.normal[axis], 0);
}

function centroidOf(mesh) {
  return [0, 1, 2].map((axis) =>
    mesh.reduce((total, vertex) => total + vertex.point[axis], 0) / mesh.length);
}

test("the traveller these tests measure is the one the sketch draws", async () => {
  // The properties below are not scale-free, so they are only worth anything against the
  // sizes that ship. This is the one line that ties the two together.
  const sketch = await readFile(
    new URL("../artworks/moebius-band/sketch.js", import.meta.url), "utf8");
  const literal = sketch.match(/^const TRAVELLER = \{([^}]*)\};$/mu);
  assert.ok(literal, "the sketch no longer states the traveller's size in one place");
  assert.deepEqual(
    Object.fromEntries(literal[1].split(",").map((entry) => {
      const [name, value] = entry.split(":").map((part) => part.trim());
      return [name, Number(value)];
    })),
    TRAVELLER
  );
});

test("the traveller stands on the band and never breaks through it", () => {
  // The constraint the shape was chosen for: touch only, whole body on one side. The
  // foot is rounded, so it meets the surface tangentially at a point and lifts away
  // faster than the ring curves out from under it.
  //
  // The negative control is not invented. The cone that was the second candidate stood
  // on a flat disc, and a flat disc of radius r laid on a ring of radius R sinks into it
  // by about r^2 / 2R; it was built and measured at 0.15 units through the surface,
  // which is the specimen kept here.
  const flatFooted = (marker) => bodyAt(marker, { ...TRAVELLER, taper: 0 }).map((vertex) => {
    const lift = standoff(vertex.point, marker);
    return lift < TRAVELLER.height / 2
      ? { point: vertex.point.map((c, axis) => c - marker.normal[axis] * lift) }
      : vertex;
  });

  // A patch of the surface under the traveller: a fourteenth of a radian either way,
  // which reaches about fifteen units along the ring where the widest part of the body
  // is six, and the full width of the strip because the ruling runs across it.
  const REACH = 0.08;
  const LOW = 6;
  const patch = (marker) => {
    const samples = [];
    for (let i = -20; i <= 20; i += 1) {
      const u = marker.u + (i / 20) * REACH;
      for (let j = -12; j <= 12; j += 1) {
        const v = (j / 12) * 62;
        samples.push({ point: bandPoint(u, v, RING), normal: bandNormal(u, v, RING) });
      }
    }
    return samples;
  };

  const deepest = (mesh, marker, samples) => {
    let worst = 0;
    for (const { point } of mesh) {
      // Only the vertices low enough to reach the surface can cross it. Over this patch
      // the surface stays inside LOW of the tangent plane, asserted below, so a vertex
      // higher than that is clear of it by more than any crossing being looked for.
      if (standoff(point, marker) > LOW) {
        continue;
      }
      let nearest = null;
      let reach = Infinity;
      for (const sample of samples) {
        const distance = Math.hypot(point[0] - sample.point[0],
          point[1] - sample.point[1], point[2] - sample.point[2]);
        if (distance < reach) {
          reach = distance;
          nearest = sample;
        }
      }
      // Which side of the surface the vertex is on, read off the nearest patch of it and
      // oriented to agree with the normal the traveller is standing on. The tangent plane
      // will not do: the surface twists away from it, which is exactly the margin a flat
      // foot loses.
      const along = [0, 1, 2].reduce(
        (total, axis) => total + (point[axis] - nearest.point[axis]) * nearest.normal[axis], 0);
      const agrees = [0, 1, 2].reduce(
        (total, axis) => total + nearest.normal[axis] * marker.normal[axis], 0);
      worst = Math.min(worst, agrees >= 0 ? along : -along);
    }
    return -worst;
  };

  const sunk = [];
  for (const frame of [0, 41, 88, 137, 190, 244]) {
    const marker = sceneState(frame, 300, RING).marker;
    const samples = patch(marker);
    const lifts = samples.map(({ point }) => standoff(point, marker));
    assert.ok(Math.max(...lifts) < LOW,
      `the surface itself rises ${Math.max(...lifts)} into the room the shortcut assumes`);

    const mesh = bodyAt(marker);
    assert.ok(deepest(mesh, marker, samples) < 1e-6,
      `the body breaks the surface at frame ${frame}`);
    // It touches: a body floating clear would satisfy the line above and say nothing.
    assert.ok(Math.min(...mesh.map(({ point }) => standoff(point, marker))) < 1e-9,
      `the body does not reach the surface at frame ${frame}`);
    // The specimen, measured the same way, fails the same test at every station. How far
    // it sinks depends on how hard the strip is twisting there, which is why the worst
    // case is asserted separately from the floor.
    sunk.push(deepest(flatFooted(marker), marker, samples));
  }
  assert.ok(Math.min(...sunk) > 0.03,
    `the flat-footed specimen came up clean somewhere: ${sunk.map((d) => d.toFixed(4))}`);
  assert.ok(Math.max(...sunk) > 0.15,
    `the specimen never sinks by a readable amount, so the check proves little`);
});

test("the flip carries the traveller, where it left the old bead exactly where it was", () => {
  // Half the journey puts the marker back where it started on the other face, so the
  // body is reflected through the surface — and a reflection moves a thing by twice its
  // standoff. That is the whole reason the traveller stands up off the band. The bead
  // this replaced was centred on the line the marker walks, standing off by nothing, so
  // the same reflection carried it nowhere and only the thin pin ever moved.
  for (const frame of [0, 37, 88, 121, 149]) {
    const here = sceneState(frame, 300, RING).marker;
    const over = sceneState(frame + 150, 300, RING).marker;
    assertClose(over.position, here.position, 1e-9 * RING, "half a journey returns the place");
    assertClose(over.normal, here.normal.map((c) => -c), 1e-9, "and turns the face over");

    const stands = standoff(centroidOf(bodyAt(here)), here);
    const moved = Math.hypot(...[0, 1, 2].map((axis) =>
      centroidOf(bodyAt(here))[axis] - centroidOf(bodyAt(over))[axis]));
    assert.ok(Math.abs(moved - 2 * stands) < 1e-9 * RING,
      `the flip must move the body twice its standoff: ${moved} against ${2 * stands}`);
    assert.ok(stands > TRAVELLER.height / 4,
      `the body must stand off the surface to be carried: ${stands}`);
    // The specimen: a sphere centred on the marker's position, which is what shipped
    // until now. Its centroid is that position, and the flip returns that position.
    const bead = Math.hypot(...[0, 1, 2].map((axis) =>
      here.position[axis] - over.position[axis]));
    assert.ok(bead < 1e-9 * RING,
      "the old bead's centre would have to move for this measurement to mean anything");
  }
});

test("the band cannot tell its two sides apart and the traveller can", () => {
  // The asymmetry is the claim, not an oversight. A one-sided surface has no fact about
  // which way it faces, so the band's shading folds every term and answers the same for
  // a normal and its opposite. The traveller is an ordinary solid with an inside, so its
  // normals mean something and its shading reads their sign.
  const view = viewDirection(0.9, 0.7);
  const glass = [168, 206, 198];
  const gold = [214, 152, 58];
  // Normals spread over the sphere by the golden angle, so the sample has no axis.
  const normals = [];
  for (let i = 0; i < 64; i += 1) {
    const z = 1 - (2 * i + 1) / 64;
    const ring = Math.sqrt(1 - z * z);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    normals.push([ring * Math.cos(angle), ring * Math.sin(angle), z]);
  }

  let toldApart = 0;
  for (const normal of normals) {
    const opposite = normal.map((component) => -component);
    assert.deepEqual(glassShade(normal, view, glass), glassShade(opposite, view, glass),
      "the band answered differently for a normal and its opposite");
    const front = solidShade(normal, view, gold);
    const back = solidShade(opposite, view, gold);
    if (Math.abs(front[0] - back[0]) > 1e-9) {
      toldApart += 1;
    }
    // One gold, at many strengths. Every colour it returns is this gold multiplied, so
    // the highlight cannot drift to another hue the way a clipped channel does.
    for (const [channel, component] of front.entries()) {
      assert.ok(Math.abs(component / gold[channel] - front[0] / gold[0]) < 1e-12,
        `the traveller returned [${front}], which is not this gold multiplied`);
      assert.ok(component <= 255 + 1e-9, `the traveller returned ${component}`);
    }
  }
  assert.equal(toldApart, normals.length, "the traveller failed to tell some sides apart");

  // And it is brighter on the side the key light is on, which is what "reads the sign"
  // buys: pick the normal most nearly facing the light and the one most nearly away.
  const towards = [-0.37, 0.45, -0.81];
  const scored = normals.map((normal) => ({
    normal,
    facing: normal.reduce((total, component, axis) => total + component * towards[axis], 0)
  })).sort((first, second) => first.facing - second.facing);
  const dark = solidShade(scored[0].normal, view, gold);
  const lit = solidShade(scored.at(-1).normal, view, gold);
  assert.ok(lit[0] > dark[0], "the lit side must be the brighter one");
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
