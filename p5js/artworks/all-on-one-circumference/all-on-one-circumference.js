/**
 * Bodies let fall along every chord of one circle, and the two circles they are always on.
 *
 * The sentence this starts from is Sagredo's, in the third day of the Discorsi: bodies
 * descending from one sublime point along inclines of every slope are seen, at every
 * instant, all on one circumference, of circles successively growing. That is Galileo's
 * theorem of the chords in a picture -- every chord from the top of a vertical circle is
 * run in the same time -- and the growing circle is the rim itself shrunk towards the
 * top point by the fraction of the fall that has passed.
 *
 * What is added here is the same theorem's other half, which the sentence leaves in the
 * Latin: every chord to the bottom of the circle is run in the same time too. So a second
 * family of bodies starts on the rim and slides in to the lowest point, always on the rim
 * shrunk towards that point by the fraction of the fall still to go. The two circles
 * have diameters that add up to the rim's, and they touch, on the vertical, at the one
 * body of the sentence's own perpendicular -- the body the odd-number rule is about. The
 * marks it leaves at equal times stand one, three, five and seven units apart. None of
 * this second picture is in the text, and none of it is attributed to it.
 *
 * Everything is a pure function of the frame index, and the claims are held in exact
 * rational arithmetic where they can be: on rational points of the rim the bodies are on
 * their circles as an integer identity, the circles touch exactly, and the strides are
 * integers.
 */
export const LOGICAL_SIZE = 680;
/** The rim's radius on the page; the fall is its whole diameter. */
export const RIM_RADIUS = 240;
/** Points of the rim ten degrees apart. Index 0 is the top, half way round is the bottom. */
export const RIM_POINTS = 36;
/** Equal times in one fall: the ticks at which a stride is marked. */
export const TICKS = 4;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 10;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;
/** The fall, the rest at the bottom, and the clearing back to the top. */
export const ACTS = [["fall", 180], ["rest", 60], ["clear", 60]];
export const FALL_FRAMES = ACTS[0][1];
export const ACT_FRAMES = ACTS.reduce((sum, [, frames]) => sum + frames, 0);

export const TOP = Object.freeze([0, -RIM_RADIUS]);
export const BOTTOM = Object.freeze([0, RIM_RADIUS]);

function integerFrame(frameIndex) {
  if (!Number.isSafeInteger(frameIndex)) {
    throw new TypeError("The frame index must be a safe integer.");
  }
  return ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
}

function rimIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= RIM_POINTS) {
    throw new RangeError("A rim index names one of the rim's points.");
  }
  return index;
}

/**
 * A point of the rim, the top first and going clockwise on the page. The four cardinal
 * points are written down rather than computed, so the top and the bottom are exact and
 * a body that arrives at them arrives exactly.
 */
export function rimPoint(index) {
  const at = rimIndex(index);
  const quarter = RIM_POINTS / 4;
  if (at % quarter === 0) {
    return [[0, -RIM_RADIUS], [RIM_RADIUS, 0], [0, RIM_RADIUS], [-RIM_RADIUS, 0]][at / quarter];
  }
  const angle = -Math.PI / 2 + 2 * Math.PI * at / RIM_POINTS;
  return [RIM_RADIUS * Math.cos(angle), RIM_RADIUS * Math.sin(angle)];
}

/** The rim points that are neither the top nor the bottom: one chord of each family each. */
export function slopedIndices() {
  const indices = [];
  for (let index = 1; index < RIM_POINTS; index += 1) {
    if (index !== RIM_POINTS / 2) indices.push(index);
  }
  return indices;
}

/**
 * The chords the bodies run: every chord from the top, every chord to the bottom, and the
 * perpendicular once, since it belongs to both families and a line laid down twice is
 * one line drawn darker.
 */
export function chords() {
  const lines = [];
  for (const index of slopedIndices()) lines.push({ family: "top", from: TOP, to: rimPoint(index) });
  lines.push({ family: "both", from: TOP, to: BOTTOM });
  for (const index of slopedIndices()) lines.push({ family: "bottom", from: rimPoint(index), to: BOTTOM });
  return lines;
}

/** The act a frame belongs to, and how far through it the frame is. */
export function actAt(frameIndex) {
  const frame = integerFrame(frameIndex);
  let start = 0;
  for (const [name, frames] of ACTS) {
    if (frame < start + frames) {
      return { name, index: frame - start, frames, start };
    }
    start += frames;
  }
  throw new RangeError("The acts do not cover the clip.");
}

