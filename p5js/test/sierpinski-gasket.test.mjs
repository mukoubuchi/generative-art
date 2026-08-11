import assert from "node:assert/strict";
import test from "node:test";
import {
  boundingBox,
  buildGasket,
  countTriangles,
  flattenTriangles,
  gasketDepth
,
  BUILD_FRAMES,
  HOLD_FRAMES,
  RAIN_FRAMES,
  RAIN_POINTS,
  RAIN_SEED,
  TOTAL_FRAMES,
  chaosPoints,
  deepestContainment
} from "../artworks/sierpinski-gasket/geometry.js";

// The Processing sketch: an 800 px canvas, radius 800 * 0.48 and a cutoff of 10.
const PROCESSING_ROOT = { center: { x: 400, y: 400 }, radius: 384, minimumRadius: 10 };
// The p5.js port: a 680 px canvas with both constants kept as the same ratios.
const PORTED_ROOT = { center: { x: 340, y: 340 }, radius: 680 * 0.48, minimumRadius: 680 * 0.0125 };

function build({ center, radius, minimumRadius }) {
  return buildGasket(center, radius, minimumRadius);
}

test("the port keeps the generation count and triangle total of the Processing artwork", () => {
  const original = build(PROCESSING_ROOT);
  const ported = build(PORTED_ROOT);

  // Radii 384, 192, 96, 48, 24, 12, 6 stop once a radius no longer exceeds the cutoff.
  assert.equal(gasketDepth(original), 7);
  assert.equal(countTriangles(original), 1093);
  assert.equal(gasketDepth(ported), gasketDepth(original));
  assert.equal(countTriangles(ported), countTriangles(original));
});

test("every node either branches three ways or terminates", () => {
  const gasket = build(PORTED_ROOT);
  const pending = [gasket];
  let leaves = 0;

  while (pending.length > 0) {
    const node = pending.pop();
    assert.ok(node.children.length === 3 || node.children.length === 0);
    if (node.children.length === 0) {
      leaves += 1;
    }
    pending.push(...node.children);
  }

  assert.equal(leaves, 3 ** 6);
});

test("each child places its outward vertex on the parent vertex it grew from", () => {
  const gasket = build(PORTED_ROOT);
  const parent = flattenTriangles(gasket)[0];

  gasket.children.forEach((child, index) => {
    const childVertex = flattenTriangles(child)[0][index];
    assert.ok(Math.hypot(childVertex.x - parent[index].x, childVertex.y - parent[index].y) < 1e-9);
    assert.equal(child.radius, gasket.radius / 2);
  });
});

test("the gasket stays inside the logical canvas with equal side margins", () => {
  // The sketch shifts the anchor left by a quarter radius to centre the bounding box.
  const radius = PORTED_ROOT.radius;
  const bounds = boundingBox(buildGasket(
    { x: 340 - radius / 4, y: 340 },
    radius,
    PORTED_ROOT.minimumRadius
  ));

  assert.ok(bounds.left >= 0 && bounds.right <= 680);
  assert.ok(bounds.top >= 0 && bounds.bottom <= 680);
  assert.ok(Math.abs(bounds.left - (680 - bounds.right)) < 1e-9);
  assert.ok(Math.abs(bounds.top - (680 - bounds.bottom)) < 1e-9);
});

test("the chaos game agrees with the built skeleton without ever consulting it", async () => {
  const { mulberry32 } = await import("../artworks/shared/random.js");
  const gasket = buildGasket({ x: 0, y: 0 }, 1, 1 / 64);
  const depth = gasketDepth(gasket);
  const rain = chaosPoints({ x: 0, y: 0 }, 1, 500, mulberry32(RAIN_SEED));

  // Every raindrop can be followed to the bottom of the tree, or within one level of
  // it when it falls on a boundary edge shared between children.
  for (const point of rain) {
    assert.ok(deepestContainment(gasket, point) >= depth - 1);
  }
  // Negative control: uniform rain over the box is orphaned early and often.
  const random = mulberry32(99);
  let orphaned = 0;
  for (let index = 0; index < 500; index += 1) {
    const point = { x: random() * 2 - 1, y: random() * 2 - 1 };
    if (deepestContainment(gasket, point) < 3) {
      orphaned += 1;
    }
  }
  assert.ok(orphaned > 350);
});

test("the dimension is measured from the construction: triangles triple as the radius halves", () => {
  const gasket = buildGasket({ x: 0, y: 0 }, 1, 1 / 64);
  const perLevel = [];
  (function tally(node, depth) {
    perLevel[depth] = (perLevel[depth] ?? 0) + 1;
    for (const child of node.children) {
      tally(child, depth + 1);
    }
  })(gasket, 0);

  for (let level = 1; level < perLevel.length; level += 1) {
    assert.equal(perLevel[level] / perLevel[level - 1], 3);
  }
  const dimension = Math.log(3) / Math.log(2);
  assert.ok(Math.abs(dimension - 1.585) < 0.001);
});

test("the clip's plan lands on three hundred frames and the manifest agrees", async () => {
  assert.equal(BUILD_FRAMES + RAIN_FRAMES + HOLD_FRAMES, TOTAL_FRAMES);
  assert.equal(TOTAL_FRAMES, 300);
  assert.ok(RAIN_POINTS >= 3000);
  const { readFileSync } = await import("node:fs");
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "sierpinski-gasket");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.durationSeconds * 30, TOTAL_FRAMES);
});
