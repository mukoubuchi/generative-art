/**
 * Three beams of cubes that close into one triangle from two opposite stations
 * and fall apart anywhere else.
 *
 * Each beam is a run of axis-aligned cubes. The three runs do not meet: at each
 * corner the last cube of one beam and the first cube of the next differ by a
 * whole number of steps along (1, 1, 1). An orthographic eye looking along that
 * axis therefore sees those two cubes as one, and the three beams as a closed
 * triangle. An eye off the axis sees the gap. The opposite station, looking
 * along (−1, −1, −1), is the same axis the other way, so the triangle closes
 * again. The clip is one great-circle turn in a plane that contains the axis:
 * closed, broken, closed from behind, broken, and home.
 *
 * Reutersvärd's 1934 drawing used nine cubes in the plane of the page. The
 * cubes here are in space, the closing is an accident of one axis, and the
 * count is fifteen rather than nine. None of that is attributed to him.
 *
 * Coordinates are the figure's own: x across, y in depth, z up. The sketch
 * maps them onto the stage.
 */

export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 13;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/** Cubes on each beam. Three beams, no cube shared. */
export const CUBES_PER_BEAM = 5;
/**
 * How far the next beam is stepped along (1, 1, 1) from the last cube of this
 * one. Two keeps the beams from occupying a cell together and is a whole
 * number, so the joints stay integer.
 */
export const JOINT_STEP = 2;
/** Edge of a cube, less than one so neighbouring cubes of a beam stay distinct. */
export const CUBE_SIZE = 0.86;

/** The warm white shared by The Hat, Herringbone, Pinwheel and The Same Tower. */
export const GROUND = [230, 224, 208];
export const INK = [0, 0, 0];
/** Platonic Duals' screen-space edge, the collection's standing stroke. */
export const STROKE_WEIGHT = 1.7;

/**
 * One tower unit on the stage. Chosen so the bounding sphere of the cubes,
 * with a little paper around it, fills the logical frame under the ortho lens.
 */
export const STAGE_SCALE = 40;
/** How far the eye stands from the figure's centre, in the figure's units. */
export const EYE_DISTANCE = 24;
/** Paper around the bounding sphere, as a share of the sphere's radius. */
export const FRAME_MARGIN = 0.14;

export const MAGIC = [1, 1, 1];

function hypot3([x, y, z]) {
  return Math.hypot(x, y, z);
}

function add([ax, ay, az], [bx, by, bz]) {
  return [ax + bx, ay + by, az + bz];
}

function scale([x, y, z], by) {
  return [x * by, y * by, z * by];
}

function cross([ax, ay, az], [bx, by, bz]) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function normalize(vector) {
  const length = hypot3(vector);
  if (!(length > 0)) {
    throw new RangeError("A direction has to have a length.");
  }
  return scale(vector, 1 / length);
}

/** Unit axis the two stations share. */
export const MAGIC_AXIS = normalize(MAGIC);
/**
 * A unit vector in the plane of the turn, perpendicular to the axis. With the
 * axis it spans the great circle the eye travels.
 */
export const TURN_AXIS = normalize([1, -1, 0]);

/**
 * One tribar of cubes. Beam A runs along +x from the origin; beam B is stepped
 * along (1, 1, 1) and runs along +y; beam C is stepped again and runs along +z.
 * The last cube of C then differs from the first of A by a multiple of (1, 1, 1)
 * for any count and any joint step, which is the whole of the closing.
 */
export function cubeCells(count = CUBES_PER_BEAM, step = JOINT_STEP, origin = [0, 0, 0]) {
  if (!Number.isSafeInteger(count) || count < 2) {
    throw new RangeError("A beam is at least two cubes.");
  }
  if (!Number.isSafeInteger(step) || step < 1) {
    throw new RangeError("The joint step is a positive integer.");
  }
  const cells = [];
  const last = count - 1;
  for (let index = 0; index < count; index += 1) {
    cells.push({ beam: "a", cell: add(origin, [index, 0, 0]) });
  }
  for (let index = 0; index < count; index += 1) {
    cells.push({ beam: "b", cell: add(origin, [last + step, step + index, step]) });
  }
  for (let index = 0; index < count; index += 1) {
    cells.push({
      beam: "c",
      cell: add(origin, [last + 2 * step, last + 2 * step, 2 * step + index])
    });
  }
  return cells;
}

export const CUBES = cubeCells();

export const BEAMS = {
  a: CUBES.filter((cube) => cube.beam === "a").map((cube) => cube.cell),
  b: CUBES.filter((cube) => cube.beam === "b").map((cube) => cube.cell),
  c: CUBES.filter((cube) => cube.beam === "c").map((cube) => cube.cell)
};

