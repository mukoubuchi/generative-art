/**
 * A cube, and the two worlds its shadow could be cast by.
 *
 * The figure is a real cube in three dimensions, turned about its upright axis and
 * projected flat by dropping depth. Dropping depth is exactly what makes the drawing
 * ambiguous, and the ambiguity has a precise form. Reflecting a scene front to back
 * leaves every projected point where it was; it also turns a rotation into its opposite
 * and a lean towards the eye into a lean away, so the mirrored world is this cube
 * turning the other way and seen from the other side, with its front and back corners
 * exchanged. The two are the same shadow — not nearly, but to the last bit, which is
 * what the tests hold. Neither reading is the true one, and the drawing cannot be asked:
 * that is the artwork's line from the cave, put as arithmetic.
 *
 * What the two readings do disagree about is which face is nearest, and that is the
 * only thing the drawing upstairs is allowed to show when it declares a reading.
 */

/** Simulation steps per second; the 30 fps clip samples every second step. */
export const STEPS_PER_SECOND = 60;
/** One whole rock of the cube: the clip. */
export const TOTAL_STEPS = 600;

/**
 * The cube does not move, and that is the artwork.
 *
 * It used to rock, and a reader used to be able to turn it with the pointer. Both were
 * mistakes of the same kind: motion gives a drawing depth cues it is not entitled to —
 * parallax says at once which corner is nearer — and a figure that answers the hand is a
 * figure the hand can be blamed for. A Necker cube reverses in the person looking at it.
 * So the figure stands still and nothing here is asked of anybody.
 *
 * It stands corner-on, an eighth of a turn round. There the shadow is symmetric about
 * both axes and the two interior corners fall symmetrically about the centre, so neither
 * reading is the easier one to take — which is what makes the reversal a reversal rather
 * than a correction.
 */
export const VIEW_TURNS = 0.125;
/** The two readings: which sign of depth the viewer is taking to be towards them. */
export const READINGS = [1, -1];

const FULL_TURN = Math.PI * 2;
/** Leaned back a little, so a face of the top is in view and the figure is not flat. */
export const TILT = (26 * Math.PI) / 180;

/** The eight corners of a cube of side two, centred on the origin. */
export const CORNERS = [
  { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
  { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 },
  { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 },
  { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 }
];

/** The twelve edges, as pairs of corner numbers. */
export const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

/** The six faces, as rings of four corners. */
export const FACES = [
  [0, 1, 2, 3], [4, 5, 6, 7],
  [0, 1, 5, 4], [2, 3, 7, 6],
  [1, 2, 6, 5], [0, 3, 7, 4]
];

/**
 * A corner, turned by `turns` of a whole turn about the upright axis and leaned back
 * by the fixed tilt. Depth comes out as z: larger is nearer the eye.
 */
export function orient(corner, turns, half = 1, tilt = TILT) {
  const angle = FULL_TURN * turns;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const x = corner.x * cosine + corner.z * sine;
  const spun = -corner.x * sine + corner.z * cosine;
  const y = corner.y * Math.cos(tilt) - spun * Math.sin(tilt);
  const z = corner.y * Math.sin(tilt) + spun * Math.cos(tilt);
  return { x: half * x, y: half * y, z: half * z };
}

/** The shadow: the same point with its depth thrown away. */
export function project(point) {
  return { x: point.x, y: point.y };
}

/** The eight corners as the wall receives them, at `turns`. */
export function shadowAt(turns, half = 1, tilt = TILT) {
  return CORNERS.map((corner) => project(orient(corner, turns, half, tilt)));
}

/** The eight corners in space at `turns`, depth and all. */
export function sceneAt(turns, half = 1, tilt = TILT) {
  return CORNERS.map((corner) => orient(corner, turns, half, tilt));
}

/**
 * A scene read front to back the other way. Every projected point is untouched, which
 * is the whole of the ambiguity: nothing on the wall can tell the two apart.
 */
export function mirrorDepth(scene) {
  return scene.map((point) => ({ x: point.x, y: point.y, z: -point.z }));
}

/**
 * Which corner of the mirrored world stands where corner `index` of this one stands.
 * Reflecting depth carries each corner to the one behind it, so the near four and the
 * far four change places — and the shadow does not notice.
 */
export const DEPTH_SWAP = [4, 5, 6, 7, 0, 1, 2, 3];

/**
 * The other world casting this same shadow: the cube turned the other way and leaned
 * the other way. Together with DEPTH_SWAP this is the whole of the reversal, and the
 * tests use it to show the two shadows agree exactly rather than closely.
 */
export function otherReading(turns, tilt = TILT) {
  return { turns: -turns, tilt: -tilt };
}

/**
 * Which face a reading puts nearest the eye. The two readings disagree about this and
 * about nothing else that can be seen, so it is the only thing the drawing shows when
 * it declares one.
 */
export function frontFace(reading, turns = VIEW_TURNS, half = 1) {
  const scene = sceneAt(turns, half);
  let best = 0;
  let bestDepth = -Infinity;
  FACES.forEach((face, index) => {
    const depth = face.reduce((sum, corner) => sum + reading * scene[corner].z, 0) / face.length;
    if (depth > bestDepth) {
      bestDepth = depth;
      best = index;
    }
  });
  return best;
}


/**
 * The corner a reading puts furthest from the eye. A cube is convex, so its far corner is
 * simply the one whose depth the reading likes least, and there is never a tie: the two
 * candidates are opposite corners of the cube and the view is not edge-on to either.
 */
export function farCorner(reading, turns = VIEW_TURNS, half = 1) {
  const scene = sceneAt(turns, half);
  let far = 0;
  scene.forEach((point, index) => {
    if (reading * point.z < reading * scene[far].z) {
      far = index;
    }
  });
  return far;
}

/**
 * The three edges a reading puts behind the solid — the ones a cube of wood would hide.
 *
 * For a convex body this needs no hidden-line machinery: every edge that does not meet
 * the far corner has a face of its own turned towards the eye, and the three that do meet
 * it have none. Which three they are is the only thing in the drawing the two readings
 * disagree about, so interrupting them is the whole of a declaration.
 */
export function hiddenEdges(reading, turns = VIEW_TURNS, half = 1) {
  const far = farCorner(reading, turns, half);
  return EDGES.map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.includes(far))
    .map(({ index }) => index);
}

