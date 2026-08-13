import assert from "node:assert/strict";
import test from "node:test";
import {
  BREAKAWAY_WIND,
  CALM_STEPS,
  DECAY_STEPS,
  DT,
  GALE_WIND,
  GUST_INTERVAL,
  LULL_WIND,
  RELEASE_STEP,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  accelerationAt,
  advanceMill,
  captureWindAt,
  createMill,
  envelopeAt,
  equilibriumSpeed,
  gustTrack,
  integrateStep,
  millAfter
} from "../artworks/windmill/mill.js";
import {
  RUNG_COUNT,
  SAIL_COUNT,
  sailFrame,
  sailSegments,
  towerShape
} from "../artworks/windmill/silhouette.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const QUARTER_TURN = Math.PI / 2;

/**
 * The claims the artwork makes are physical, so they are tested the way the Lorenz
 * artwork's were: the stepper's order is measured, the equilibrium is found and the
 * simulation held to it, the breakaway threshold is exercised from both sides, and
 * the whole seeded afternoon of wind is retraced exactly.
 */

test("the gust track retraces its seed and answers a different seed differently", () => {
  const sample = (track) =>
    Array.from({ length: TOTAL_STEPS + 1 }, (unused, step) => track.speedAt(step));
  assert.deepEqual(sample(gustTrack(5027)), sample(gustTrack(5027)));
  assert.notDeepEqual(sample(gustTrack(5027)), sample(gustTrack(5028)));
});

test("gusts stay inside the wind's design range and really vary", () => {
  const track = gustTrack(5027);
  let lowest = Infinity;
  let highest = -Infinity;
  for (let step = 0; step <= TOTAL_STEPS; step += 0.25) {
    const wind = track.speedAt(step);
    assert.ok(wind >= LULL_WIND && wind <= GALE_WIND, `wind ${wind} left the range at ${step}`);
    lowest = Math.min(lowest, wind);
    highest = Math.max(highest, wind);
  }
  assert.ok(highest - lowest > 2, `the track barely varied (${highest - lowest})`);
});

test("gusts change smoothly, never faster than the interpolation allows", () => {
  const track = gustTrack(5027);
  // Smoothstep's steepest slope is 3/2, over the interval, times the widest swing.
  const steepest = 1.5 * (GALE_WIND - LULL_WIND) / GUST_INTERVAL;
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    const change = Math.abs(track.speedAt(step + 1) - track.speedAt(step));
    assert.ok(change <= steepest + 1e-12, `wind jumped ${change} at step ${step}`);
  }
});

test("the stepper is fourth order: halving the step cuts the error thirty-two-fold", () => {
  // On dx/dt = -x the exact answer is known, so the local truncation error can be
  // measured directly. RK4's local error is O(dt^5): halve dt and it shrinks by 2^5.
  const decay = ([x]) => [-x];
  const errorWith = (dt) => Math.abs(integrateStep([1], dt, decay)[0] - Math.exp(-dt));
  const ratio = errorWith(0.1) / errorWith(0.05);
  assert.ok(Math.abs(ratio - 32) < 3, `error ratio ${ratio} is not the 32 of a fourth-order method`);
});

test("under a steady gale the mill settles onto the measured torque balance", () => {
  const balance = equilibriumSpeed(GALE_WIND);
  assert.ok(Math.abs(accelerationAt(balance, GALE_WIND)) < 1e-12, "bisection missed the balance");
  const steady = millAfter(20 * STEPS_PER_SECOND, () => GALE_WIND);
  assert.ok(
    Math.abs(steady.speed - balance) < 1e-8,
    `the mill settled at ${steady.speed}, not the balance ${balance}`
  );
});

test("a wind below breakaway never stirs the mill; past it, the mill turns", () => {
  assert.ok(accelerationAt(0, BREAKAWAY_WIND * 0.999) < 0);
  assert.ok(accelerationAt(0, BREAKAWAY_WIND * 1.001) > 0);
  // The threshold is a real breeze, not a whisper: the giant sleeps through gentle air.
  assert.ok(BREAKAWAY_WIND > 2 && BREAKAWAY_WIND < 3);
  const becalmed = millAfter(TOTAL_STEPS, () => BREAKAWAY_WIND * 0.98);
  assert.equal(becalmed.speed, 0);
  assert.equal(becalmed.angle, 0);
  const stirred = millAfter(TOTAL_STEPS, () => BREAKAWAY_WIND * 1.05);
  assert.ok(stirred.speed > 0 && stirred.angle > 0);
});

test("the seeded afternoon retraces itself exactly", () => {
  assert.deepEqual(millAfter(TOTAL_STEPS), millAfter(TOTAL_STEPS));
});

test("the wheel never runs backwards and never beats the gale's own balance", () => {
  const ceiling = equilibriumSpeed(GALE_WIND);
  const mill = createMill();
  let previousAngle = 0;
  let previousTravel = 0;
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    advanceMill(mill, captureWindAt, step);
    assert.ok(mill.speed >= 0, `the mill ran backwards at step ${step}`);
    assert.ok(mill.speed <= ceiling, `the mill beat its own gale balance at step ${step}`);
    assert.ok(mill.angle >= previousAngle, `the angle retreated at step ${step}`);
    assert.ok(mill.windTravel >= previousTravel, `the wind blew backwards at step ${step}`);
    previousAngle = mill.angle;
    previousTravel = mill.windTravel;
  }
});

