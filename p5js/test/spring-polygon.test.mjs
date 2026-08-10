import assert from "node:assert/strict";
import test from "node:test";
import {
  BOB_COUNT,
  STEPS_PER_SECOND,
  createNetwork,
  grab,
  release,
  step,
  totalSpeed
} from "../artworks/spring-polygon/network.js";
import {
  DRAG_STEPS,
  REST_STEPS,
  TOTAL_STEPS,
  networkAfter,
  scenarioPointer
} from "../artworks/spring-polygon/scenario.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const OPTIONS = {
  centerX: 340,
  centerY: 340,
  restLength: 680 * (100 / 600),
  mass: 680 * (32 / 600),
  dragTarget: { x: 680 * 0.9, y: 680 * 0.2 }
};

test("five bobs sit inside five anchors, a pentagon each", () => {
  const network = createNetwork(OPTIONS);

  assert.equal(network.bobs.length, BOB_COUNT);
  assert.equal(network.anchors.length, BOB_COUNT);
  for (let index = 0; index < BOB_COUNT; index += 1) {
    const bob = network.bobs[index];
    const anchor = network.anchors[index];
    assert.ok(Math.abs(Math.hypot(bob.x - 340, bob.y - 340) - OPTIONS.restLength) < 1e-9);
    // Anchors sit at twice the rest length, so every spring starts already stretched.
    assert.ok(Math.abs(Math.hypot(anchor.x - 340, anchor.y - 340) - 2 * OPTIONS.restLength) < 1e-9);
  }
});

test("the clip is a whole number of frames and seven seconds long", () => {
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 210);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 7);
});

test("the scenario holds, drags, then lets go for good", () => {
  const start = { x: 100, y: 200 };
  const target = OPTIONS.dragTarget;

  assert.deepEqual(scenarioPointer(0, start, target), start);
  assert.deepEqual(scenarioPointer(REST_STEPS, start, target), start);
  assert.deepEqual(scenarioPointer(REST_STEPS + DRAG_STEPS, start, target), target);
  assert.equal(scenarioPointer(REST_STEPS + DRAG_STEPS + 1, start, target), undefined);
  assert.equal(scenarioPointer(TOTAL_STEPS, start, target), undefined);
});

test("the pull moves the grabbed bob far from where it started", () => {
  const atRest = networkAfter(REST_STEPS, OPTIONS);
  const pulled = networkAfter(REST_STEPS + DRAG_STEPS, OPTIONS);

  assert.ok(pulled.bobs[0].dragging);
  const travelled = Math.hypot(
    pulled.bobs[0].x - atRest.bobs[0].x,
    pulled.bobs[0].y - atRest.bobs[0].y
  );
  assert.ok(travelled > OPTIONS.restLength);
});

test("the network is released and comes back to rest by the end of the clip", () => {
  const released = networkAfter(REST_STEPS + DRAG_STEPS + 2, OPTIONS);
  const settled = networkAfter(TOTAL_STEPS, OPTIONS);

  assert.ok(released.bobs.every((bob) => !bob.dragging));
  assert.ok(totalSpeed(settled) < 1);
  for (const bob of settled.bobs) {
    assert.ok(Number.isFinite(bob.x) && Number.isFinite(bob.y));
    assert.ok(bob.x > 0 && bob.x < 680);
    assert.ok(bob.y > 0 && bob.y < 680);
  }
});

test("the grab keeps its offset from the bob centre, instead of snapping", () => {
  const network = createNetwork(OPTIONS);
  const bob = network.bobs[0];
  const pointer = { x: bob.x + OPTIONS.mass * 0.5, y: bob.y };
  const grabbed = grab(network, pointer);

  assert.equal(grabbed, bob);
  assert.ok(Math.abs(bob.grabOffsetX + OPTIONS.mass * 0.5) < 1e-9);

  const moved = { x: pointer.x + 60, y: pointer.y + 40 };
  step(network, moved);
  assert.ok(Math.abs(bob.x - (moved.x + bob.grabOffsetX)) < 1e-9);
  assert.ok(Math.abs(bob.y - (moved.y + bob.grabOffsetY)) < 1e-9);

  release(network);
  assert.ok(network.bobs.every((candidate) => !candidate.dragging));
});

test("a pointer nowhere near a bob grabs nothing", () => {
  const network = createNetwork(OPTIONS);

  assert.equal(grab(network, { x: 5, y: 5 }), undefined);
  assert.ok(network.bobs.every((bob) => !bob.dragging));
});