/** Where along an edge the interruption runs, from the far corner in. */
export function breakAt(edgeIndex, reading, amount, turns = VIEW_TURNS, half = 1) {
  const hidden = hiddenEdges(reading, turns, half);
  if (amount <= 0 || !hidden.includes(edgeIndex)) {
    return null;
  }
  const far = farCorner(reading, turns, half);
  const [from] = EDGES[edgeIndex];
  // Measured from the far end whichever way the edge is written down.
  return { fromFarEnd: from === far, share: BREAK_SHARE * amount };
}

/**
 * How much of an interrupted edge is taken out at a full declaration. Not all of it: the
 * truth is that the whole edge is hidden, but a line rubbed out entirely leaves nine
 * lines and no argument, and what the figure has to show is a corner being pushed back
 * rather than a corner being deleted. Interrupted at the far end and left hanging is the
 * cue a draughtsman uses, and it keeps all twelve lines in the picture.
 */
export const BREAK_SHARE = 0.44;

/**
 * The clip's plan, in steps: a reading is declared, let go of, the other is declared,
 * and let go of again — while the cube turns evenly throughout, so nothing about the
 * shadow itself is disturbed by any of it.
 */
export const PLAN = [
  { name: "ambiguous", steps: 60 },
  { name: "first", steps: 150 },
  { name: "ambiguous", steps: 90 },
  { name: "second", steps: 150 },
  { name: "ambiguous", steps: 150 }
];

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

/**
 * How firmly a reading is being declared at `step`, and which one. Nought is the bare
 * shadow, with nothing to say which way the cube is turning.
 */
export function declarationAt(step) {
  const wrapped = ((step % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
  let start = 0;
  for (const phase of PLAN) {
    if (wrapped < start + phase.steps) {
      if (phase.name === "ambiguous") {
        return { reading: 0, amount: 0 };
      }
      const progress = (wrapped - start) / phase.steps;
      return {
        reading: phase.name === "first" ? READINGS[0] : READINGS[1],
        amount: smoothstep(1 - Math.abs(2 * progress - 1))
      };
    }
    start += phase.steps;
  }
  return { reading: 0, amount: 0 };
}
