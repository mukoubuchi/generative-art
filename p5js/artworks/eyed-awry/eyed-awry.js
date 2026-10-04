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

/** The warm white shared by The Hat, Herringbone and Pinwheel. */
export const GROUND = [230, 224, 208];
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
 * The staging, built around the one thing the figure does: it closes along one axis and
 * nowhere else. It takes the grammar of The Same Tower's clip -- a hold at a station, a
 * decisive move, the reveal held, and the return -- rather than its shots.
 *
 * The eye stays in the plane of the axis and (1, -1, 0), and its direction is a tilt off
 * the axis in degrees: nought and a full turn are the first station, a half turn the
 * second. Any other tilt splits all three joints, each by its own length times the sine
 * of the tilt, so no frame but a station's shows the triangle closed.
 *
 * hold closed    45  the triangle, looking along (1, 1, 1)
 * whip           18  six tenths of a second off the axis, to 49.5 degrees
 * settle         30  the last tenth of the way, to 55
 * hold apart     45  the three beams for what they are
 * return         75  back into the closing, which arrives only at the axis
 * hold closed    36
 * over the top   66  to the opposite station, the beams parting and closing again
 * hold behind    30  the triangle closed from the other side
 * home           45  round to the first station
 *
 * Every stretch is smootherstep, so it sets off and arrives with neither speed nor
 * acceleration, and each begins where the one before it ended. A hold names no target.
 */
export const STRETCHES = Object.freeze([
  Object.freeze(["hold closed", 45, null]),
  Object.freeze(["whip", 18, 49.5]),
  Object.freeze(["settle", 30, 55]),
  Object.freeze(["hold apart", 45, null]),
  Object.freeze(["return", 75, 0]),
  Object.freeze(["hold closed", 36, null]),
  Object.freeze(["over the top", 66, 180]),
  Object.freeze(["hold behind", 30, null]),
  Object.freeze(["home", 45, 360])
]);
export const ACT_FRAMES = STRETCHES.reduce((sum, [, frames]) => sum + frames, 0);

/** Where each stretch starts. */
export const STRETCH_STARTS = Object.freeze(STRETCHES.map((unused, index) =>
  STRETCHES.slice(0, index).reduce((sum, [, frames]) => sum + frames, 0)));

/**
 * Smootherstep: first and second derivatives vanish at both ends, so one
 * stretch can be joined to the next without a jolt.
 */
export function eased(t) {
  const u = Math.min(Math.max(t, 0), 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/**
 * The stretch a frame falls in, how far through it, and the tilt off the axis there. The
 * last frame of a stretch is the stretch's own end, so the next stretch (a hold, or the
 * wrap to frame nought) begins where this one arrived rather than one step short of it.
 */
export function actAt(frameIndex) {
  if (!Number.isSafeInteger(frameIndex)) {
    throw new TypeError("The frame index must be a safe integer.");
  }
  const frame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  let from = 0;
  let at = 0;
  for (const [name, frames, target] of STRETCHES) {
    const to = target ?? from;
    if (frame < at + frames) {
      const progress = frames === 1 ? 1 : (frame - at) / (frames - 1);
      return { frame, name, progress, tilt: from + (to - from) * eased(progress) };
    }
    from = to;
    at += frames;
  }
  throw new RangeError("The stretches do not cover the clip.");
}

/** The tilt off the magic axis at a frame, in degrees. */
export function tiltAt(frameIndex) {
  return actAt(frameIndex).tilt;
}

const DEGREE = Math.PI / 180;

/**
 * The unit direction from the look-at point to the eye, `tilt` degrees round from the
 * magic axis towards (1, -1, 0). Nought is the axis; 180 its opposite.
 */
export function viewDirection(tilt) {
  const angle = tilt * DEGREE;
  return MAGIC_AXIS.map((part, axis) => Math.cos(angle) * part + Math.sin(angle) * TURN_AXIS[axis]);
}

/** The largest of the three joints' gaps in the picture of an eye looking along `direction`. */
export function largestGap(direction) {
  return Math.max(...jointGaps(direction));
}

export function sceneAt(frameIndex) {
  const { frame, name, tilt } = actAt(frameIndex);
  const direction = viewDirection(tilt);
  const bounds = silhouetteBounds(direction);
  const { right, up } = viewBasis(direction);
  // Shift the look-at in the picture plane so the silhouette sits in the middle of the
  // frame, then fit a square ortho to the longer side with the same paper around it.
  const lookAt = LOOK_AT.map((part, axis) =>
    part + right[axis] * (bounds.minX + bounds.maxX) / 2 + up[axis] * (bounds.minY + bounds.maxY) / 2);
  const half = Math.max(bounds.width, bounds.height) / 2 * (1 + FRAME_MARGIN);
  const gap = largestGap(direction);
  return {
    frameIndex: frame,
    act: name,
    tilt,
    direction,
    eye: lookAt.map((part, axis) => part + direction[axis] * EYE_DISTANCE),
    lookAt,
    orthoHalf: half * STAGE_SCALE,
    gap,
    closed: gap < 1e-9
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