/**
 * The three joints: the last cube of one beam and the first of the next. Each
 * pair differs by a multiple of (1, 1, 1).
 */
export function jointsOf(beams = BEAMS) {
  return [
    { from: "a", to: "b", near: beams.a.at(-1), far: beams.b[0] },
    { from: "b", to: "c", near: beams.b.at(-1), far: beams.c[0] },
    { from: "c", to: "a", near: beams.c.at(-1), far: beams.a[0] }
  ];
}

export const JOINTS = jointsOf();

export function cellKey([x, y, z]) {
  return `${x},${y},${z}`;
}

/** The mean of the cube centres: where the eye looks. */
export const LOOK_AT = CUBES.reduce(
  (sum, { cell }) => add(sum, cell),
  [0, 0, 0]
).map((part) => part / CUBES.length);

/**
 * Half the edge of the cube as a corner offset. The eight corners of a cube
 * at a cell are the cell plus every combination of these signs.
 */
const CORNER_HALF = CUBE_SIZE / 2;
const CORNER_SIGNS = [-1, 1].flatMap((x) =>
  [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z]))
);

export function cubeCorners(cell) {
  return CORNER_SIGNS.map((sign) =>
    cell.map((part, axis) => part + sign[axis] * CORNER_HALF)
  );
}

/** Farthest corner from the look-at point: the sphere the ortho frame has to hold. */
export const BOUNDING_RADIUS = CUBES.reduce((radius, { cell }) => {
  for (const corner of cubeCorners(cell)) {
    const reach = hypot3(corner.map((part, axis) => part - LOOK_AT[axis]));
    if (reach > radius) radius = reach;
  }
  return radius;
}, 0);

export const ORTHO_HALF = BOUNDING_RADIUS * (1 + FRAME_MARGIN) * STAGE_SCALE;

/**
 * Math (x, y, z) with z up onto the WEBGL stage: x across, −z as the canvas
 * vertical (so up stays up), −y into the screen. Linear, including at zero.
 */
export function onStage([x, y, z]) {
  return [x * STAGE_SCALE, -z * STAGE_SCALE, -y * STAGE_SCALE];
}

export const STAGE_LOOK_AT = onStage(LOOK_AT);

function dot([ax, ay, az], [bx, by, bz]) {
  return ax * bx + ay * by + az * bz;
}

/**
 * A right-handed basis for an orthographic picture looking along `direction`,
 * with world-up kept as up so the two stations are not a flip of each other.
 */
export function viewBasis(direction) {
  const along = normalize(direction);
  const worldUp = Math.abs(dot(along, [0, 0, 1])) > 0.9 ? [0, 1, 0] : [0, 0, 1];
  const right = normalize(cross(worldUp, along));
  const up = cross(along, right);
  return { along, right, up };
}

/**
 * The cubes' corners in the picture plane of an eye looking along `direction`,
 * measured from the cells' mean. The frame is fitted to this silhouette.
 */
export function projectedCorners(direction) {
  const { right, up } = viewBasis(direction);
  const points = [];
  for (const { cell } of CUBES) {
    for (const corner of cubeCorners(cell)) {
      const rel = corner.map((part, axis) => part - LOOK_AT[axis]);
      points.push([dot(rel, right), dot(rel, up)]);
    }
  }
  return points;
}

