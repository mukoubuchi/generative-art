import assert from "node:assert/strict";
import test from "node:test";
import {
  BOB_COUNT,
  BOB_MASS,
  DAMPING,
  GRAB_RADIUS,
  STAKE_RADII,
  STEPS_PER_SECOND,
  bobEnergies,
  createNetwork,
  grab,
  integrateStep,
  release,
  springForces,
  step,
  totalEnergy
} from "../artworks/spring-polygon/network.js";
import {
  DRAG_STEPS,
  RELEASE_STEP,
  REST_STEPS,
  TOTAL_STEPS,
  networkAfter,
  scenarioEnergyPeak,
  scenarioPointer
} from "../artworks/spring-polygon/scenario.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const OPTIONS = {
  centerX: 340,
  centerY: 340,
  radius: 110,
  dragTarget: { x: 340, y: 340 - 110 - 150 }
};

/** Run the capture scenario, calling `visit(network, stepIndex)` after every step. */
function foldScenario(visit) {
  const network = createNetwork(OPTIONS);
  const start = { x: network.bobs[0].x, y: network.bobs[0].y };
  for (let stepIndex = 0; stepIndex < TOTAL_STEPS; stepIndex += 1) {
    if (stepIndex === REST_STEPS) {
      grab(network, start);
    }
    if (stepIndex === RELEASE_STEP + 1) {
      release(network);
    }
    step(network, scenarioPointer(stepIndex, start, OPTIONS.dragTarget));
    visit(network, stepIndex);
  }
  return network;
}

/**
 * The claims the artwork makes are about energy, so they are tested as energy: the
 * pentagon opens at a true equilibrium holding none, the hand's pull injects a
 * measured amount, the ring passes it around at a finite speed — near stars answer
 * before far ones — and the viscous damping drains it on the one exponential law
 * uniform damping imposes on every mode at once.
 */

test("the fold the tests watch is the scenario the artwork runs", () => {
  // foldScenario repeats the capture's choreography so the tests can watch it step by
  // step, which networkAfter cannot show. A second copy of a script is free to drift
  // from the first: change scenario.js and every test built on this helper would keep
  // measuring the old choreography, in green. So the copy is held to the original.
  assert.deepEqual(foldScenario(() => {}), networkAfter(TOTAL_STEPS, OPTIONS));
});

test("five bobs on a pentagon, staked from three radii out, at a true equilibrium", () => {
  const network = createNetwork(OPTIONS);
  assert.equal(network.bobs.length, BOB_COUNT);
  assert.equal(network.anchors.length, BOB_COUNT);
  assert.equal(STAKE_RADII, 3);
  network.bobs.forEach((bob, index) => {
    assert.ok(Math.abs(Math.hypot(bob.x - 340, bob.y - 340) - 110) < 1e-9);
    const anchor = network.anchors[index];
    assert.ok(Math.abs(Math.hypot(anchor.x - 340, anchor.y - 340) - STAKE_RADII * 110) < 1e-9);
  });
  // The first bob stands due up, where the scenario's hand will find it.
  assert.ok(Math.abs(network.bobs[0].x - 340) < 1e-9 && network.bobs[0].y < 340);
  // Rest lengths equal the opening distances, so the net force is zero everywhere
  // and the system holds no energy at all until the hand arrives.
  for (const force of springForces(network)) {
    assert.ok(Math.abs(force.x) < 1e-9 && Math.abs(force.y) < 1e-9);
  }
  assert.ok(totalEnergy(network) < 1e-12);
});

test("left alone, the pentagon does not move", () => {
  const network = createNetwork(OPTIONS);
  const opening = network.bobs.map((bob) => ({ x: bob.x, y: bob.y }));
  for (let stepIndex = 0; stepIndex < REST_STEPS; stepIndex += 1) {
    step(network, undefined);
  }
  network.bobs.forEach((bob, index) => {
    assert.ok(Math.abs(bob.x - opening[index].x) < 1e-6);
    assert.ok(Math.abs(bob.y - opening[index].y) < 1e-6);
  });
});

test("the stepper is fourth order: halving the step cuts the error thirty-two-fold", () => {
  // On dx/dt = -x the exact answer is known, so the local truncation error can be
  // measured directly. RK4's local error is O(dt^5): halve dt and it shrinks by 2^5.
  const decay = ([x]) => [-x];
  const errorWith = (dt) => Math.abs(integrateStep([1], dt, decay)[0] - Math.exp(-dt));
  const ratio = errorWith(0.1) / errorWith(0.05);
  assert.ok(Math.abs(ratio - 32) < 3, `error ratio ${ratio} is not the 32 of a fourth-order method`);
});

