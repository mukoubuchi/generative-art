import assert from "node:assert/strict";
import test from "node:test";
import {
  BREATHE_DEPTH,
  HUB_RADIUS,
  LOOP_COUNT,
  REACH_LIMIT,
  RIM_RADIUS,
  SPOKE_COUNT,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  breatheAt,
  carry,
  clearsHub,
  loopAt,
  seededLoops,
  spokes,
  twistAt,
  twistShare,
  windingByAngle,
  windingByCrossings
} from "../artworks/thirty-spokes/winding.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const LOOPS = seededLoops();

function distanceToCentre(points) {
  return Math.min(...points.map((point) => Math.hypot(point.x, point.y)));
}

function translated(points, dx) {
  return points.map((point) => ({ x: point.x + dx, y: point.y }));
}

/**
 * The artwork's claim is that a loop threaded through the hub is caught there: its
 * winding number is an integer and nothing the stirring does can change it. These tests
 * hold that three ways — the number is computed twice by calculations that share no
 * arithmetic and must agree as integers, it must not move over the whole clip, and it
 * must move by exactly one when a curve is dragged across the hub, which is the thing
 * the stirring is built to be unable to do.
 */

test("the seeded loops really do wind different numbers of times", () => {
  // The vacuity guard. If every loop wound the same number of times — or worse, none at
  // all — the invariance below would hold for uninteresting reasons and the colouring
  // would have nothing to say. The exact multiset is pinned, so a change to the seed or
  // to the generator has to be looked at rather than absorbed.
  assert.equal(LOOPS.length, LOOP_COUNT);
  const windings = LOOPS.map((loop) => windingByCrossings(loop));
  assert.deepEqual(windings, [2, -1, 2, 1, -2, 0, -1]);
  const distinct = new Set(windings);
  assert.equal(distinct.size, 5);
  assert.ok(distinct.has(0), "no loop stands clear of the hub");
  assert.ok([...distinct].some((n) => n > 0) && [...distinct].some((n) => n < 0),
    "the loops all run the same way round");
});

test("two calculations that share no arithmetic return the same integer", () => {
  // Counting signed ray crossings is integer work; adding up turned angle is not. They
  // are held to each other at every sampled step of the clip, so neither can be quietly
  // wrong: a rounding story in one would have to be matched exactly by the other.
  let checks = 0;
  for (let step = 0; step <= TOTAL_STEPS; step += 5) {
    for (const loop of LOOPS) {
      const now = loopAt(loop, step);
      const counted = windingByCrossings(now);
      const summed = windingByAngle(now);
      assert.ok(Number.isInteger(counted), "counting crossings did not give an integer");
      assert.ok(Math.abs(summed - counted) < 1e-9,
        `crossings say ${counted}, turned angle says ${summed} at step ${step}`);
      checks += 1;
    }
  }
  assert.ok(checks > 800, `only ${checks} comparisons were made`);
});

test("the ray may be sent in any direction and the count is the same", () => {
  // Nothing about the answer belongs to the ray. If it did, the integer would be an
  // artefact of where the test happened to look.
  for (const loop of LOOPS) {
    const now = loopAt(loop, 137);
    const expected = windingByCrossings(now, 0);
    for (let index = 1; index < 12; index += 1) {
      const bearing = (Math.PI * 2 * index) / 12 + 0.031;
      assert.equal(windingByCrossings(now, bearing), expected, "the ray direction mattered");
    }
  }
});

test("no stirring of the whole clip moves a winding number", () => {
  const atRest = LOOPS.map((loop) => windingByCrossings(loop));
  for (let step = 0; step <= TOTAL_STEPS; step += 1) {
    LOOPS.forEach((loop, index) => {
      assert.equal(windingByCrossings(loopAt(loop, step)), atRest[index],
        `loop ${index} changed its winding number at step ${step}`);
    });
  }
});

test("dragging a loop across the hub moves its number by exactly one", () => {
  // The negative control, and the point of the artwork stated from the other side. The
  // stirring cannot do this; a plain translation can. Carrying a loop sideways until the
  // centre falls outside it changes the winding number once, by one, and at exactly the
  // moment the curve passes over the centre.
  const loop = LOOPS.find((points) => Math.abs(windingByCrossings(points)) === 1);
  assert.ok(loop, "no singly-wound loop to drag");
  const start = windingByCrossings(loop);

  const stride = 2;
  const readings = [];
  for (let dx = 0; dx <= 620; dx += stride) {
    const moved = translated(loop, dx);
    readings.push({ dx, winding: windingByCrossings(moved), reach: distanceToCentre(moved) });
  }
  const values = new Set(readings.map((reading) => reading.winding));
  assert.deepEqual([...values].sort((a, b) => a - b), [0, start].sort((a, b) => a - b));

  const changes = readings.filter(
    (reading, index) => index > 0 && reading.winding !== readings[index - 1].winding
  );
  assert.equal(changes.length, 1, `the number moved ${changes.length} times`);
  assert.equal(Math.abs(changes[0].winding - start), 1, "the number did not move by one");
  // And it moved because the curve went over the centre, not for some other reason: at
  // the crossing the loop is within one stride of the middle.
  assert.ok(changes[0].reach < stride,
    `the number changed while the loop was still ${changes[0].reach} away from the centre`);
});

