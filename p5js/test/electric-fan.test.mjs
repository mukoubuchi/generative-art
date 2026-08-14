import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCELERATION,
  BLADE_COUNT,
  CALM_STEPS,
  DRIVEN_STEPS,
  HOLD_STEPS,
  QUARTER_TURNS,
  REST_STEP,
  SPIN_UP_STEPS,
  STEPS_PER_SECOND,
  TOP_SPEED,
  TOTAL_STEPS,
  advanceFan,
  advanceSpeed,
  angleAt,
  bladeTriangles,
  createFan,
  heldAt,
  speedAt
} from "../artworks/electric-fan/motor.js";

/**
 * The mill next to this one is not commanded: the wind pushes, the friction resists, and
 * where it settles is where they agree. This one is commanded, and these tests are about
 * what being commanded looks like as numbers. The speed climbs in a straight line, stops
 * climbing at a ceiling however long the key is held, spends exactly as long falling as it
 * spent climbing, and reaches nothing rather than approaching it.
 *
 * The clip's closed forms and the law the page runs are two ways of saying one thing, so
 * the first test holds them to each other. Everything after that is asked of the law.
 */

const QUARTER_TURN = Math.PI / 2;
const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;

/** The law, walked: the same fold the page performs, step by step, over the scenario. */
function walkScenario(steps = TOTAL_STEPS) {
  let speed = 0;
  let angle = 0;
  const speeds = [0];
  const angles = [0];
  for (let step = 0; step < steps; step += 1) {
    speed = advanceSpeed(speed, heldAt(step));
    angle += speed;
    speeds.push(speed);
    angles.push(angle);
  }
  return { speeds, angles };
}

test("the closed forms are the law walked, step for step", () => {
  // The clip reads its frames straight out of `angleAt`, so nothing would notice if the
  // two drifted -- the page would run one machine and the export would show another.
  const walked = walkScenario();
  assert.equal(walked.speeds.length, TOTAL_STEPS + 1);
  for (let step = 0; step <= TOTAL_STEPS; step += 1) {
    assert.ok(
      Math.abs(speedAt(step) - walked.speeds[step]) < 1e-12,
      `speed disagrees at step ${step}: ${speedAt(step)} against ${walked.speeds[step]}`
    );
    assert.ok(
      Math.abs(angleAt(step) - walked.angles[step]) < 1e-9,
      `travel disagrees at step ${step}: ${angleAt(step)} against ${walked.angles[step]}`
    );
  }
  // And a fan the reader is driving is the same law again, with the scenario for a hand.
  const fan = createFan();
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    advanceFan(fan, heldAt(step));
  }
  assert.ok(Math.abs(fan.angle - angleAt(TOTAL_STEPS)) < 1e-9);
  assert.equal(fan.speed, walked.speeds.at(-1));
});

test("the climb is a straight line, and the ceiling is a ceiling", () => {
  // Every step of the climb adds the same speed. Nothing eases; a motor does not ease.
  for (let step = CALM_STEPS + 1; step <= CALM_STEPS + SPIN_UP_STEPS; step += 1) {
    const gain = speedAt(step) - speedAt(step - 1);
    assert.ok(Math.abs(gain - ACCELERATION) < 1e-15, `step ${step} gained ${gain}`);
  }
  assert.ok(Math.abs(speedAt(CALM_STEPS + SPIN_UP_STEPS) - TOP_SPEED) < 1e-15);
  // Held for a hundred times the clip, it is still the ceiling and not a hair over.
  let speed = 0;
  for (let step = 0; step < 60_000; step += 1) {
    speed = advanceSpeed(speed, true);
  }
  assert.equal(speed, TOP_SPEED, "the drive climbed past its own ceiling");
  // The Processing sketch's ceiling was 0.3 radians a step, and this is that within a
  // twentieth of one per cent -- the whole price of closing the loop exactly.
  assert.ok(
    Math.abs(TOP_SPEED - 0.3) / 0.3 < 0.0005,
    `the ceiling is ${TOP_SPEED} radians a step`
  );
  // Which is a little under three turns a second, as it was.
  const turnsPerSecond = (TOP_SPEED * STEPS_PER_SECOND) / (2 * Math.PI);
  assert.ok(turnsPerSecond > 2.8 && turnsPerSecond < 2.9, `${turnsPerSecond} turns a second`);
});

test("it comes down in exactly the time it went up, and then stops", () => {
  // Symmetry is not a decision here; the drive takes away what it adds.
  let speed = 0;
  let climbing = 0;
  while (speed < TOP_SPEED) {
    speed = advanceSpeed(speed, true);
    climbing += 1;
  }
  let falling = 0;
  while (speed > 0) {
    speed = advanceSpeed(speed, false);
    falling += 1;
  }
  assert.equal(climbing, SPIN_UP_STEPS);
  assert.equal(falling, SPIN_UP_STEPS);
  // Rest is reached, not approached: the speed is zero on the nose at a named step, and
  // the fan does not creep afterwards.
  assert.equal(speedAt(REST_STEP), 0);
  assert.ok(speedAt(REST_STEP - 1) > 0, "the fan was already stopped a step earlier");
  const settled = angleAt(REST_STEP);
  for (let step = REST_STEP; step <= TOTAL_STEPS; step += 1) {
    assert.equal(speedAt(step), 0, `the fan is still turning at step ${step}`);
    assert.equal(angleAt(step), settled, `the fan crept at step ${step}`);
  }
});

