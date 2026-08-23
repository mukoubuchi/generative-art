import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  reachAt,
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
  assert.ok(sketch.includes("paintCells(reach)"), "the scan is not looking at the cells");
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

test("the front's end is read back from the table it is compared with", () => {
  // Single precision rounds both ways, so a distance written into a Float32Array can come
  // back larger than the double it was written from. Taking the clip's end from the doubles
  // therefore left the farthest pixel unreached in the last frame: three bytes of six
  // million, and exactly the three that decide whether the clip ends on the picture the
  // catalog registers.
  const store = new Float32Array(1);
  const measured = 512.1234567890123;
  store[0] = measured;
  assert.ok(store[0] > measured, "this witness no longer shows the rounding it was chosen for");

  const sketch = readFileSync(
    new URL("../artworks/voronoi-bloom/sketch.js", import.meta.url), "utf8");
  // So the farthest is taken from the table rather than from the measurement.
  assert.match(sketch, /reached\[cell\] = measurement\.nearest;/u);
  assert.match(sketch, /if \(reached\[cell\] > farthest\) \{\n {10}farthest = reached\[cell\];/u);
  assert.equal(sketch.includes("if (measurement.nearest > farthest)"), false);
});

test("Voronoi Bloom is registered as the fronts spreading", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const artwork = manifest.artworks.find((entry) => entry.id === "voronoi-bloom");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.artifact, "exports/p5js/VoronoiBloom.mp4");
  assert.equal(artwork.render.durationSeconds, 10);
  assert.deepEqual(artwork.thumbnail, { frame: 290 });

  const sketch = readFileSync(
    new URL("../artworks/voronoi-bloom/sketch.js", import.meta.url), "utf8");
  // One radius for every front, read off the picture's own distances.
  assert.match(sketch, /reachAt\(part, field\.ordered, field\.farthest\)/u);
  // The loop is stopped for the renderer, and on the page only once the bloom is whole.
  assert.match(sketch, /if \(CAPTURE_MODE\) \{\n {6}p\.noLoop\(\);/u);
  assert.match(sketch, /if \(p\.frameCount >= TOTAL_FRAMES\) \{\n {6}p\.noLoop\(\);/u);
  assert.equal(sketch.match(/p\.noLoop\(\);/gu).length, 2);
});

test("the clock lights the same area every frame, and ends on the farthest pixel", () => {
  // The radius is read off the sorted distances, so the share of the table below it is the
  // share of the picture lit. Walked in equal steps that share rises in equal steps, which
  // is the whole claim: the clip spends its ten seconds on the diagram rather than on the
  // corners.
  //
  // The table is this artwork's own field, measured on a coarse grid rather than invented:
  // forty-two sites laid by the sketch's own rule, and each cell's distance to the nearest
  // of them. That shape matters. Fronts from forty-two seeds meet early and then have only
  // the corners left, so the distances crowd towards the small end with a long thin tail --
  // which is exactly why a radius walked at a constant rate front-loads the picture.
  const width = 200;
  const height = 160;
  const measurement = { index: 0, nearest: 0, gap: 0 };
  const xs = Float64Array.from(sites, (site) => site.x);
  const ys = Float64Array.from(sites, (site) => site.y);
  const distances = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      nearestTwo(xs, ys, SITE_COUNT, column * (WIDTH / width), row * (HEIGHT / height), measurement);
      distances.push(measurement.nearest);
    }
  }
  const ordered = Float32Array.from(distances).sort();
  const cells = ordered.length;
  const farthest = ordered[cells - 1];
  const frames = 270;
  const litAt = (reach) => {
    let count = 0;
    for (const distance of ordered) {
      if (distance <= reach) {
        count += 1;
      }
    }
    return count;
  };

  const lit = [];
  for (let frame = 0; frame <= frames; frame += 1) {
    lit.push(litAt(reachAt(Math.min(frame / frames, 1), ordered, farthest)));
  }
  assert.equal(lit.at(-1), cells, "the last frame does not reach every pixel");
  assert.equal(reachAt(1, ordered, farthest), farthest);

  // Every step of the clock lights the same share, to within the rounding a floor can drop
  // and the ties a real field has. The share is cells/frames, which is what "equal area a
  // frame" means stated as a number rather than as a hope.
  const steps = lit.slice(1, frames).map((value, index) => value - lit[index]);
  const share = cells / frames;
  const worst = Math.max(...steps.map((step) => Math.abs(step - share)));
  // Measured at 0.5 of the 118.5 pixels a frame on this grid; the bound is a hundredth of
  // the share, which is twenty times what the rounding actually costs.
  assert.ok(worst <= share * 0.01,
    `a frame was ${worst.toFixed(1)} pixels off the ${share.toFixed(1)} it should light`);
  assert.ok(steps.every((step) => step >= 0), "the clock goes backwards");

  // The negative control is the clock this replaced, on the same field: a radius walked at
  // a constant rate. It lights most of the picture early and then has frames that add
  // almost nothing, which is the thing the change was made to stop.
  const constant = [];
  for (let frame = 0; frame <= frames; frame += 1) {
    constant.push(litAt(farthest * Math.min(frame / frames, 1)));
  }
  assert.ok(constant[Math.round(frames / 2)] > cells * 0.8,
    "the control clock does not front-load this field, so it is not the contrast it is here for");
  const constantSteps = constant.slice(1, frames).map((value, index) => value - constant[index]);
  assert.ok(Math.max(...constantSteps) > share * 2, "the control clock is not uneven");
  // And it has a tail of frames that add almost nothing. Measured on this grid: 29 of the
  // 269 steps light under a tenth of the share, against none under half of it for the
  // clock in use.
  assert.ok(constantSteps.filter((step) => step < share * 0.1).length > 20,
    "the control clock has no thin tail, so the comparison has nothing to show");
  assert.equal(steps.filter((step) => step < share * 0.5).length, 0,
    "the clock in use has thin frames of its own");
});