export function silhouetteBounds(direction) {
  const points = projectedCorners(direction);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/*
 * The staging. One great-circle turn. Every moving stretch is smootherstep,
 * so it sets off and arrives with neither speed nor acceleration, and each
 * stretch begins where the one before it ended.
 *
 * front  36  the triangle closed, looking along (1, 1, 1)
 * leave  84  the joints split
 * side   24  the three beams for what they are
 * cross  84  the joints close again
 * back   24  the triangle closed from the other station
 * home  138  around the rest of the circle and back to the first station
 */
export const ACTS = [
  ["front", 36],
  ["leave", 84],
  ["side", 24],
  ["cross", 84],
  ["back", 24],
  ["home", 138]
];
export const ACT_FRAMES = ACTS.reduce((sum, [, frames]) => sum + frames, 0);

export const FRONT_FRAME = 0;
export const SIDE_FRAME = ACTS[0][1] + ACTS[1][1];
export const BACK_FRAME = SIDE_FRAME + ACTS[2][1] + ACTS[3][1];

/**
 * Smootherstep: first and second derivatives vanish at both ends, so one
 * stretch can be joined to the next without a jolt.
 */
export function eased(t) {
  const u = Math.min(Math.max(t, 0), 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
}

export function actAt(frameIndex) {
  if (!Number.isSafeInteger(frameIndex)) {
    throw new TypeError("The frame index must be a safe integer.");
  }
  const frame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  let start = 0;
  for (const [name, frames] of ACTS) {
    if (frame < start + frames) {
      // The last frame of a stretch is the stretch's own end, so the next
      // stretch (a hold, or the wrap to frame nought) begins where this one
      // arrived rather than one step short of it.
      const progress = frames === 1 ? 1 : (frame - start) / (frames - 1);
      return { frame, name, progress };
    }
    start += frames;
  }
  throw new RangeError("The acts do not cover the clip.");
}

/**
 * How far around the great circle the eye has come. Nought and one turn are
 * the same station; a half turn is the opposite station.
 */
export function turnAt(frameIndex) {
  const { name, progress } = actAt(frameIndex);
  if (name === "front") return 0;
  if (name === "leave") return 0.25 * eased(progress);
  if (name === "side") return 0.25;
  if (name === "cross") return 0.25 + 0.25 * eased(progress);
  if (name === "back") return 0.5;
  return 0.5 + 0.5 * eased(progress);
}

/**
 * The unit direction from the look-at point to the eye, as a turn around the
 * great circle. Turn nought is the magic axis; a half turn is its opposite.
 */
export function viewDirection(turn) {
  if (!(turn >= 0 && turn <= 1)) {
    throw new RangeError("The turn runs from nought to one.");
  }
  // The two stations and the wrap are returned as the axis itself, so a test
  // can hold them with === on each component rather than against a cosine of 2π.
  if (turn === 0 || turn === 1) return MAGIC_AXIS.slice();
  if (turn === 0.5) return scale(MAGIC_AXIS, -1);
  if (turn === 0.25) return TURN_AXIS.slice();
  const angle = 2 * Math.PI * turn;
  return add(scale(MAGIC_AXIS, Math.cos(angle)), scale(TURN_AXIS, Math.sin(angle)));
}

export function eyeAt(turn) {
  return add(LOOK_AT, scale(viewDirection(turn), EYE_DISTANCE));
}

export function sceneAt(frameIndex) {
  const { frame, name } = actAt(frameIndex);
  const turn = turnAt(frameIndex);
  const direction = viewDirection(turn);
  const bounds = silhouetteBounds(direction);
  const { right, up } = viewBasis(direction);
  // Shift the look-at in the picture plane so the silhouette sits in the middle
  // of the frame, then fit a square ortho to the longer side with the same
  // paper around it at every station.
  const lookAt = add(
    LOOK_AT,
    add(
      scale(right, (bounds.minX + bounds.maxX) / 2),
      scale(up, (bounds.minY + bounds.maxY) / 2)
    )
  );
  const half = Math.max(bounds.width, bounds.height) / 2 * (1 + FRAME_MARGIN);
  return {
    frameIndex: frame,
    act: name,
    turn,
    direction,
    eye: add(lookAt, scale(direction, EYE_DISTANCE)),
    lookAt,
    orthoHalf: half * STAGE_SCALE,
    closed: turn === 0 || turn === 0.5 || turn === 1
  };
}

export function eyeStepAt(frameIndex) {
  const here = sceneAt(frameIndex).eye;
  const next = sceneAt(frameIndex + 1).eye;
  return hypot3(here.map((part, axis) => next[axis] - part));
}

/**
 * How far apart a joint's two cubes stand in the picture of an orthographic
 * eye looking along `direction`. Zero exactly when the joint is parallel to
 * the direction; a length in the figure's units otherwise.
 */
export function projectedGap(near, far, direction) {
  const delta = near.map((part, axis) => far[axis] - part);
  const length = hypot3(direction);
  if (!(length > 0)) {
    throw new RangeError("A direction has to have a length.");
  }
  return hypot3(cross(delta, direction)) / length;
}

export function jointGaps(direction, joints = JOINTS) {
  return joints.map((joint) => projectedGap(joint.near, joint.far, direction));
}

/**
 * Exact arithmetic. A joint pair that differs by k(1, 1, 1) has a cross
 * product of exactly nought with (1, 1, 1), and a non-zero cross product
 * with any direction that is not that axis. Cells are integers, so the
 * products are BigInt identities rather than tolerances.
 */
export function exactDelta(near, far) {
  return [
    BigInt(far[0]) - BigInt(near[0]),
    BigInt(far[1]) - BigInt(near[1]),
    BigInt(far[2]) - BigInt(near[2])
  ];
}

export function exactCross([ax, ay, az], [bx, by, bz]) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

export function exactZero([x, y, z]) {
  return x === 0n && y === 0n && z === 0n;
}
