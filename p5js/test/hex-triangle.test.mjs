import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CYCLES,
  PATH_COUNT,
  STEPS_PER_CYCLE,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  TRIANGLES_PER_PATH,
  TRIANGLE_COUNT,
  TRIANGLE_RADIUS_RATIO,
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
  // sin sixty of the path radius — the classical dissection of a hexagon into six
  // equilateral triangles. The expected distance is written from this figure's own
  // geometry rather than borrowed from PATH_RADIUS_RATIO, which happens to be the same
  // number for an unrelated reason: that one is the path radius as a share of the
  // hexagon the artwork is built on.
  const atCentre = vertices.filter((vertex) => Math.hypot(vertex.x, vertex.y) < 1e-12);
  assert.equal(atCentre.length, TRIANGLE_COUNT);
  const cornerRadius = Math.sin(Math.PI / 3) * PATH_RADIUS;
  const outer = vertices.filter((vertex) => Math.hypot(vertex.x, vertex.y) >= 1e-12);
  for (const vertex of outer) {
    assert.ok(Math.abs(Math.hypot(vertex.x, vertex.y) - cornerRadius) < 1e-12);
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

test("the six close in and open out, and how far they have come is measured", () => {
  // A walk carries a triangle from a corner at the full path radius to the midpoint of an
  // edge at exactly half of it, the inradius of an equilateral triangle being half its
  // circumradius. All six share the distance at every step, so it belongs to the moment
  // rather than to a triangle -- which is why the module measures it instead of handing
  // each triangle a number.
  assert.ok(Math.abs(radiusAt(0) - 1) < 1e-12);
  assert.ok(Math.abs(radiusAt(GATHERED_STEP) - 0.5) < 1e-12);

  // It closes in on the meeting and opens out again, without a kink or a plateau.
  for (let step = 1; step <= GATHERED_STEP; step += 1) {
    assert.ok(radiusAt(step) < radiusAt(step - 1), `the six stopped closing at ${step}`);
  }
  for (let step = GATHERED_STEP + 1; step < STEPS_PER_CYCLE; step += 1) {
    assert.ok(radiusAt(step) > radiusAt(step - 1), `the six stopped opening at ${step}`);
  }
  // And the corners and the midpoints are the two ends of it: nowhere in the walk do the
  // six stand further out than a corner or closer in than the meeting.
  for (let step = 0; step < STEPS_PER_CYCLE; step += 1) {
    assert.ok(radiusAt(step) >= 0.5 - 1e-12 && radiusAt(step) <= 1 + 1e-12);
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

/**
 * The guide paths, and why what is pinned is the absence of the means.
 *
 * The two triangular paths the six walk used to be stroked faintly underneath. They were
 * drawn on purpose and they were still wrong: they stood perfectly still while everything
 * else moved, so a reader took them for scaffolding somebody had forgotten to rub out.
 * The walk teaches the paths in a couple of seconds anyway.
 *
 * What is left is six filled triangles on a ground, so the scan below is over the
 * vocabulary rather than over pixels — the same shape of pin as One Yin, One Yang's, and
 * for the same reason: reading pixels needs a browser, and this is a claim about what the
 * sketch is able to draw. It cannot be the whole vocabulary here, because the triangles
 * are themselves drawn as shapes and keep beginShape and vertex. The specimen beside it is
 * the sketch exactly as it shipped with the guides, so a scan that stopped seeing them
 * would fail rather than pass.
 */
const STROKING = /\bp\.(stroke|strokeWeight|strokeCap|strokeJoin|noFill|line|curve|arc|point)\s*\(/gu;

function strokingCalls(source) {
  return [...source.matchAll(STROKING)].map((match) => match[1]);
}

test("the sketch has no way to draw a line, and switches the default one off", async () => {
  const sketch = await readFile(
    new URL("../artworks/hex-triangle/sketch.js", import.meta.url),
    "utf8"
  );
  // The scan is looking at the real thing: a file long enough to be the sketch, drawing
  // the one shape it is supposed to draw.
  assert.ok(sketch.length > 2000, `the sketch is only ${sketch.length} characters long`);
  assert.equal([...sketch.matchAll(/\bp\.beginShape\s*\(/gu)].length, 1, "the triangles are gone");
  assert.equal([...sketch.matchAll(/\bp\.noStroke\s*\(/gu)].length, 1, "nothing turns the stroke off");

  assert.deepEqual(strokingCalls(sketch), [], "the sketch can still draw a line");

  // p5 begins with a black stroke a pixel wide, and it was the guides' own last call that
  // used to switch it off: deleting them without moving that call would have outlined all
  // six triangles instead. So the switch-off has to come before anything is drawn, which
  // is an ordering the file itself can be read for.
  assert.ok(
    sketch.indexOf("p.noStroke(") < sketch.indexOf("p.beginShape("),
    "the stroke is switched off after the triangles are drawn"
  );
});

test("the scan finds the guides in the sketch that shipped with them", async () => {
  // The negative control, and it is the real thing rather than one invented for the
  // occasion: the sketch as it stood when a reader took the guides for a stray mark.
  const specimen = await readFile(
    new URL("./fixtures/hex-triangle-guides/sketch.js", import.meta.url),
    "utf8"
  );
  const found = strokingCalls(specimen);
  assert.deepEqual(
    found.sort(),
    ["noFill", "stroke", "strokeWeight"],
    `the specimen no longer carries the guides: found ${found.join(", ")}`
  );
  // And the specimen is otherwise the same artwork, drawing the triangles the same way,
  // so what the scan rejects it for is the guides and not some other difference.
  assert.ok(specimen.includes("trianglesAt"), "the specimen is not this artwork");
  assert.equal([...specimen.matchAll(/\bp\.beginShape\s*\(/gu)].length, 2, "guides and triangles");
});

/**
 * One ink, and whose ink it is.
 *
 * The figure used to be painted in two colours borrowed from One Yin, One Yang, each of
 * them washed into the paper while the six stood apart and at full strength as they
 * closed. It is one near-black now, on every triangle at every step, and the black is
 * Kanizsa Square's — the same value its bites are cut in, on the same paper it is drawn
 * on. That is a decision about the two artworks together, and the artworks do not import
 * from one another here, so the only thing holding the two ends of it together is a
 * written number in each file. A number nothing compares is a number that drifts, so the
 * comparison is made here, from the two sources.
 *
 * The rest of the ruling — one ink rather than several, and no ramp keying it to anything
 * — is a claim about what the sketch is able to paint, so it is read the same way the
 * guides are, out of the file.
 */
const COLOUR_CONSTANT = /^const ([A-Z][A-Z_]*) = \[(\d{1,3}), (\d{1,3}), (\d{1,3})\];$/gmu;

function namedColours(source) {
  return new Map([...source.matchAll(COLOUR_CONSTANT)]
    .map((match) => [match[1], match.slice(2, 5).map(Number)]));
}

async function sketchSource(artworkId) {
  return readFile(new URL(`../artworks/${artworkId}/sketch.js`, import.meta.url), "utf8");
}

test("the triangles are Kanizsa Square's ink, on Kanizsa Square's paper", async () => {
  const hex = namedColours(await sketchSource("hex-triangle"));
  const kanizsa = namedColours(await sketchSource("kanizsa-square"));

  // Both files really do declare the colours the comparison is about, so a rename that
  // slipped past would fail here rather than pass on two undefineds.
  assert.deepEqual([...hex.keys()].sort(), ["GROUND", "INK"], "the palette changed");
  for (const name of ["PAPER", "INK"]) {
    assert.ok(kanizsa.has(name), `Kanizsa Square no longer declares ${name}`);
  }

  assert.deepEqual(hex.get("GROUND"), kanizsa.get("PAPER"), "the two papers have parted");
  assert.deepEqual(hex.get("INK"), kanizsa.get("INK"), "the two inks have parted");
  // And it is a dark ink on a light ground, which is the direction the borrowing assumes.
  const lightness = (colour) => colour.reduce((total, channel) => total + channel, 0);
  assert.ok(lightness(hex.get("INK")) < lightness(hex.get("GROUND")) / 4);
});

test("one ink: nothing in the sketch chooses a colour", async () => {
  const sketch = await sketchSource("hex-triangle");

  // Exactly one fill and one background, and each takes a named colour whole. A fill whose
  // argument were computed could differ from triangle to triangle or step to step even
  // while there was only one call to make it.
  assert.deepEqual(
    [...sketch.matchAll(/\bp\.(fill|background)\s*\(([^)]*)\)/gu)].map((match) =>
      [match[1], match[2]]),
    [["background", "...GROUND"], ["fill", "...INK"]]
  );
  // The colour is set before the walk rather than inside it.
  assert.ok(sketch.indexOf("p.fill(") < sketch.indexOf("trianglesAt("));
});

test("the scan finds the two colours in the sketch that had them", async () => {
  // The negative control, and it is the same frozen specimen the guides are read out of:
  // the sketch as it shipped, in two families of colour keyed to how gathered the six
  // were. Nothing about it was invented for this test.
  const specimen = await readFile(
    new URL("./fixtures/hex-triangle-guides/sketch.js", import.meta.url),
    "utf8"
  );
  const colours = namedColours(specimen);
  // Its ground, and the faint colour the guides were stroked in. No ink: the near-black
  // is exactly what this artwork did not have.
  assert.deepEqual([...colours.keys()].sort(), ["GROUND", "GUIDE"],
    "the specimen no longer carries its palette");
  assert.ok(!colours.has("INK"), "the specimen has been given the ink it never had");
  // Its families are pairs of colours rather than single ones, which is why they are not
  // among the names above, and its fill is computed between them for every triangle.
  assert.ok(/^const RISING = \[\[/mu.test(specimen), "the specimen lost its two families");
  assert.ok(specimen.includes("p.fill(red, green, blue)"), "the specimen lost its computed fill");
});

test("the clip is five gatherings, three hundred frames, ten seconds", () => {
  assert.equal(TOTAL_STEPS, CYCLES * STEPS_PER_CYCLE);
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 10);
  // The clip is a whole number of walks, so it ends on the figure it opened with.
  assert.equal(TOTAL_STEPS % STEPS_PER_CYCLE, 0);
  assert.ok(Math.abs(radiusAt(TOTAL_STEPS) - radiusAt(0)) < 1e-12);
});
