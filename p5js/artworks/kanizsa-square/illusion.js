/**
 * A Kanizsa square, built so that the square cannot be drawn.
 *
 * Everything this module emits is a wedge — a disc with a bite taken out of it. There
 * is no line in its vocabulary and no polygon, so the sketch upstairs has nothing it
 * could stroke an edge with, and the square a viewer sees is guaranteed to be the
 * viewer's. The only exception is announced: at the end of the clip the figure admits
 * what it has been implying and a real plate is drawn, which is the one mark in the
 * whole artwork that is not a wedge.
 *
 * What is genuinely on the canvas can be stated exactly. Each inducer's bite has two
 * straight edges, and they lie along the two sides of the square that meet at that
 * corner, so every side carries a real segment at each end and nothing at all in
 * between. The share that is real is the support ratio, the quantity this figure's
 * strength is known to hang on, and here it is a lever: the discs grow and shrink while
 * the square stays exactly where it is, so the edges a viewer supplies come and go
 * while nothing that could be called an edge is ever added or removed.
 */

export const INDUCER_COUNT = 4;
/** Simulation steps per second; the 30 fps clip samples every second step. */
export const STEPS_PER_SECOND = 60;
/** The whole clip: ten seconds of the three levers, with a rest between each. */
export const TOTAL_STEPS = 600;

const QUARTER_TURN = Math.PI / 2;
const FULL_TURN = Math.PI * 2;

/**
 * The clip's three levers, each pulled and put back, with the figure held still
 * between them. The budgets are frames of simulation and they sum to the clip.
 */
export const PLAN = [
  { name: "hold", steps: 54 },
  { name: "support", steps: 156 },
  { name: "hold", steps: 36 },
  { name: "spin", steps: 156 },
  { name: "hold", steps: 36 },
  { name: "reveal", steps: 126 },
  { name: "hold", steps: 36 }
];

/** The support ratio the figure rests at, and the poorest it is taken down to. */
export const FULL_SUPPORT = 0.62;
export const SPARSE_SUPPORT = 0.12;

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

/** There and back, eased at both ends: nought, up to one at the middle, back to nought. */
function pulled(progress) {
  return smoothstep(1 - Math.abs(2 * progress - 1));
}

/** Which lever is being pulled at `step`, and how far, on [0, 1]. */
export function leverAt(step) {
  const wrapped = ((step % TOTAL_STEPS) + TOTAL_STEPS) % TOTAL_STEPS;
  let start = 0;
  for (const phase of PLAN) {
    if (wrapped < start + phase.steps) {
      return { name: phase.name, amount: pulled((wrapped - start) / phase.steps) };
    }
    start += phase.steps;
  }
  return { name: "hold", amount: 0 };
}

/**
 * How much of the square's perimeter is really drawn at `step`. The support lever
 * takes it down towards nothing and brings it back; every other moment holds it at
 * the figure's resting value.
 */
export function supportRatioAt(step) {
  const lever = leverAt(step);
  if (lever.name !== "support") {
    return FULL_SUPPORT;
  }
  return FULL_SUPPORT + (SPARSE_SUPPORT - FULL_SUPPORT) * lever.amount;
}

/**
 * How far the spin lever turns the bites, at its full deflection: half a bite's own
 * span, which is as far off the square's sides as a bite can be got. Turning by a
 * whole quarter would be turning too far — a bite's two edges are a quarter apart, so
 * a quarter turn simply lands one of them where the other was, back along a side, and
 * a third of the real contour comes back with it.
 */
export const FULL_SPIN = QUARTER_TURN / 2;

/** How far the bites are turned away from the square at `step`, in radians. */
export function spinAt(step) {
  const lever = leverAt(step);
  return lever.name === "spin" ? lever.amount * FULL_SPIN : 0;
}

/** How far the figure has owned up at `step`: nought implying, one a drawn plate. */
export function revealAt(step) {
  const lever = leverAt(step);
  return lever.name === "reveal" ? lever.amount : 0;
}

/**
 * The square the viewer supplies: four corners, one per inducer, sitting on its
 * diagonal so its sides run at forty-five degrees. `half` is half its diagonal.
 */
export function squareCorners(half) {
  return Array.from({ length: INDUCER_COUNT }, (unused, index) => {
    const theta = index * QUARTER_TURN;
    return { x: half * Math.cos(theta), y: half * Math.sin(theta) };
  });
}

/** The length of one side of that square, which the support ratio is a share of. */
export function sideLength(half) {
  return Math.SQRT2 * half;
}

/**
 * The radius an inducer needs for a given support ratio. Each side carries one bite
 * edge from each of its two corners, so the real share of a side is twice the radius
 * over the side's length — which inverts to this.
 */
export function inducerRadius(supportRatio, half) {
  return (supportRatio * sideLength(half)) / 2;
}

/**
 * Everything the sketch is allowed to paint at `step`, as data. Wedges only, except
 * in the reveal, where the plate the figure has been implying is finally drawn and
 * says so in its own kind. A wedge is given as the arc it keeps: the bite is the rest.
 */
export function marksAt(step, half) {
  const radius = inducerRadius(supportRatioAt(step), half);
  const spin = spinAt(step);
  const reveal = revealAt(step);
  const corners = squareCorners(half);
  const marks = corners.map((corner, index) => {
    // The bite opens between the two sides of the square that leave this corner, so
    // its straight edges lie along them. The spin lever turns it off them.
    const toNext = corners[(index + 1) % INDUCER_COUNT];
    const toPrevious = corners[(index + INDUCER_COUNT - 1) % INDUCER_COUNT];
    const towardsNext = Math.atan2(toNext.y - corner.y, toNext.x - corner.x);
    const towardsPrevious = Math.atan2(toPrevious.y - corner.y, toPrevious.x - corner.x);
    // The kept arc runs the long way round, from one side to the other.
    const kept = arcBetween(towardsPrevious, towardsNext);
    return {
      kind: "wedge",
      x: corner.x,
      y: corner.y,
      radius,
      from: towardsPrevious + spin,
      to: towardsPrevious + spin + kept
    };
  });
  if (reveal > 0) {
    // The plate grows out of the middle to exactly the square the bites imply, and
    // shrinks away again. It is opaque, because a square faded in over the inducers
    // would only ever be grey, and the thing being shown is not a grey thing. When it
    // is full it covers each bite exactly, which is the whole claim made visible: the
    // figure you were given and the figure you supplied occupy the same ground.
    marks.push({
      kind: "plate",
      corners: corners.map((corner) => ({ x: corner.x * reveal, y: corner.y * reveal }))
    });
  }
  return marks;
}

/** The angle from `from` round to `to`, taken the long way: a bitten disc's arc. */
function arcBetween(from, to) {
  const direct = ((to - from) % FULL_TURN + FULL_TURN) % FULL_TURN;
  return direct;
}