test("the stirring cannot carry anything into the hub", () => {
  // Which is why the invariance above is structural rather than lucky. The twist leaves
  // every distance alone and the breathing scales the distance from the hub's rim by a
  // strictly positive number, so a point outside stays outside.
  let closest = Infinity;
  for (let step = 0; step <= TOTAL_STEPS; step += 1) {
    assert.ok(1 + breatheAt(step) > 0, `the breathing collapsed at step ${step}`);
    for (const loop of LOOPS) {
      closest = Math.min(closest, distanceToCentre(loopAt(loop, step)));
    }
  }
  assert.ok(closest > HUB_RADIUS, `something came within ${closest} of the centre`);
  assert.equal(twistShare(HUB_RADIUS), 0, "the hub itself is turned by the twist");
  // A point on the hub's own rim is a fixed point of both maps, at every step.
  for (const step of [0, 91, 300, 457, TOTAL_STEPS]) {
    const onRim = carry({ x: HUB_RADIUS, y: 0 }, step);
    assert.ok(Math.abs(Math.hypot(onRim.x, onRim.y) - HUB_RADIUS) < 1e-9);
  }
});

test("the loops really are dragged about, and stay on the canvas", () => {
  // The liveness check the invariance needs: a stirring that did nothing would pass every
  // test above. And the reach, because a loop swept off the canvas would be invariant
  // where nobody could see it.
  let travelled = 0;
  let furthest = 0;
  for (let step = 0; step <= TOTAL_STEPS; step += 3) {
    for (const loop of LOOPS) {
      const now = loopAt(loop, step);
      now.forEach((point, index) => {
        travelled = Math.max(travelled, Math.hypot(point.x - loop[index].x, point.y - loop[index].y));
        furthest = Math.max(furthest, Math.hypot(point.x, point.y));
      });
    }
  }
  assert.ok(travelled > 150, `the furthest anything moved was ${travelled}`);
  assert.ok(furthest < 340, `a loop reached ${furthest}, off a canvas half ${340} wide`);
  assert.ok(Math.abs(twistAt(TOTAL_STEPS / 4)) > 1, "the twist barely turned anything");
});

test("the clip closes on the frame it opened with, to the bit", () => {
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 10);
  for (const loop of LOOPS) {
    assert.deepEqual(loopAt(loop, TOTAL_STEPS), loopAt(loop, 0));
  }
  assert.equal(twistAt(0), 0);
  assert.equal(breatheAt(0), breatheAt(TOTAL_STEPS));

  // And it does not stop halfway. The twist is nought at the midpoint as well as at the
  // doors, so the breathing is what has to differ there — and with an odd number of
  // breaths off a phase it is at the opposite of its opening depth.
  const middle = TOTAL_STEPS / 2;
  // The twist really is back to nothing at the midpoint — a sine of pi rather than of
  // nought, so this one is a measurement and not an equality.
  assert.ok(Math.abs(twistAt(middle)) < 1e-12);
  assert.ok(Math.abs(breatheAt(middle) + breatheAt(0)) < 1e-12, "the breathing repeated at the midpoint");
  assert.ok(Math.abs(breatheAt(middle) - breatheAt(0)) > 0.4, "the midpoint is the opening frame again");
  for (const loop of LOOPS) {
    const opening = loopAt(loop, 0);
    const midway = loopAt(loop, middle);
    const apart = Math.max(...midway.map((point, index) =>
      Math.hypot(point.x - opening[index].x, point.y - opening[index].y)));
    assert.ok(apart > 20, `the clip returned to its opening frame at the midpoint (${apart})`);
  }
});

test("the loops retrace their seed, and another seed draws different ones", () => {
  const sample = (seed) => seededLoops(seed).map((loop) => windingByCrossings(loop));
  assert.deepEqual(seededLoops(), seededLoops());
  assert.notDeepEqual(sample(43), sample(42));
  for (const loop of LOOPS) {
    assert.ok(clearsHub(loop), "a seeded loop was laid across the hub");
    assert.ok(Math.max(...loop.map((p) => Math.hypot(p.x, p.y))) < REACH_LIMIT);
  }
});

test("the wheel is thirty spokes between the hub and the rim", () => {
  const wheel = spokes();
  assert.equal(wheel.length, SPOKE_COUNT);
  assert.equal(SPOKE_COUNT, 30);
  for (const spoke of wheel) {
    assert.ok(Math.abs(Math.hypot(spoke.x1, spoke.y1) - HUB_RADIUS) < 1e-9);
    assert.ok(Math.abs(Math.hypot(spoke.x2, spoke.y2) - RIM_RADIUS) < 1e-9);
  }
  assert.ok(BREATHE_DEPTH < 1, "a breathing this deep could turn a loop inside out");
});