test("the clip is a whole number of frames and ten seconds long", () => {
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 10);
});

test("the scenario is calm at both doors and blowing in the middle", () => {
  assert.equal(captureWindAt(0), 0);
  assert.equal(captureWindAt(CALM_STEPS), 0);
  assert.equal(envelopeAt((CALM_STEPS + RELEASE_STEP) / 2), 1);
  assert.equal(envelopeAt(RELEASE_STEP + DECAY_STEPS), 0);
  assert.equal(captureWindAt(TOTAL_STEPS), 0);
});

test("the mill stops truly before the clip ends, and rests", () => {
  const ended = millAfter(TOTAL_STEPS);
  assert.equal(ended.speed, 0);
  const mill = createMill();
  let stopStep = null;
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    advanceMill(mill, captureWindAt, step);
    if (step + 1 > RELEASE_STEP && mill.speed === 0 && stopStep === null) {
      stopStep = step + 1;
    }
  }
  assert.ok(stopStep !== null && stopStep <= 545, `the mill was still turning at ${stopStep}`);
  // Once stopped it does not creep: the stiction that held it asleep holds it again.
  assert.equal(millAfter(stopStep).angle, ended.angle);
});

test("one afternoon of wind turns the mill onto its own quarter-turn symmetry", () => {
  // The seed was chosen for this closure: the clip ends within a third of a
  // milliradian of a whole number of quarter turns — a tenth of a pixel at the sail
  // tips — so the resting silhouette that closes the loop is the one that opened it.
  const ended = millAfter(TOTAL_STEPS);
  const residue = ((ended.angle % QUARTER_TURN) + QUARTER_TURN) % QUARTER_TURN;
  const closure = Math.min(residue, QUARTER_TURN - residue);
  assert.ok(closure < 5e-4, `the loop misses the symmetry by ${closure} radians`);
  assert.ok(ended.angle > QUARTER_TURN, "the mill never actually turned");
});

test("a sampled video frame turns less than the sails' quarter-turn symmetry", () => {
  const ceiling = equilibriumSpeed(GALE_WIND);
  assert.ok(ceiling * STEPS_PER_FRAME * DT < QUARTER_TURN / 2,
    "frames this far apart could read as stalling or running backwards");
});

test("four sails of ten members each, reaching exactly the sail length", () => {
  const length = 232;
  const sails = sailSegments(length);
  assert.equal(sails.length, SAIL_COUNT);
  for (const sail of sails) {
    assert.equal(sail.filter((segment) => segment.role === "spar").length, 1);
    assert.equal(sail.filter((segment) => segment.role === "stringer").length, 2);
    assert.equal(sail.filter((segment) => segment.role === "rung").length, RUNG_COUNT);
    const reach = Math.max(...sail.flatMap((s) => [Math.hypot(s.x1, s.y1), Math.hypot(s.x2, s.y2)]));
    assert.ok(Math.abs(reach - length) < 1e-9, `a sail reached ${reach}, not ${length}`);
  }
});

test("each sail is the previous one turned a quarter, which is what seals the loop", () => {
  const sails = sailSegments(232);
  const cosine = Math.cos(QUARTER_TURN);
  const sine = Math.sin(QUARTER_TURN);
  for (let sail = 0; sail < SAIL_COUNT; sail += 1) {
    const next = sails[(sail + 1) % SAIL_COUNT];
    sails[sail].forEach((segment, index) => {
      for (const end of ["1", "2"]) {
        const x = segment[`x${end}`] * cosine - segment[`y${end}`] * sine;
        const y = segment[`x${end}`] * sine + segment[`y${end}`] * cosine;
        assert.ok(Math.abs(x - next[index][`x${end}`]) < 1e-9);
        assert.ok(Math.abs(y - next[index][`y${end}`]) < 1e-9);
      }
    });
  }
});

test("the tower stands symmetric about the hub and wider at the foot", () => {
  const tower = towerShape({
    hubX: 340, crownY: 278, baseY: 620, crownWidth: 52, baseWidth: 98, capOverhang: 9, capHeight: 42
  });
  for (const shape of [tower.body, tower.cap]) {
    for (const point of shape) {
      const mirrored = shape.some(
        (other) => Math.abs(other.x - (2 * 340 - point.x)) < 1e-9 && Math.abs(other.y - point.y) < 1e-9
      );
      assert.ok(mirrored, `no mirror for ${point.x}, ${point.y}`);
    }
  }
  const crown = Math.abs(tower.body[0].x - tower.body[1].x);
  const base = Math.abs(tower.body[2].x - tower.body[3].x);
  assert.ok(base > crown, "the tower does not stand wider at the foot");
  assert.ok(tower.cap[2].y < tower.body[0].y, "the cap does not rise above the crown");
});

test("the sail frame keeps its lattice beside the spar, not across it", () => {
  const frame = sailFrame(232);
  for (const segment of frame) {
    assert.ok(segment.y1 >= 0 && segment.y2 >= 0, "the lattice crossed the spar");
  }
});