test("the scenario retraces itself exactly", () => {
  assert.deepEqual(networkAfter(TOTAL_STEPS, OPTIONS), networkAfter(TOTAL_STEPS, OPTIONS));
});

test("the pull injects the scenario's peak energy, and stores nearly all of it", () => {
  // The hand's last held step leaves the state the scenario is brightest in: the
  // pointer has just reached the target and has not yet let go.
  const held = networkAfter(RELEASE_STEP + 1, OPTIONS);
  assert.ok(held.bobs[0].dragging, "the hand had already let go");
  const atRelease = totalEnergy(held);
  assert.ok(atRelease > 1e5, `the pull injected only ${atRelease}`);
  assert.equal(scenarioEnergyPeak(OPTIONS), atRelease);

  // The pull is eased, so it arrives at a standstill: what the hand leaves behind is
  // strain in stretched springs, not motion. Over ninety-nine per cent of it.
  const shares = bobEnergies(held);
  const motion = shares.reduce((sum, share) => sum + share.kinetic, 0);
  assert.ok(motion / atRelease < 0.01, `the hand let go still moving (${motion / atRelease})`);
});

test("after the release the energy only ever falls", () => {
  let previous = null;
  foldScenario((network, stepIndex) => {
    if (stepIndex <= RELEASE_STEP + 1) {
      return;
    }
    const energy = totalEnergy(network);
    if (previous !== null) {
      assert.ok(energy <= previous * (1 + 1e-9), `energy rose at step ${stepIndex}`);
    }
    previous = energy;
  });
  assert.ok(previous !== null && previous > 0, "the fold never measured anything");
});

test("equal intervals take equal fractions: the one law uniform damping allows", () => {
  // Uniform viscous damping drains every mode at the same rate DAMPING over mass,
  // so the total energy of even this twenty-dimensional system falls on the single
  // exponential exp(-2 * DAMPING / BOB_MASS) per two seconds. Measured, not assumed.
  // The windows start a second after the release: the first one still carries the
  // transient of the letting-go, and holding that to the settled law would be
  // pinning the arithmetic to a moment the arithmetic does not yet describe.
  const samples = new Map();
  const seconds = [2, 4, 6];
  foldScenario((network, stepIndex) => {
    for (const second of seconds) {
      if (stepIndex === RELEASE_STEP + second * STEPS_PER_SECOND) {
        samples.set(second, totalEnergy(network));
      }
    }
  });
  const law = Math.exp(-2 * DAMPING / BOB_MASS);
  for (let index = 1; index < seconds.length; index += 1) {
    const ratio = samples.get(seconds[index]) / samples.get(seconds[index - 1]);
    assert.ok(Math.abs(ratio / law - 1) < 0.025, `window ${index} kept ${ratio}, not the law ${law}`);
  }
  // Two windows of the same law compound into its square, over four whole seconds.
  const across = samples.get(seconds.at(-1)) / samples.get(seconds[0]);
  assert.ok(Math.abs(across / law ** 2 - 1) < 0.025, `four seconds kept ${across}, not ${law ** 2}`);
});

test("the network settles under the drawing's rest threshold before the loop closes", () => {
  // The glow the sketch draws stands on a floor a thousandth of the scenario's peak.
  // Once every bob's share is under it the picture is the dark pentagon the clip
  // opened on, so the loop closes on an image rather than on a near miss — and the
  // damping was chosen to land there with time to spare, which is pinned here.
  const peak = scenarioEnergyPeak(OPTIONS);
  const floor = peak * 1e-3;
  const restingFrom = 280;
  for (let frame = restingFrom; frame <= TOTAL_STEPS / STEPS_PER_FRAME; frame += 1) {
    const shares = bobEnergies(networkAfter(frame * STEPS_PER_FRAME, OPTIONS));
    const brightest = Math.max(...shares.map((share) => share.total));
    assert.ok(brightest <= floor, `frame ${frame} still holds ${brightest}, over the floor ${floor}`);
  }
  // And it is not resting the whole way: the clip has something to show before then.
  const busy = bobEnergies(networkAfter((restingFrom - 40) * STEPS_PER_FRAME, OPTIONS));
  assert.ok(Math.max(...busy.map((share) => share.total)) > floor, "the ring was already dark");
});

test("by the end the trouble has died away, and nobody left the canvas", () => {
  let atRelease = null;
  foldScenario((network, stepIndex) => {
    if (stepIndex === RELEASE_STEP) {
      atRelease = totalEnergy(network);
    }
    for (const bob of network.bobs) {
      assert.ok(bob.x > 0 && bob.x < 680 && bob.y > 0 && bob.y < 680,
        `a bob left the canvas at step ${stepIndex}`);
    }
  });
  const settled = totalEnergy(networkAfter(TOTAL_STEPS, OPTIONS));
  assert.ok(settled < atRelease * 5e-3, `the network still holds ${settled / atRelease} of the pull`);
});

