import { mulberry32 } from "../shared/random.js";

/**
 * Thirty spokes share one hub, and it is the hole that the loops cannot get past.
 *
 * This work started from Laozi's chapter on the usefulness of what is not there. What it
 * measures is the winding number: how many times a closed curve goes round the hub. That
 * number is an integer, and no deformation that leaves the hub alone can change it — so a
 * loop threaded through the wheel is caught there for good, however wildly it is pulled.
 *
 * The deformation here cannot change it *by construction*, which is the point. Every step
 * is a composition of two maps that fix the hub disc: a twist that turns each point about
 * the centre by an amount depending only on its distance, and a breathing that moves each
 * point along its own ray without ever reaching the hub. Neither moves a point across the
 * hub, because neither can carry a point inside a radius it started outside of. The curves
 * are stirred until they are unrecognisable and their winding numbers do not move.
 *
 * Nothing here declares which loop winds how often. The loops are seeded noise; the number
 * is measured off each one, twice, by two calculations that share no arithmetic — signed
 * ray crossings, which is integer counting, and the sum of turned angle, which is not.
 */

const FULL_TURN = Math.PI * 2;

/** The hub: the hole the loops are caught on. Logical pixels from the centre. */
export const HUB_RADIUS = 62;
/** Thirty spokes, as the chapter says, reaching the rim of the wheel. */
export const SPOKE_COUNT = 30;
export const RIM_RADIUS = 300;

/** The clip: ten seconds at sixty steps a second, sampled every second step at 30 fps. */
export const STEPS_PER_SECOND = 60;
export const TOTAL_STEPS = 600;

/** How far the rim is carried round relative to the hub, at the twist's fullest. */
export const TWIST_TURNS = 0.85;
/** How far a point's distance from the hub is stretched or squeezed, as a share of itself. */
export const BREATHE_DEPTH = 0.3;
/** Lobes in the breathing, so it squeezes some bearings while stretching others. */
export const BREATHE_LOBES = 3;

/**
 * The seed is a design choice like a palette. It was searched for one that hands back
 * loops of five different winding numbers — minus two through two, the nought among them
 * — while keeping every one of them on the canvas for the whole clip. What the numbers
 * are was not decided here; the search only asked for a spread, and then measured it.
 */
export const LOOP_SEED = 42;
export const LOOP_COUNT = 7;

/**
 * The phase of the clip at `step`, on [0, 1). Wrapped before the sine so that the last
 * step of the loop is the first step exactly, rather than a sine of two pi away from it.
 */
