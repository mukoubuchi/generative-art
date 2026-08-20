import assert from "node:assert/strict";
import test from "node:test";
import {
  CATENARY_PARAMETER,
  HALF_SPAN,
  NODE_COUNT,
  TOTAL_FRAMES,
  archResidual,
  archShareAt,
  hangingNodes,
  hangingResidual,
  jointLoads,
  reflectedNodes,
  reflectionProgressAt,
  sagAt
} from "../artworks/what-hangs-stands/funicular.js";

const HANGING = hangingNodes();
const ARCH = reflectedNodes(HANGING);
const LOADS = jointLoads(HANGING);

test("the sampled catenary lands exactly on both supports", () => {
  assert.equal(HANGING.length, NODE_COUNT);
  assert.equal(HANGING[0].x, -HALF_SPAN);
  assert.equal(HANGING.at(-1).x, HALF_SPAN);
  assert.equal(HANGING[0].y, 0);
  assert.equal(HANGING.at(-1).y, 0);
  assert.equal(sagAt(-HALF_SPAN), 0);
  assert.equal(sagAt(HALF_SPAN), 0);
});

test("the chain follows the stated catenary and sags by a visible amount", () => {
  for (const node of HANGING) {
    assert.equal(node.y, CATENARY_PARAMETER * (
      Math.cosh(HALF_SPAN / CATENARY_PARAMETER) - Math.cosh(node.x / CATENARY_PARAMETER)
    ));
  }
  const crown = HANGING[(NODE_COUNT - 1) / 2];
  assert.ok(crown.y > 160 && crown.y < 190, `sag is only ${crown.y}`);
});

test("the arch is the chain reflected across the springing line and nothing else", () => {
  HANGING.forEach((node, index) => {
    assert.equal(ARCH[index].x, node.x);
    assert.equal(ARCH[index].y, -node.y);
  });
});

test("both funicular polygons are bilaterally symmetric", () => {
  HANGING.forEach((node, index) => {
    const opposite = HANGING.at(-index - 1);
    assert.ok(Math.abs(node.x + opposite.x) < 1e-12);
    assert.ok(Math.abs(node.y - opposite.y) < 1e-12);
  });
});

test("every required joint load points down and mirrors its partner", () => {
  assert.equal(LOADS.length, NODE_COUNT - 2);
  LOADS.forEach(({ load }, index) => {
    assert.ok(load > 0, `joint ${index + 1} asks for an upward load`);
    assert.ok(Math.abs(load - LOADS.at(-index - 1).load) < 1e-12);
  });
});

test("the joint loads are one uniform weight distributed along the chain", () => {
  const step = HANGING[1].x - HANGING[0].x;
  const densities = LOADS.map(({ index, load }) => {
    const x = HANGING[index].x;
    // Half of each neighbouring analytic catenary segment belongs to this joint.
    const tributaryLength = (CATENARY_PARAMETER / 2) * (
      Math.sinh((x + step) / CATENARY_PARAMETER)
      - Math.sinh((x - step) / CATENARY_PARAMETER)
    );
    return load / tributaryLength;
  });
  for (const density of densities) {
    assert.ok(Math.abs(density - densities[0]) < 1e-14);
  }
});

test("tension and the vertical loads balance every hanging joint", () => {
  for (const { index, load } of LOADS) {
    const residual = hangingResidual(HANGING, index, load);
    assert.ok(Math.abs(residual.x) < 1e-14);
    assert.ok(Math.abs(residual.y) < 1e-12, `joint ${index} misses by ${residual.y}`);
  }
});

test("reflection turns the same force polygon into a compression-only arch", () => {
  for (const { index, load } of LOADS) {
    const residual = archResidual(ARCH, index, load);
    assert.ok(Math.abs(residual.x) < 1e-14);
    assert.ok(Math.abs(residual.y) < 1e-12, `joint ${index} misses by ${residual.y}`);
  }
});

test("the reflection is held at both exact forms and closes its ten-second loop", () => {
  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(reflectionProgressAt(0), 0);
  assert.equal(reflectionProgressAt(45), 0);
  assert.equal(reflectionProgressAt(135), 1);
  assert.equal(reflectionProgressAt(195), 1);
  assert.equal(reflectionProgressAt(285), 0);
  assert.equal(reflectionProgressAt(TOTAL_FRAMES), reflectionProgressAt(0));
});

test("the travelling frontier reveals the arch from left to right", () => {
  const frame = 90;
  assert.ok(archShareAt(-HALF_SPAN, frame) > 0.99);
  assert.ok(archShareAt(0, frame) > 0.45 && archShareAt(0, frame) < 0.55);
  assert.ok(archShareAt(HALF_SPAN, frame) < 0.01);
  for (let index = 1; index < HANGING.length; index += 1) {
    assert.ok(archShareAt(HANGING[index - 1].x, frame) >= archShareAt(HANGING[index].x, frame));
  }
});
