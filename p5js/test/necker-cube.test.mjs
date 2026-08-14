import assert from "node:assert/strict";
import test from "node:test";
import {
  BREAK_SHARE,
  CORNERS,
  DEPTH_SWAP,
  EDGES,
  FACES,
  PLAN,
  READINGS,
  STEPS_PER_SECOND,
  TILT,
  TOTAL_STEPS,
  VIEW_TURNS,
  declarationAt,
  farCorner,
  frontFace,
  hiddenEdges,
  isHold,
  mirrorDepth,
  orient,
  otherReading,
  project,
  sceneAt,
  shadowAt
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
    const turns = VIEW_TURNS + step / 10_000;
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
    const scene = sceneAt(VIEW_TURNS + step / 10_000, HALF);
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
    const turns = VIEW_TURNS + step / 10_000;
    const first = frontFace(READINGS[0], turns, HALF);
    const second = frontFace(READINGS[1], turns, HALF);
    assert.notEqual(first, second, `the readings agreed at step ${step}`);
    disagreements += 1;
  }
  assert.equal(disagreements, TOTAL_STEPS + 1);
});

test("the wireframe owes nothing to the reading", () => {
  // The shadow is a function of how far round the cube stands, and of nothing else.
  // There is no reading to pass it, which is why a declaration cannot quietly redraw
  // the figure it claims only to be interpreting.
  for (const turns of [VIEW_TURNS, 0.09, 0.2]) {
    assert.deepEqual(shadowAt(turns, HALF), shadowAt(turns, HALF));
    // Both readings are available at the same instant, over one unchanged drawing.
    const face = FACES[frontFace(1, turns, HALF)];
    const other = FACES[frontFace(-1, turns, HALF)];
    assert.notDeepEqual(face, other);
  }
});

test("the figure never moves, and the two readings are equally easy to take", () => {
  // Rocking the cube, or letting a reader turn it, hands the drawing a depth cue it is
  // not entitled to: parallax says at once which corner is nearer, and there is nothing
  // left to reverse. So the corners are one drawing for the whole clip.
  const corners = shadowAt(VIEW_TURNS, HALF);
  for (const step of [0, 137, TOTAL_STEPS - 1, TOTAL_STEPS]) {
    assert.deepEqual(shadowAt(VIEW_TURNS, HALF), corners, `the figure moved by step ${step}`);
  }
  // And it stands where neither reading is the easier one: the shadow is symmetric about
  // both axes, and the two interior corners fall symmetrically about the centre, so the
  // figure carries no hint of which corner is meant to be in front.
  const flipped = corners.map(({ x, y }) => ({ x: -x, y: -y }));
  const key = (point) => `${point.x.toFixed(9)},${point.y.toFixed(9)}`;
  assert.deepEqual(corners.map(key).sort(), flipped.map(key).sort());
});

test("a declaration interrupts the three lines a cube of wood would hide", () => {
  // The far corner is the one the reading likes least, and a convex body hides exactly
  // the edges that meet it. That is the only thing the two readings disagree about that
  // a drawing can show, so it is the only thing the drawing does.
  const seen = new Set();
  for (const reading of READINGS) {
    const far = farCorner(reading, VIEW_TURNS, HALF);
    const hidden = hiddenEdges(reading, VIEW_TURNS, HALF);
    assert.equal(hidden.length, 3, `reading ${reading} hides ${hidden.length} edges`);
    for (const index of hidden) {
      assert.ok(EDGES[index].includes(far), "an interrupted line does not meet the far corner");
    }
    // Every other edge has a face of its own turned towards the eye, which is why three
    // is the whole answer and no hidden-line machinery is needed.
    assert.equal(EDGES.filter((edge) => edge.includes(far)).length, 3);
    // The reading that hides these is the reading whose front face this is: the two
    // statements are about the same choice, and they must not be able to disagree.
    const scene = sceneAt(VIEW_TURNS, HALF);
    const front = FACES[frontFace(reading, VIEW_TURNS, HALF)];
    assert.ok(!front.includes(far), "the face declared nearest contains the corner declared furthest");
    assert.ok(
      front.every((corner) => reading * scene[corner].z > reading * scene[far].z),
      "the front face is not in front of the far corner"
    );
    seen.add(hidden.join(","));
  }
  // And the two readings never interrupt the same lines, or there would be nothing to see.
  assert.equal(seen.size, 2);
  const [first, second] = READINGS.map((reading) => hiddenEdges(reading, VIEW_TURNS, HALF));
  assert.deepEqual(first.filter((index) => second.includes(index)), []);
  // The far corners are opposite corners of the cube, as the near and far of a cube are.
  const a = CORNERS[farCorner(1, VIEW_TURNS, HALF)];
  const b = CORNERS[farCorner(-1, VIEW_TURNS, HALF)];
  assert.deepEqual([a.x + b.x, a.y + b.y, a.z + b.z], [0, 0, 0]);
});