export function phaseAt(step) {
  const wrapped = ((step % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
  return wrapped / TOTAL_STEPS;
}

/** How far round the twist has carried the far field, in radians. Zero at both doors. */
export function twistAt(step) {
  return TWIST_TURNS * FULL_TURN * Math.sin(FULL_TURN * phaseAt(step));
}

/**
 * How deep the breathing is at `step`: three breaths while the twist swings once.
 *
 * Three rather than two, and started off zero, for a reason that only showed up in the
 * pictures. The twist is a sine over the clip, so it is nought at the halfway mark as
 * well as at the doors; if the breathing also came back to where it started there, the
 * middle frame of the clip would be the first frame exactly, and the stirring would
 * visibly stop and reset halfway through. An odd number of breaths off a phase puts the
 * breathing at the opposite of its opening value at the midpoint instead, so the clip
 * passes through the middle without a pause and still closes, because three whole
 * breaths later it is back where it began.
 */
export const BREATHE_CYCLES = 3;
export const BREATHE_PHASE = Math.PI / 3;

export function breatheAt(step) {
  return BREATHE_DEPTH * Math.sin(BREATHE_CYCLES * FULL_TURN * phaseAt(step) + BREATHE_PHASE);
}

/**
 * The twist a point at distance `radius` receives: none at the hub, rising to the whole
 * twist far away. Written as 1 - hub/r so that it is exactly zero on the hub's rim and
 * never exceeds one, which keeps the shear finite however far out a loop reaches.
 */
export function twistShare(radius) {
  return radius <= HUB_RADIUS ? 0 : 1 - HUB_RADIUS / radius;
}

/**
 * Where a point has been carried by `step`. Two maps, composed:
 *
 *   twist     — turn about the centre by an angle depending only on the distance
 *   breathing — move along the ray, scaling the distance *from the hub's rim*
 *
 * The first leaves every distance alone. The second multiplies (r - hub) by a strictly
 * positive number, so a point outside the hub stays outside it. Neither can therefore
 * carry a curve across the hub, which is why the winding number is safe before anything
 * measures it.
 */
export function carry(point, step) {
  const radius = Math.hypot(point.x, point.y);
  if (radius === 0) {
    return { x: 0, y: 0 };
  }
  const bearing = Math.atan2(point.y, point.x);
  const turned = bearing + twistAt(step) * twistShare(radius);
  // Strictly positive: BREATHE_DEPTH is well under one, so the scale never reaches zero.
  const scale = 1 + breatheAt(step) * Math.cos(BREATHE_LOBES * turned);
  const carried = HUB_RADIUS + (radius - HUB_RADIUS) * scale;
  return { x: carried * Math.cos(turned), y: carried * Math.sin(turned) };
}

/**
 * The loops, as seeded noise. Each is a closed curve traced by a radius that wanders as
 * it goes round, about a centre that is itself off the middle — so how many times a loop
 * encircles the hub is an accident of its seed, not a decision. Loops that touch the hub
 * are discarded rather than repaired, because a loop through the hub has no winding
 * number to be invariant.
 */
export function seededLoops(seed = LOOP_SEED, count = LOOP_COUNT) {
  const random = mulberry32(seed);
  const loops = [];
  let attempts = 0;
  while (loops.length < count && attempts < 4000) {
    attempts += 1;
    const turns = 1 + Math.floor(random() * 2);
    const direction = random() < 0.32 ? -1 : 1;
    const offset = random() * 210;
    const bearing = random() * FULL_TURN;
    const centre = { x: offset * Math.cos(bearing), y: offset * Math.sin(bearing) };
    const base = 74 + random() * 118;
    const modes = Array.from({ length: 3 }, (unused, index) => ({
      order: index + 2,
      size: (random() - 0.5) * base * 0.3,
      phase: random() * FULL_TURN
    }));
    const samples = 240 * turns;
    const points = Array.from({ length: samples }, (unused, index) => {
      const along = index / samples;
      const sweep = direction * FULL_TURN * turns * along;
      const wobble = modes.reduce(
        (sum, mode) => sum + mode.size * Math.cos(mode.order * sweep + mode.phase),
        0
      );
      const radius = base + wobble;
      return { x: centre.x + radius * Math.cos(sweep), y: centre.y + radius * Math.sin(sweep) };
    });
    if (clearsHub(points) && withinReach(points)) {
      loops.push(points);
    }
  }
  return loops;
}

/** Does every point of the loop stand clear of the hub, with room to spare? */
export function clearsHub(points, margin = 12) {
  return points.every((point) => Math.hypot(point.x, point.y) > HUB_RADIUS + margin);
}

/**
 * How far out a seeded loop may reach. The breathing can stretch a distance from the hub
 * by a factor of one plus its depth, so this bound times that factor is what has to fit
 * the canvas — which is what keeps every loop on stage for the whole clip without
 * anything being clamped, and clamping would be a deformation nobody could vouch for.
 */
export const REACH_LIMIT = 248;

function withinReach(points) {
  return points.every((point) => Math.hypot(point.x, point.y) < REACH_LIMIT);
}

/** The loop as it stands at `step`. */
export function loopAt(points, step) {
  return points.map((point) => carry(point, step));
}

/**
 * The winding number by signed ray crossings: send a ray from the centre out along
 * `bearing` and count a segment crossing it upwards as one, downwards as minus one. This
 * is counting, so the answer is an integer with no arithmetic to round.
 */
export function windingByCrossings(points, bearing = 0) {
  const cosine = Math.cos(-bearing);
  const sine = Math.sin(-bearing);
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    // Turn the plane so the ray is the positive x axis; then a crossing is a change of
    // sign in y, and it is the ray rather than the whole line if x at the crossing is
    // positive.
    const fromY = from.x * sine + from.y * cosine;
    const toY = to.x * sine + to.y * cosine;
    if (fromY <= 0 === toY <= 0) {
      continue;
    }
    const fromX = from.x * cosine - from.y * sine;
    const toX = to.x * cosine - to.y * sine;
    const crossX = fromX + ((toX - fromX) * (0 - fromY)) / (toY - fromY);
    if (crossX > 0) {
      total += fromY <= 0 ? 1 : -1;
    }
  }
  return total;
}

/**
 * The winding number again, by a calculation with nothing in common with the one above:
 * add up the angle the loop turns through about the centre and divide by a whole turn.
 * Returns a real number, which should land on an integer.
 */
export function windingByAngle(points) {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    let step = Math.atan2(to.y, to.x) - Math.atan2(from.y, from.x);
    while (step > Math.PI) {
      step -= FULL_TURN;
    }
    while (step <= -Math.PI) {
      step += FULL_TURN;
    }
    total += step;
  }
  return total / FULL_TURN;
}

/** The thirty spokes, hub rim to wheel rim, as plain segments. */
export function spokes(count = SPOKE_COUNT) {
  return Array.from({ length: count }, (unused, index) => {
    const bearing = (FULL_TURN * index) / count;
    return {
      x1: HUB_RADIUS * Math.cos(bearing),
      y1: HUB_RADIUS * Math.sin(bearing),
      x2: RIM_RADIUS * Math.cos(bearing),
      y2: RIM_RADIUS * Math.sin(bearing)
    };
  });
}
