import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EDGE_GAP,
  GOLDEN_ANGLE,
  HUE_HIGH,
  HUE_LOW,
  SITE_COUNT,
  createSites,
  nearestTwo,
  shade
} from "../artworks/voronoi-bloom/bloom.js";

const WIDTH = 800;
const HEIGHT = 640;
const noise = (x, y = 0) => 0.5 + 0.5 * Math.sin(x * 1.7 + y * 2.3);

/** A stand-in for p5's random, so the layout can be built without a browser. */
function makeRandom(seed) {
  let state = seed;
  return (low, high) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return low + (high - low) * (state / 2147483648);
  };
}

const sites = createSites(WIDTH, HEIGHT, makeRandom(5), noise);

/** Every overlay call that can put a geometric mark on top of the pixel-painted cells. */
function paintingCalls(source) {
  return [...source.matchAll(
    /\bp\.(blendMode|strokeWeight|stroke|line|noFill|noStroke|fill|circle|point)\s*\(/gu
  )].map(([, call]) => call);
}

test("forty-two sites all land inside the canvas", () => {
  assert.equal(sites.length, SITE_COUNT);
  for (const site of sites) {
    assert.ok(site.x > 0 && site.x < WIDTH);
    assert.ok(site.y > 0 && site.y < HEIGHT);
    assert.ok(site.hue >= HUE_LOW - 1e-9 && site.hue <= HUE_HIGH + 1e-9);
  }
});

test("the spiral opens outwards and never doubles back", () => {
  const reach = Math.min(WIDTH, HEIGHT) * 0.44;
  // Measured without the jitter, the radius has to increase with every site.
  const plain = createSites(WIDTH, HEIGHT, () => 0, noise);
  let previous = -1;
  for (const site of plain) {
    const radius = Math.hypot(site.x - WIDTH / 2, site.y - HEIGHT / 2);
    assert.ok(radius > previous, "each site sits further out than the last");
    assert.ok(radius <= reach + 1e-9);
    previous = radius;
  }
});

test("successive sites turn by the golden angle", () => {
  const plain = createSites(WIDTH, HEIGHT, () => 0, noise);
  const angleOf = (site) => Math.atan2(site.y - HEIGHT / 2, site.x - WIDTH / 2);
  const wrap = (angle) => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  for (let index = 1; index < plain.length; index += 1) {
    const turn = wrap(angleOf(plain[index]) - angleOf(plain[index - 1]));
    assert.ok(Math.abs(turn - wrap(GOLDEN_ANGLE)) < 1e-6);
  }
});

test("the two nearest sites are found, and their gap vanishes on a boundary", () => {
  const xs = Float64Array.from([0, 100]);
  const ys = Float64Array.from([0, 0]);
  const out = { index: 0, nearest: 0, gap: 0 };

  nearestTwo(xs, ys, 2, 10, 0, out);
  assert.equal(out.index, 0);
  assert.ok(Math.abs(out.nearest - 10) < 1e-9);
  assert.ok(Math.abs(out.gap - 80) < 1e-9);

  // Halfway between them is exactly on the Voronoi edge, where the gap is zero.
  nearestTwo(xs, ys, 2, 50, 0, out);
  assert.ok(Math.abs(out.gap) < 1e-9);

  nearestTwo(xs, ys, 2, 90, 0, out);
  assert.equal(out.index, 1);
});

test("shading is brightest on a boundary and dimmest deep inside a cell", () => {
  const site = { hue: 250 };
  const onEdge = shade(site, { nearest: 40, gap: 0 }, 0.5, 1);
  const inside = shade(site, { nearest: 40, gap: EDGE_GAP }, 0.5, 1);

  assert.ok(onEdge.brightness > inside.brightness);
  assert.ok(onEdge.saturation < inside.saturation, "edges wash out as they brighten");
  for (const ink of [onEdge, inside]) {
    assert.ok(ink.brightness >= 0 && ink.brightness <= 100);
    assert.ok(ink.saturation >= 0 && ink.saturation <= 100);
    assert.ok(ink.hue >= 0 && ink.hue < 360);
  }
});

test("the vignette darkens the corners without touching the middle", () => {
  const site = { hue: 250 };
  const middle = shade(site, { nearest: 5, gap: 4 }, 0.5, 1);
  const corner = shade(site, { nearest: 5, gap: 4 }, 0.5, 0);

  assert.ok(corner.brightness < middle.brightness);
  assert.ok(Math.abs(corner.brightness / middle.brightness - 0.38) < 1e-9);
});

test("the cells carry only their generators and grain", async () => {
  // The distance field already paints the equal-distance boundaries and the glow around
  // every generator. What sits over it is therefore one small circle per site and grain:
  // no nearest-neighbour graph, and no second circle restating the glow as a halo.
  const sketch = await readFile(
    new URL("../artworks/voronoi-bloom/sketch.js", import.meta.url), "utf8");
  assert.deepEqual(paintingCalls(sketch), [
    "noStroke", "fill", "circle",
    "strokeWeight", "stroke", "point"
  ]);
  assert.match(sketch, /p\.circle\(site\.x, site\.y, 2\.4\)/u);
  assert.ok(sketch.includes("paintCells(sites)"), "the scan is not looking at the cells");
  assert.ok(sketch.includes("addGrain()"), "the scan is not looking at the grain");
});

test("the scan finds both overlays in the sketch that shipped with them", async () => {
  // The negative control is the shipped sketch before the subtraction, not a synthetic
  // example. It draws the same cells, sites and grain, then adds the nearest-neighbour
  // lines and a larger stroked circle around every generator.
  const specimen = await readFile(
    new URL("./fixtures/voronoi-bloom-overlays/sketch.js", import.meta.url), "utf8");
  assert.deepEqual(paintingCalls(specimen), [
    "blendMode", "strokeWeight", "stroke", "line", "blendMode",
    "noFill", "stroke", "strokeWeight", "circle", "noStroke", "fill", "circle",
    "strokeWeight", "stroke", "point"
  ]);
  assert.ok(specimen.includes("paintCells(sites)"), "the specimen is not this artwork");
  assert.ok(specimen.includes("createSites("), "the specimen has no generators");
  assert.ok(specimen.includes("addGrain()"), "the specimen has no grain");
});
