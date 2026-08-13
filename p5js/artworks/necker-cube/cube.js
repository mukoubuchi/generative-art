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
 * The cube rocks about a corner-on view rather than turning all the way round. A whole
 * turn would pass four times through a face-on view, where the shadow collapses to a
 * rectangle with a line across it — flat, and not ambiguous about anything, since there
 * is no corner to read as near or far. Rocking a fifth of a turn either side of
 * corner-on keeps the figure a Necker cube for every frame of the clip.
 */
export const REST_TURNS = 0.125;
export const ROCK_TURNS = 0.055;

/**
 * How far round the cube stands at `step`, in turns. One rock fills the clip. The step
 * is wrapped into the clip before the sine is taken, so the closing step is the opening
 * one exactly rather than to within the last bit of a sine of two pi.
 */
export function turnsAt(step) {
  const wrapped = ((step % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
  return REST_TURNS + ROCK_TURNS * Math.sin((Math.PI * 2 * wrapped) / TOTAL_STEPS);
}
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
export function frontFace(turns, reading, half = 1) {
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
