import assert from "node:assert/strict";
import test from "node:test";
import {
  CORNERS,
  DEPTH_SWAP,
  EDGES,
  FACES,
  PLAN,
  READINGS,
  REST_TURNS,
  ROCK_TURNS,
  STEPS_PER_SECOND,
  TILT,
  TOTAL_STEPS,
  declarationAt,
  frontFace,
  mirrorDepth,
  orient,
  otherReading,
  project,
  sceneAt,
  shadowAt,
  turnsAt
} from "../artworks/necker-cube/cube.js";

const PLAYBACK_FPS = 30;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const HALF = 100;

/** The area a face covers on the wall; zero would mean the figure had collapsed. */
function projectedArea(corners, face) {
  let sum = 0;
  for (let index = 0; index < face.length; index += 1) {
    const from = corners[face[index]];
    const to = corners[face[(index + 1) % face.length]];
    sum += from.x * to.y - to.x * from.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * The artwork's claim is that the drawing cannot be asked which way the cube is turned,
 * because two different worlds cast exactly this shadow. That is not a resemblance to be
 * admired, it is an identity to be checked, and these tests check it: the mirrored world
 * projects to the same eight points, bit for bit, and the only thing the two readings
 * disagree about is which face is nearest — which is the only thing the drawing ever
 * shows when it declares one.
 */

test("the other world casts exactly this shadow, corner for corner", () => {
  // Reflecting depth turns the rotation into its opposite and the lean towards the eye
  // into a lean away, and carries each corner to the one behind it. The shadow does not
  // notice any of it.
  for (const step of [0, 37, 111, 150, 288, 401, 599]) {
    const turns = turnsAt(step);
    const here = shadowAt(turns, HALF, TILT);
    const other = otherReading(turns, TILT);
    const there = shadowAt(other.turns, HALF, other.tilt);
    here.forEach((point, index) => {
      // Strict equality, not a tolerance: these are the same numbers.
      assert.equal(point.x, there[DEPTH_SWAP[index]].x);
      assert.equal(point.y, there[DEPTH_SWAP[index]].y);
    });
  }
});

test("throwing depth away is what makes the two indistinguishable", () => {
  for (const step of [0, 90, 210, 450]) {
    const scene = sceneAt(turnsAt(step), HALF);
    const mirrored = mirrorDepth(scene);
    // The mirrored world is a different world — its depths are the negatives.
    scene.forEach((point, index) => {
      assert.equal(mirrored[index].z, -point.z);
    });
    // And the projection cannot tell, because it never looked at depth.
    assert.deepEqual(scene.map(project), mirrored.map(project));
  }
});

test("the two readings disagree about the near face, and never agree", () => {
  let disagreements = 0;
  for (let step = 0; step <= TOTAL_STEPS; step += 1) {
    const turns = turnsAt(step);
    const first = frontFace(turns, READINGS[0], HALF);
    const second = frontFace(turns, READINGS[1], HALF);
    assert.notEqual(first, second, `the readings agreed at step ${step}`);
    disagreements += 1;
  }
  assert.equal(disagreements, TOTAL_STEPS + 1);
});

test("the wireframe owes nothing to the reading", () => {
  // The shadow is a function of how far round the cube stands, and of nothing else.
  // There is no reading to pass it, which is why a declaration cannot quietly redraw
  // the figure it claims only to be interpreting.
  for (const step of [12, 200, 480]) {
    const turns = turnsAt(step);
    assert.deepEqual(shadowAt(turns, HALF), shadowAt(turns, HALF));
    // Both readings are available at the same instant, over one unchanged drawing.
    const face = FACES[frontFace(turns, 1, HALF)];
    const other = FACES[frontFace(turns, -1, HALF)];
    assert.notDeepEqual(face, other);
  }
});

test("the figure never flattens: it is a Necker cube at every frame", () => {
  // A whole turn would pass four times through a face-on view, where four faces project
  // to lines and there is no near corner to read either way. The rock stays clear of
  // those, and the smallest face on the wall keeps better than a third of a full one.
  const fullFace = (2 * HALF) ** 2;
  let smallest = Infinity;
  for (let step = 0; step <= TOTAL_STEPS; step += 1) {
    const corners = shadowAt(turnsAt(step), HALF);
    for (const face of FACES) {
      smallest = Math.min(smallest, projectedArea(corners, face));
    }
  }
  assert.ok(smallest > 0.3 * fullFace, `a face shrank to ${smallest / fullFace} of itself`);
  // The rock stays away from the face-on angles, which are the quarter turns.
  for (const degenerate of [0, 0.25]) {
    assert.ok(Math.abs(REST_TURNS - degenerate) - ROCK_TURNS > 0.05);
  }
});

test("the rock closes exactly, and the declarations close with it", () => {
  assert.equal(turnsAt(TOTAL_STEPS), turnsAt(0));
  assert.equal(turnsAt(TOTAL_STEPS), REST_TURNS);
  assert.deepEqual(shadowAt(turnsAt(TOTAL_STEPS), HALF), shadowAt(turnsAt(0), HALF));
  assert.deepEqual(declarationAt(TOTAL_STEPS), declarationAt(0));
  // And the cube really moves in between, rather than sitting at its rest.
  const travelled = Math.abs(turnsAt(TOTAL_STEPS / 4) - REST_TURNS);
  assert.ok(Math.abs(travelled - ROCK_TURNS) < 1e-12);
});

test("each reading is declared once, and the clip opens and closes undeclared", () => {
  assert.equal(PLAN.reduce((sum, phase) => sum + phase.steps, 0), TOTAL_STEPS);
  assert.equal(declarationAt(0).reading, 0);
  assert.equal(declarationAt(TOTAL_STEPS - 1).reading, 0);

  const declared = new Map();
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    const declaration = declarationAt(step);
    assert.ok(declaration.amount >= 0 && declaration.amount <= 1);
    if (declaration.reading !== 0) {
      declared.set(
        declaration.reading,
        Math.max(declared.get(declaration.reading) ?? 0, declaration.amount)
      );
    }
  }
  // Both readings get their turn, and each is stated fully before it is let go of.
  assert.deepEqual([...declared.keys()].sort(), [-1, 1]);
  for (const peak of declared.values()) {
    assert.ok(peak > 0.99, `a reading was only declared to ${peak}`);
  }
});

test("it is a cube: eight corners, twelve edges, six faces that agree with each other", () => {
  assert.equal(CORNERS.length, 8);
  assert.equal(EDGES.length, 12);
  assert.equal(FACES.length, 6);
  // Every corner is a corner of exactly three faces and three edges.
  for (let corner = 0; corner < CORNERS.length; corner += 1) {
    assert.equal(FACES.filter((face) => face.includes(corner)).length, 3);
    assert.equal(EDGES.filter((edge) => edge.includes(corner)).length, 3);
  }
  // Every edge is shared by exactly two faces, which is what closes a solid.
  for (const [from, to] of EDGES) {
    const sharing = FACES.filter((face) => face.includes(from) && face.includes(to));
    assert.equal(sharing.length, 2, `the edge ${from}-${to} is not shared by two faces`);
  }
  // And every edge is the same length in space, whatever the cube is doing.
  const scene = sceneAt(turnsAt(77), HALF);
  const lengths = EDGES.map(([from, to]) =>
    Math.hypot(scene[from].x - scene[to].x, scene[from].y - scene[to].y, scene[from].z - scene[to].z));
  for (const length of lengths) {
    assert.ok(Math.abs(length - 2 * HALF) < 1e-9, `an edge measured ${length}`);
  }
});

test("the swap is its own undoing, as a reflection must be", () => {
  DEPTH_SWAP.forEach((swapped, index) => {
    assert.equal(DEPTH_SWAP[swapped], index);
    // The corner it names is the one directly behind: same x and y in the cube's own
    // frame, opposite z.
    assert.equal(CORNERS[swapped].x, CORNERS[index].x);
    assert.equal(CORNERS[swapped].y, CORNERS[index].y);
    assert.equal(CORNERS[swapped].z, -CORNERS[index].z);
  });
  const twice = otherReading(otherReading(0.3, TILT).turns, otherReading(0.3, TILT).tilt);
  assert.equal(twice.turns, 0.3);
  assert.equal(twice.tilt, TILT);
});

test("the clip is a whole number of frames and ten seconds long", () => {
  assert.equal(TOTAL_STEPS % STEPS_PER_FRAME, 0);
  assert.equal(TOTAL_STEPS / STEPS_PER_FRAME, 300);
  assert.equal(TOTAL_STEPS / STEPS_PER_SECOND, 10);
  // A corner drawn at the origin's own scale is where the module says it is.
  assert.deepEqual(orient(CORNERS[0], 0, 1, 0), { x: -1, y: -1, z: -1 });
});