test("a kick from rest reaches the near stars first: the ring has a signal speed", () => {
  const network = createNetwork(OPTIONS);
  network.bobs[0].velocityY = 100;
  const kick = totalEnergy(network);
  const arrivals = [null, null, null, null, null];
  for (let stepIndex = 0; stepIndex < 300; stepIndex += 1) {
    step(network, undefined);
    bobEnergies(network).forEach((share, index) => {
      if (index > 0 && arrivals[index] === null && share.total > kick * 0.01) {
        arrivals[index] = stepIndex + 1;
      }
    });
  }
  assert.ok(arrivals.slice(1).every((arrival) => arrival !== null), "the kick never arrived");
  // The kick is symmetric, so the two neighbours hear it together, then the far pair.
  assert.equal(arrivals[1], arrivals[4]);
  assert.equal(arrivals[2], arrivals[3]);
  assert.ok(arrivals[1] < arrivals[2],
    `the far pair (${arrivals[2]}) did not lag the near pair (${arrivals[1]})`);
});

test("the release surge crosses the ring in order: the flower, its neighbours, the rest", () => {
  const kinetic = [];
  foldScenario((network) => {
    kinetic.push(network.bobs.map(
      (bob) => 0.5 * BOB_MASS * (bob.velocityX ** 2 + bob.velocityY ** 2)
    ));
  });
  const threshold = Math.max(...kinetic.flat()) * 0.02;
  const crossings = [0, 1, 2, 3, 4].map((bobIndex) => {
    for (let stepIndex = RELEASE_STEP + 1; stepIndex < TOTAL_STEPS; stepIndex += 1) {
      if (kinetic[stepIndex][bobIndex] > threshold) {
        return stepIndex - RELEASE_STEP;
      }
    }
    return null;
  });
  assert.ok(crossings.every((crossing) => crossing !== null), "the surge never crossed");
  assert.ok(crossings[0] < crossings[1], "the flower did not move first");
  assert.equal(crossings[1], crossings[4]);
  assert.equal(crossings[2], crossings[3]);
  assert.ok(crossings[1] < crossings[2],
    `the far pair (${crossings[2]}) did not lag the near pair (${crossings[1]})`);
});

test("pulled up its own axis, the ring answers in mirror image", () => {
  foldScenario((network, stepIndex) => {
    for (const [left, right] of [[1, 4], [2, 3]]) {
      const mirrorX = Math.abs(network.bobs[left].x - (2 * 340 - network.bobs[right].x));
      const mirrorY = Math.abs(network.bobs[left].y - network.bobs[right].y);
      assert.ok(mirrorX < 1e-9 && mirrorY < 1e-9, `the mirror broke at step ${stepIndex}`);
    }
  });
});

test("the five shares sum to the whole: the bookkeeping is an identity", () => {
  const busy = networkAfter(RELEASE_STEP + 30, OPTIONS);
  const whole = totalEnergy(busy);
  assert.ok(whole > 1e3, "the busy moment was not busy");
  const shares = bobEnergies(busy).reduce((sum, share) => sum + share.total, 0);
  assert.ok(Math.abs(shares - whole) < 1e-6 * whole);
});

test("the clip is a whole number of frames and ten seconds long", () => {
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 10);
});

test("the scenario holds, eases the bob out, then lets go for good", () => {
  const start = { x: 340, y: 230 };
  const target = OPTIONS.dragTarget;
  assert.deepEqual(scenarioPointer(0, start, target), start);
  assert.deepEqual(scenarioPointer(REST_STEPS, start, target), start);
  assert.deepEqual(scenarioPointer(RELEASE_STEP, start, target), target);
  assert.equal(scenarioPointer(RELEASE_STEP + 1, start, target), undefined);
  assert.equal(scenarioPointer(TOTAL_STEPS, start, target), undefined);
  // The pull eases: it rises through the middle and never wanders off the axis.
  const early = scenarioPointer(REST_STEPS + DRAG_STEPS / 3, start, target);
  const late = scenarioPointer(REST_STEPS + (2 * DRAG_STEPS) / 3, start, target);
  assert.equal(early.x, 340);
  assert.ok(start.y > early.y && early.y > late.y && late.y > target.y);
});

test("a press takes the nearest bob within reach, keeping the offset it was held by", () => {
  const network = createNetwork(OPTIONS);
  const bob = network.bobs[0];
  const pointer = { x: bob.x + GRAB_RADIUS * 0.5, y: bob.y };
  const grabbed = grab(network, pointer);
  assert.equal(grabbed, bob);
  assert.ok(Math.abs(bob.grabOffsetX + GRAB_RADIUS * 0.5) < 1e-9);

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