/**
 * How much of the fall has passed at a frame: the square of the share of the fall's time,
 * because the spaces grow as the squares of the times. At the ticks the share is a
 * quarter, a half, three quarters and one, so the fraction is exact in binary there.
 */
export function fractionAt(frameIndex, { law = "square" } = {}) {
  const act = actAt(frameIndex);
  if (act.name !== "fall") return 1;
  const share = act.index / FALL_FRAMES;
  if (law === "square") return share * share;
  if (law === "uniform") return share;
  throw new RangeError("The law is the square of the time, or uniform for the control.");
}

/** Interpolation that returns its ends exactly at the ends. */
function between(from, to, fraction) {
  if (fraction === 0) return [from[0], from[1]];
  if (fraction === 1) return [to[0], to[1]];
  return [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction];
}

/**
 * A body of the top family, on the chord from the top to the rim point, at the fraction of
 * the fall that has passed. The chord's length is the diameter times the cosine of its
 * slope, and so is its acceleration, so every body has covered the same fraction of its
 * own chord: the picture of them all is the rim shrunk towards the top.
 *
 * `scaled: false` is the control: the same distance along every chord, whatever its
 * slope. Those bodies lie on a circle centred at the top instead, which is the figure
 * Galileo gives to the other kind of motion, and they do not arrive together.
 */
export function topBody(index, fraction, { scaled = true } = {}) {
  const point = rimPoint(index);
  if (scaled) return between(TOP, point, fraction);
  const length = Math.hypot(point[0] - TOP[0], point[1] - TOP[1]);
  const distance = 2 * RIM_RADIUS * fraction;
  return [TOP[0] + (point[0] - TOP[0]) * distance / length, TOP[1] + (point[1] - TOP[1]) * distance / length];
}

/**
 * A body of the bottom family, on the chord from the rim point to the bottom: it has
 * covered the same fraction of its chord, so what is left of the chord is the rim shrunk
 * towards the bottom by the fraction still to go.
 */
export function bottomBody(index, fraction) {
  return between(rimPoint(index), BOTTOM, fraction);
}

/** The two circles every body is on, and the point where they touch. */
export function circlesAt(fraction) {
  return {
    top: { center: [0, -RIM_RADIUS + RIM_RADIUS * fraction], radius: RIM_RADIUS * fraction },
    bottom: { center: [0, RIM_RADIUS * fraction], radius: RIM_RADIUS * (1 - fraction) },
    kiss: between(TOP, BOTTOM, fraction)
  };
}

/** Everything that stands at one fraction of the fall. */
export function stateAt(fraction) {
  if (!(fraction >= 0 && fraction <= 1)) {
    throw new RangeError("A fraction of the fall lies between nought and one.");
  }
  const sloped = slopedIndices();
  return {
    fraction,
    ...circlesAt(fraction),
    topBodies: sloped.map((index) => topBody(index, fraction)),
    bottomBodies: sloped.map((index) => bottomBody(index, fraction))
  };
}

/** The frames at which the ticks fall: equal times, so equally spaced. */
export function tickFrames() {
  return Array.from({ length: TICKS }, (unused, index) => FALL_FRAMES * (index + 1) / TICKS);
}

/** The fraction of the fall passed at each tick: the squares over the square of the count. */
export function tickFractions({ law = "square" } = {}) {
  return Array.from({ length: TICKS }, (unused, index) => fractionAt(tickFrames()[index], { law }));
}

/**
 * Where the touching point stands at the start and at each tick, in page units, and the
 * strides between them. With the square law the strides are the odd numbers from unity,
 * in units of the diameter over the square of the tick count: thirty pixels here.
 */
export function kissHeights({ law = "square" } = {}) {
  const heights = [TOP[1]];
  for (const fraction of tickFractions({ law })) heights.push(between(TOP, BOTTOM, fraction)[1]);
  return heights;
}

export function strides({ law = "square" } = {}) {
  const heights = kissHeights({ law });
  return heights.slice(1).map((height, index) => height - heights[index]);
}

/**
 * The marks left at the ticks before the last: the two circles as they stood, kept on
 * the page. The last tick's circles are the rim and a point, which are there already.
 */
export function stampsAt(frameIndex) {
  const frame = integerFrame(frameIndex);
  const act = actAt(frame);
  const stamps = [];
  tickFrames().slice(0, TICKS - 1).forEach((tickFrame, index) => {
    if (act.name === "fall" && frame < tickFrame) return;
    // How long the mark has stood, so the sketch can let it flare as it is laid.
    stamps.push({ tick: index + 1, age: frame - tickFrame, ...circlesAt(tickFractions()[index]) });
  });
  return stamps;
}