test("the ramps are free: the clip travels the ceiling times the time the key was down", () => {
  // Whatever the climb loses against the ceiling, the fall gives back. So the whole
  // travel is as if the fan had run at the ceiling for exactly as long as the key was
  // held -- which is the identity the clip's closure is built on.
  const up = angleAt(CALM_STEPS + SPIN_UP_STEPS);
  const down = angleAt(REST_STEP) - angleAt(CALM_STEPS + DRIVEN_STEPS);
  assert.ok(
    Math.abs(up + down - TOP_SPEED * SPIN_UP_STEPS) < 1e-9,
    `the two ramps travelled ${up + down} against ${TOP_SPEED * SPIN_UP_STEPS}`
  );
  assert.ok(Math.abs(angleAt(TOTAL_STEPS) - TOP_SPEED * DRIVEN_STEPS) < 1e-9);
  // The climb alone is not symmetric with the fall -- it is half a step's worth ahead,
  // because the speed rises before the travel is added. The pair is what is symmetric.
  assert.ok(Math.abs(up - down - TOP_SPEED) < 1e-9, `the ramps differ by ${up - down}`);
});

test("the loop closes on the blades' own quarter turn", () => {
  const travelled = angleAt(TOTAL_STEPS);
  assert.ok(
    Math.abs(travelled - QUARTER_TURNS * QUARTER_TURN) < 1e-12,
    `the clip turned ${travelled} against ${QUARTER_TURNS * QUARTER_TURN}`
  );
  // Which is what the last frame handing back to the first means, given four blades: the
  // residue against a quarter turn is a hundred-millionth of the mill's own third of a
  // milliradian, and the blade tips stand where they started to well under a pixel.
  const residue = travelled % QUARTER_TURN;
  const closure = Math.min(residue, QUARTER_TURN - residue);
  assert.ok(closure < 1e-12, `the loop misses closing by ${closure} radians`);
  // The clip is a whole number of frames, and ten seconds of them.
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 10);
  // The scenario fills the clip exactly: still, up, held, down, still.
  assert.ok(CALM_STEPS > 0 && REST_STEP < TOTAL_STEPS, "the clip has no rest at one end");
  assert.equal(DRIVEN_STEPS, SPIN_UP_STEPS + HOLD_STEPS);
});

test("the key is what drives it, and only while it is down", () => {
  // Nothing turns before the key goes down or after it comes up: the fan has no weather.
  for (let step = 0; step < CALM_STEPS; step += 1) {
    assert.equal(heldAt(step), false);
    assert.equal(speedAt(step), 0);
    assert.equal(angleAt(step), 0);
  }
  for (let step = CALM_STEPS; step < CALM_STEPS + DRIVEN_STEPS; step += 1) {
    assert.equal(heldAt(step), true, `the key is not down at step ${step}`);
  }
  for (let step = CALM_STEPS + DRIVEN_STEPS; step < TOTAL_STEPS; step += 1) {
    assert.equal(heldAt(step), false, `the key is still down at step ${step}`);
  }
  // A tap does not run the fan away: let go and it gives the step straight back.
  const fan = createFan();
  advanceFan(fan, true);
  assert.ok(fan.speed > 0);
  advanceFan(fan, false);
  assert.equal(fan.speed, 0);
});

test("four blades, each the one before it turned a quarter, and pitched", () => {
  const radius = 272;
  const triangles = bladeTriangles(radius);
  assert.equal(triangles.length, BLADE_COUNT);
  for (const blade of triangles) {
    assert.equal(blade.length, 3);
    assert.deepEqual(blade[0], { x: 0, y: 0 }, "a blade does not start at the hub");
    // Pitch: one vertex at the full reach, the other short of it by root two. Without
    // that difference the four would be a windmill's plain cross rather than a rotor
    // that throws air.
    assert.ok(Math.abs(Math.hypot(blade[1].x, blade[1].y) - radius) < 1e-9);
    assert.ok(Math.abs(Math.hypot(blade[2].x, blade[2].y) - radius / Math.SQRT2) < 1e-9);
  }
  // Turning one blade a quarter gives the next, which is the symmetry the loop closes on.
  const turned = ({ x, y }) => ({ x: -y, y: x });
  for (let index = 0; index < BLADE_COUNT; index += 1) {
    const next = triangles[(index + 1) % BLADE_COUNT];
    triangles[index].forEach((corner, place) => {
      const expected = turned(corner);
      assert.ok(Math.abs(next[place].x - expected.x) < 1e-9, `blade ${index} corner ${place} x`);
      assert.ok(Math.abs(next[place].y - expected.y) < 1e-9, `blade ${index} corner ${place} y`);
    });
  }
});
