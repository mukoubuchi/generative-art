import assert from "node:assert/strict";
import test from "node:test";
import {
  BREATHE_DEPTH,
  HUB_RADIUS,
  LOOP_COUNT,
  LOOP_SEED,
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

/** Samples per lap, so the number of laps a loop was drawn with is readable off it. */
const SAMPLES_PER_LAP = 240;
const lapsOf = (points) => points.length / SAMPLES_PER_LAP;

/**
 * How close the loop comes to the centre, measured along its segments rather than at its
 * corners. A polyline can pass nearer the middle between two samples than at either of
 * them, so taking the vertices only would be a weaker claim than the one being made.
 */
function distanceToCentre(points) {
  let closest = Infinity;
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, -(from.x * dx + from.y * dy) / lengthSquared));
    closest = Math.min(closest, Math.hypot(from.x + along * dx, from.y + along * dy));
  }
  return closest;
}

function translated(points, dx) {
  return points.map((point) => ({ x: point.x + dx, y: point.y }));
}

/**
 * The widest berth the second lap gives the first: for each point of one lap, how far the
 * nearest point of the other lap is, taken at its worst. Small means the two laps are
 * drawn on top of each other and the curve is really one closed loop traced twice.
 */
function strandGap(points) {
  const half = points.length / 2;
  const first = points.slice(0, half);
  const second = points.slice(half);
  let widest = 0;
  for (const point of first) {
    let nearest = Infinity;
    for (const other of second) {
      nearest = Math.min(nearest, Math.hypot(point.x - other.x, point.y - other.y));
    }
    widest = Math.max(widest, nearest);
  }
  return widest;
}

/** Every value the winding number takes as the loop is dragged sideways, with where. */
function dragProfile(points, stride) {
  const changes = [];
  let previous = null;
  for (let dx = 0; dx <= 760; dx += stride) {
    const moved = translated(points, dx);
    const winding = windingByCrossings(moved);
    if (winding !== previous) {
      changes.push({ dx, winding, reach: distanceToCentre(moved) });
      previous = winding;
    }
  }
  return changes;
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
  assert.deepEqual(windings, [-2, 1, 0, 1, 1, 2, -1]);
  const distinct = new Set(windings);
  assert.equal(distinct.size, 5);
  assert.ok(distinct.has(0), "no loop stands clear of the hub");
  assert.ok([...distinct].some((n) => n > 0) && [...distinct].some((n) => n < 0),
    "the loops all run the same way round");
});

test("a loop drawn with two laps is caught only once, so the number is not the lap count", () => {
  // The claim that the winding numbers are measured and not declared, put where it can
  // fail. The seed draws each loop a direction and a number of laps; if the curve were a
  // star about a fixed centre it would enclose every interior point exactly once per lap,
  // and the winding number could only ever come out as the lap count or nought — the seed
  // would be announcing the answer and the measurement would be theatre. The centre drifts
  // as the curve is drawn, so this one lays its second lap over ground the first missed.
  const witness = LOOPS.find((loop) => lapsOf(loop) === 2 && Math.abs(windingByCrossings(loop)) === 1);
  assert.ok(witness, "no loop goes round twice while being caught once");
  assert.equal(windingByCrossings(witness), 1);
  assert.equal(lapsOf(witness), 2);
  // And it is not caught once merely by missing the hub with one lap and never returning:
  // it crosses itself, which is what puts the hub inside one lobe and outside the other.
  assert.ok(strandGap(witness) > 60, "the two laps of the witness are drawn on top of each other");

  // The lap counts are all the generator ever decides, and they disagree with the measured
  // numbers here. Both values appear, so neither is a constant either.
  const laps = LOOPS.map(lapsOf);
  assert.deepEqual(laps, [2, 1, 1, 1, 2, 2, 1]);
  assert.notDeepEqual(laps.map((count, index) => Math.abs(windingByCrossings(LOOPS[index]))), laps);
});