test("nothing is interrupted while the figure is ambiguous", () => {
  // The clip opens and closes with all twelve lines whole, and every step that declares
  // nothing draws them whole. A break that lingered would be a reading nobody made.
  let ambiguous = 0;
  let broken = 0;
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    const declaration = declarationAt(step);
    const share = BREAK_SHARE * declaration.amount;
    if (declaration.reading === 0) {
      ambiguous += 1;
      assert.equal(share, 0, `step ${step} interrupts a line while declaring nothing`);
    } else if (share > 0) {
      broken += 1;
    }
  }
  // The scan is scanning: the clip really has stretches of both.
  assert.ok(ambiguous > 90, `only ${ambiguous} steps are ambiguous`);
  assert.ok(broken > 90, `only ${broken} steps interrupt anything`);
  assert.ok(BREAK_SHARE > 0 && BREAK_SHARE < 1, "a whole line rubbed out is not an interruption");
});

/** Two figures are the same figure when the same lines stop in the same places. */
function deepEquals(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

test("a held state is held: every step of it draws the identical figure", () => {
  // The reason the clip has holds at all. A Necker cube reverses in the person looking at
  // it, and that only starts on a figure standing still; the interruption used to ramp
  // across the whole of a reading, so three line-ends were creeping at every step and a
  // first-time reader saw moving lines rather than an ambiguous cube. What is measured
  // here is not that the plan says "hold" but that nothing a hold hands the drawing ever
  // changes inside it -- the reading, the amount, the three edges, and where they stop.
  let start = 0;
  let heldSteps = 0;
  for (const phase of PLAN) {
    if (isHold(phase)) {
      const opening = declarationAt(start);
      const edges = opening.reading === 0 ? [] : hiddenEdges(opening.reading, VIEW_TURNS, HALF);
      for (let step = start; step < start + phase.steps; step += 1) {
        const declaration = declarationAt(step);
        assert.deepEqual(declaration, opening, `the hold at ${start} moved at step ${step}`);
        assert.deepEqual(
          declaration.reading === 0 ? [] : hiddenEdges(declaration.reading, VIEW_TURNS, HALF),
          edges
        );
        heldSteps += 1;
      }
    }
    start += phase.steps;
  }
  assert.equal(start, TOTAL_STEPS);
  // And the holds are most of the clip, with the ambiguous state taking the largest share
  // of them, because that is the state the reversal happens in.
  const ambiguousSteps = PLAN
    .filter((phase) => isHold(phase) && phase.reading === 0)
    .reduce((sum, phase) => sum + phase.steps, 0);
  assert.ok(heldSteps / TOTAL_STEPS > 0.75, `only ${heldSteps} of ${TOTAL_STEPS} steps are still`);
  assert.ok(ambiguousSteps > heldSteps - ambiguousSteps, "the declared states are held longer");
});

test("the figure only ever changes inside a transition, and the seam is not one", () => {
  // The complement of the claim above: every step at which the drawing differs from the
  // step before it falls inside one of the four windows the plan declares, so there is no
  // creep anywhere else. The windows are read off the plan rather than written down here.
  const windows = [];
  let start = 0;
  for (const phase of PLAN) {
    if (!isHold(phase)) {
      windows.push([start, start + phase.steps]);
    }
    start += phase.steps;
  }
  assert.equal(windows.length, 4, "the plan no longer has four transitions");

  // What is compared is the figure the drawing is handed, not the declaration behind it:
  // which lines are interrupted and by how much. A reading that is being held at nought
  // draws the same twelve whole lines as no reading at all, and the step where one gives
  // way to the other is not a change in the picture.
  const figureAt = (step) => {
    const declaration = declarationAt(step);
    const share = BREAK_SHARE * declaration.amount;
    return {
      share,
      edges: share > 0 ? hiddenEdges(declaration.reading, VIEW_TURNS, HALF) : []
    };
  };

  let moved = 0;
  for (let step = 0; step < TOTAL_STEPS; step += 1) {
    if (deepEquals(figureAt(step), figureAt(step - 1))) {
      continue;
    }
    moved += 1;
    assert.ok(
      windows.some(([from, to]) => step >= from && step < to),
      `the figure changed at step ${step}, outside every transition`
    );
  }
  // The scan is scanning: something really does move inside the windows.
  assert.equal(moved, windows.reduce((sum, [from, to]) => sum + (to - from), 0));

  // The clip loops inside a still stretch. Step 599 and step 0 are two steps of one
  // ambiguous hold that the wrap happens to fall in the middle of, so the seam draws the
  // same twelve whole lines on both sides of itself.
  assert.deepEqual(declarationAt(TOTAL_STEPS - 1), declarationAt(0));
  assert.equal(declarationAt(0).amount, 0);
  assert.deepEqual(figureAt(TOTAL_STEPS - 1), figureAt(0));
});

test("the card is a declared reading, standing still", async () => {
  // A card taken in a transition would show three lines caught halfway through being
  // interrupted, which is neither of the two things the figure has to say. It is taken
  // inside a hold, and inside one where a reading is actually declared -- the ambiguous
  // holds are the longer stretches, but a card of them is a plain wireframe.
  const { readFileSync } = await import("node:fs");
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const frame = manifest.artworks.find((entry) => entry.id === "necker-cube").thumbnail.frame;
  const step = frame * (STEPS_PER_SECOND / 30);
  const declaration = declarationAt(step);
  assert.notEqual(declaration.reading, 0, `frame ${frame} declares nothing`);
  assert.equal(declaration.amount, 1, `frame ${frame} catches the interruption at ${declaration.amount}`);

  // And it is a hold rather than the instant a transition happens to touch one.
  let start = 0;
  const phase = PLAN.find((candidate) => {
    const holds = step >= start && step < start + candidate.steps;
    start += candidate.steps;
    return holds;
  });
  assert.ok(isHold(phase), `frame ${frame} falls in the ${phase.name} transition`);
});

test("the figure never flattens: it is a Necker cube", () => {
  // A quarter turn away is a face-on view, where four faces project to lines and there is
  // no near corner to read either way. The view stands clear of those, and the smallest
  // face on the wall keeps better than a third of a full one.
  const fullFace = (2 * HALF) ** 2;
  const corners = shadowAt(VIEW_TURNS, HALF);
  let smallest = Infinity;
  for (const face of FACES) {
    smallest = Math.min(smallest, projectedArea(corners, face));
  }
  assert.ok(smallest > 0.3 * fullFace, `a face is only ${smallest / fullFace} of itself`);
  for (const degenerate of [0, 0.25]) {
    assert.ok(Math.abs(VIEW_TURNS - degenerate) > 0.05);
  }
});

test("the clip closes exactly, because there was never anything to close", () => {
  assert.deepEqual(shadowAt(VIEW_TURNS, HALF), shadowAt(VIEW_TURNS, HALF));
  assert.deepEqual(declarationAt(TOTAL_STEPS), declarationAt(0));
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
  const scene = sceneAt(VIEW_TURNS, HALF);
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