/**
 * The whole picture at a frame, as layers: the fall and the rest are one layer at the
 * fraction the frame has reached; the clearing lays the finished picture and the opening
 * one over each other, the one fading as the other comes, so that the last frame is a
 * step from the first.
 */
export function sceneAt(frameIndex) {
  const frame = integerFrame(frameIndex);
  const act = actAt(frame);
  const stamps = stampsAt(frame);
  if (act.name !== "clear") {
    return { frameIndex: frame, act: act.name, layers: [{ alpha: 1, state: stateAt(fractionAt(frame)), stamps }] };
  }
  const clearing = act.index / act.frames;
  return {
    frameIndex: frame,
    act: act.name,
    layers: [
      { alpha: 1 - clearing, state: stateAt(1), stamps },
      { alpha: clearing, state: stateAt(0), stamps: [] }
    ]
  };
}

/*
 * Exact arithmetic. The rim is the unit circle, the top is (0, -1) and the bottom (0, 1);
 * a rational rim point is (a/d, b/d) with a^2 + b^2 = d^2, and a tick is k of K. Every
 * coordinate is returned as an integer over one denominator, so a body's place on its
 * circle is an integer identity and not a rounding.
 */
function assertRimPoint(a, b, d) {
  if (![a, b, d].every((value) => typeof value === "bigint")) {
    throw new TypeError("Rational rim coordinates must be BigInts.");
  }
  if (d <= 0n || a * a + b * b !== d * d) {
    throw new RangeError("Use a rational point of the unit circle over a positive denominator.");
  }
}

function assertTick(k, K) {
  if (typeof k !== "bigint" || typeof K !== "bigint" || K <= 0n || k < 0n || k > K) {
    throw new RangeError("A tick is a BigInt from nought to the tick count.");
  }
}

/** The fraction of the fall at tick k of K as a rational: k^2 / K^2, or k / K for the control. */
export function exactFraction(k, K = BigInt(TICKS), { law = "square" } = {}) {
  assertTick(k, K);
  if (law === "square") return { numerator: k * k, denominator: K * K };
  if (law === "uniform") return { numerator: k, denominator: K };
  throw new RangeError("The law is the square of the time, or uniform for the control.");
}

/** The body of a family on the chord of the rim point (a/d, b/d) at tick k of K. */
export function exactBody(family, a, b, d, k, K = BigInt(TICKS), { law = "square" } = {}) {
  assertRimPoint(a, b, d);
  const { numerator: u, denominator: v } = exactFraction(k, K, { law });
  const denominator = d * v;
  if (family === "top") {
    // top + (point - top) * u/v, over d v.
    return { numerator: [a * u, -d * v + (b + d) * u], denominator };
  }
  if (family === "bottom") {
    // point + (bottom - point) * u/v, over d v.
    return { numerator: [a * (v - u), b * v + (d - b) * u], denominator };
  }
  throw new RangeError("A body belongs to the top family or the bottom family.");
}

/** The two circles at tick k of K, each as centre and radius over one denominator. */
export function exactCircles(k, K = BigInt(TICKS), { law = "square" } = {}) {
  const { numerator: u, denominator: v } = exactFraction(k, K, { law });
  return {
    top: { center: [0n, u - v], radius: u, denominator: v },
    bottom: { center: [0n, u], radius: v - u, denominator: v },
    kiss: { numerator: [0n, 2n * u - v], denominator: v }
  };
}

/**
 * The squared distance of a point from a circle's centre less the squared radius, as an
 * integer over the square of the common denominator: nought exactly when the point is on
 * the circle.
 */
export function circleResidue(point, circle) {
  const scale = point.denominator * circle.denominator;
  const dx = point.numerator[0] * circle.denominator - circle.center[0] * point.denominator;
  const dy = point.numerator[1] * circle.denominator - circle.center[1] * point.denominator;
  const radius = circle.radius * point.denominator;
  return { numerator: dx * dx + dy * dy - radius * radius, denominator: scale * scale };
}

export function isExactlyZero(fraction) {
  return fraction.numerator === 0n;
}

/** Two rationals compared without division. */
export function sameRational(left, right) {
  return left.numerator * right.denominator === right.numerator * left.denominator;
}