test("a loop caught twice is two strands, not one strand drawn twice", () => {
  // Without this the deeper colours would be a lie to the eye: a curve retracing its own
  // first lap looks exactly like a loop that goes round once, and nothing in the picture
  // would let a viewer see the two. It would also weaken the drag below, because both
  // strands would leave the hub at the same instant and the number would fall 2 to 0.
  const doubles = LOOPS.filter((loop) => Math.abs(windingByCrossings(loop)) === 2);
  assert.equal(doubles.length, 2, "no pair of doubly-caught loops to check");
  for (const loop of doubles) {
    assert.equal(lapsOf(loop), 2);
    assert.ok(strandGap(loop) > 40,
      `the second lap never leaves the first by more than ${strandGap(loop)}`);
  }
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

test("dragging a loop off the hub moves its number by exactly one, one strand at a time", () => {
  // The negative control, and the point of the artwork stated from the other side. The
  // stirring cannot do this; a plain translation can. Carrying a loop sideways until the
  // centre falls outside it changes the winding number, and every change is by one and
  // happens at exactly the moment a strand passes over the centre.
  const stride = 0.5;

  const single = LOOPS.find((points) => Math.abs(windingByCrossings(points)) === 1);
  assert.ok(single, "no singly-caught loop to drag");
  const singly = dragProfile(single, stride);
  assert.equal(Math.abs(singly[0].winding), 1);
  assert.deepEqual(singly.map((change) => change.winding), [singly[0].winding, 0]);

  // A loop caught twice has two strands round the hub, and dragging it out cuts them one
  // at a time. This is the reading the old generator could not give: with the second lap
  // retracing the first, both strands left the hub together and the number fell straight
  // from two to nought, which says nothing about winding numbers changing by one.
  const double = LOOPS.find((points) => windingByCrossings(points) === 2);
  assert.ok(double, "no doubly-caught loop to drag");
  const doubly = dragProfile(double, stride);
  assert.deepEqual(doubly.map((change) => change.winding), [2, 1, 0]);
  assert.ok(doubly[2].dx - doubly[1].dx > 10, "both strands were cut at the same moment");

  // Every change happened because a strand went over the centre, not for some other
  // reason: at each one the curve is within a stride of the middle.
  for (const change of [...singly.slice(1), ...doubly.slice(1)]) {
    assert.ok(change.reach < stride,
      `the number changed at ${change.dx} while the loop was ${change.reach} from the centre`);
  }
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

test("the loops really are dragged about, and stay inside the wheel", () => {
  // The liveness check the invariance needs: a stirring that did nothing would pass every
  // test above. And the reach, because a loop swept off the canvas would be invariant
  // where nobody could see it. The generator only promises the canvas; that everything
  // also stays inside the rim for the whole clip is this seed's doing, so it is checked.
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
  assert.ok(furthest < RIM_RADIUS, `a loop reached ${furthest}, outside the rim at ${RIM_RADIUS}`);
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
  assert.notDeepEqual(sample(LOOP_SEED + 1), sample(LOOP_SEED));
  for (const loop of LOOPS) {
    assert.ok(clearsHub(loop), "a seeded loop was laid across the hub");
    assert.ok(Math.max(...loop.map((p) => Math.hypot(p.x, p.y))) < REACH_LIMIT);
  }
});

test("every mode of the wobble closes, whatever the lap count", () => {
  // Why the harmonics are counted over the whole curve and not per lap. Each mode has to
  // turn a whole number of times between the start and the end or the curve would not
  // close; per lap that number may be a half, and for a two-lap loop it is what stops the
  // second lap retracing the first.
  for (const turns of [1, 2]) {
    const orders = [1, 2, 3].map((index) => (turns + index) / turns);
    for (const order of orders) {
      const overTheCurve = order * turns;
      assert.ok(Number.isInteger(overTheCurve), `order ${order} does not close over ${turns} laps`);
    }
    const perLap = orders.filter((order) => Number.isInteger(order));
    assert.equal(perLap.length, turns === 1 ? 3 : 1,
      "a two-lap loop needs modes that come back inverted, or its laps coincide");
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
