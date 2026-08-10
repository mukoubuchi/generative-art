import assert from "node:assert/strict";
import test from "node:test";
import {
  boundingBox,
  buildGasket,
  countTriangles,
  flattenTriangles,
  gasketDepth
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
