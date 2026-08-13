import assert from "node:assert/strict";
import test from "node:test";
import {
  DISC_COUNT,
  EYE_DISTANCE,
  RING_TILT,
  STEPS_PER_SECOND,
  TURN_STEPS,
  discDepth,
  discPlace,
  frontDisc,
  handoverTurns,
  paintingOrder,
  ringAngle
} from "../artworks/toggle-color-ball/carousel.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const RING_RADIUS = 680 * (175 / 600);

/**
 * The Processing sketch kept a table of which disc came forward in each quarter, and a
 * table is a claim that cannot be wrong. These tests are about there being no table:
 * the front is whichever disc is nearest, the handover is wherever two of them are
 * equally near, and the alternation of kinds — the artwork's line from the Book of
 * Changes — is a consequence of how they sit on the ring. Every number below is found
 * by asking the ring, not by being told.
 */

test("the handover is found rather than declared, at an eighth past each quarter", () => {
  // handoverTurns walks the turn, notices where the nearest disc stops being the same
  // disc, and bisects. It is not told where to look.
  const handovers = handoverTurns();
  assert.equal(handovers.length, DISC_COUNT);
  handovers.forEach((turns, index) => {
    const expected = 0.125 + index * 0.25;
    assert.ok(Math.abs(turns - expected) < 1e-12, `handover ${index} landed at ${turns}`);
  });
  // Which is forty-five degrees past each quarter of the ring, and a whole number of
  // simulation steps, so no frame of the clip straddles a handover.
  for (const turns of handovers) {
    assert.ok(Math.abs(turns * 360 - Math.round(turns * 360)) < 1e-9);
    assert.ok(Math.abs(turns * TURN_STEPS - Math.round(turns * TURN_STEPS)) < 1e-9);
  }
});

test("a handover is exactly a tie in depth between neighbours on the ring", () => {
  for (const turns of handoverTurns()) {
    const before = frontDisc(turns - 1e-9);
    const after = frontDisc(turns + 1e-9);
    assert.notEqual(before, after, "nothing actually changed hands");
    // The two are neighbours — a disc can only be overtaken by the one beside it.
    const apart = Math.abs(before - after) % DISC_COUNT;
    assert.ok(apart === 1 || apart === DISC_COUNT - 1, `${before} and ${after} are not neighbours`);
    // And at that instant they are the same distance away, which is the whole reason
    // the front changes: not a rule, a tie.
    assert.ok(Math.abs(discDepth(before, turns) - discDepth(after, turns)) < 1e-12);
  }
});

test("between handovers the front never changes, and each disc takes one turn", () => {
  const handovers = handoverTurns();
  const fronts = [];
  for (let index = 0; index < handovers.length; index += 1) {
    const from = handovers[index];
    const to = index + 1 < handovers.length ? handovers[index + 1] : handovers[0] + 1;
    const holder = frontDisc((from + to) / 2);
    for (let sample = 1; sample < 40; sample += 1) {
      const turns = from + (to - from) * (sample / 40);
      assert.equal(frontDisc(turns % 1), holder, `the front flickered inside a quarter`);
    }
    fronts.push(holder);
  }
  // Every disc comes forward exactly once per revolution.
  assert.deepEqual([...fronts].sort(), [0, 1, 2, 3]);
});

test("one yin, one yang: the kinds alternate because the ring alternates", () => {
  // The discs are laid out alternately around the ring, and a disc can only be
  // overtaken by its neighbour, so whatever comes forward is the opposite kind to what
  // came forward before it. Nothing in the sketch enforces this.
  const fronts = handoverTurns().map((turns) => frontDisc(turns + 1e-9));
  for (let index = 0; index < fronts.length; index += 1) {
    const next = fronts[(index + 1) % fronts.length];
    assert.notEqual(fronts[index] % 2, next % 2, "two of a kind came forward in a row");
  }
});

test("the painting order is the depth order, back to front", () => {
  for (let sample = 0; sample < 50; sample += 1) {
    const turns = sample / 50;
    const order = paintingOrder(turns);
    assert.deepEqual([...order].sort(), [0, 1, 2, 3], "a disc went missing");
    for (let place = 1; place < order.length; place += 1) {
      assert.ok(
        discDepth(order[place - 1], turns) <= discDepth(order[place], turns),
        "the order is not sorted by depth"
      );
    }
    // The last one painted is the one in front, which is what the front means.
    assert.equal(order.at(-1), frontDisc(turns));
  }
});

test("distance is drawn as well as sorted: nearer discs are larger", () => {
  let smallest = Infinity;
  let largest = 0;
  for (let sample = 0; sample <= 200; sample += 1) {
    const turns = sample / 200;
    const near = discPlace(frontDisc(turns), turns, RING_RADIUS);
    const far = discPlace(paintingOrder(turns)[0], turns, RING_RADIUS);
    assert.ok(near.scale > far.scale, "the nearest disc is not drawn largest");
    // Nearer is also lower on the canvas, as it is looking down at a turning thing.
    assert.ok(near.y > far.y, "the nearest disc is not the lowest");
    smallest = Math.min(smallest, far.scale);
    largest = Math.max(largest, near.scale);
  }
  // Measured, not chosen: the eye distance decides this, and it comes to about three
  // halves across the turn.
  assert.ok(Math.abs(largest - EYE_DISTANCE / (EYE_DISTANCE - Math.cos(RING_TILT))) < 1e-9);
  assert.ok(Math.abs(largest / smallest - 1.58) < 0.01, `size ratio was ${largest / smallest}`);
});

test("the ring closes: a whole turn puts every disc back where it started", () => {
  for (let index = 0; index < DISC_COUNT; index += 1) {
    const start = discPlace(index, 0, RING_RADIUS);
    const end = discPlace(index, 1, RING_RADIUS);
    assert.ok(Math.abs(end.x - start.x) < 1e-9);
    assert.ok(Math.abs(end.y - start.y) < 1e-9);
    assert.ok(Math.abs(end.scale - start.scale) < 1e-9);
    // And a disc is a quarter of the ring behind the one before it, always.
    const behind = ringAngle(index, 0) - ringAngle(index - 1, 0);
    assert.ok(Math.abs(behind - Math.PI / 2) < 1e-12);
  }
});

test("the clip is a whole number of frames and ten seconds long", () => {
  assert.equal(TURN_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TURN_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TURN_STEPS / STEPS_PER_SECOND, 10);
});

test("the discs really move: the ring is not standing still", () => {
  const travelled = Math.hypot(
    discPlace(0, 0.25, RING_RADIUS).x - discPlace(0, 0, RING_RADIUS).x,
    discPlace(0, 0.25, RING_RADIUS).y - discPlace(0, 0, RING_RADIUS).y
  );
  assert.ok(travelled > RING_RADIUS, `a quarter turn moved a disc only ${travelled}`);
  // Over a turn a disc swings the ring's whole depth, from as far behind the centre as
  // it ever comes in front of it — the lean is all that shortens it.
  const depths = Array.from({ length: 401 }, (unused, sample) => discDepth(0, sample / 400));
  assert.ok(Math.abs(Math.max(...depths) - Math.cos(RING_TILT)) < 1e-9);
  assert.ok(Math.abs(Math.min(...depths) + Math.cos(RING_TILT)) < 1e-9);
});
