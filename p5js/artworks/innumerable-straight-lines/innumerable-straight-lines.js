/**
 * Thirty-six straight rods between two collars, and the collars turned against each other.
 *
 * Every rod keeps its length and its two ends stay on their collars; turning the collars
 * in opposite directions can only draw the collars together and the rods inwards, and the
 * surface the rods lie on is then a hyperboloid of one sheet -- a surface curved both
 * ways that nonetheless has straight lines all over it, which is the sentence of Wren's
 * the work is named from. Nothing here is a force: the model is the kinematics of rigid
 * rods on rigid rings, and it calculates neither tension nor gravity nor any material.
 *
 * Coordinates are the sculpture's own: `x` and `z` across the collars, `y` up. The
 * collars stand at `±height / 2`, the lower one turned back by half the twist and the
 * upper one forward by half, so the waist stays centred and every rod's chord is one
 * length. The sketch maps them onto its stage.
 */
export const WIDTH = 960;
export const HEIGHT = 640;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 12;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

export const ROD_COUNT = 36;
/** Every sixth rod is the thicker, paler one; the turntable's closure rests on the six. */
export const ACCENT_EVERY = 6;
export const RADIUS = 1;
/**
 * The rational pin. With the collars' radius one and the rods thirteen fifths long, a
 * full twist whose half-angle has sine twelve thirteenths and cosine five thirteenths
 * gives a height of one hundred and nineteen sixty-fifths and a waist of five
 * thirteenths -- every one of them a rational, so the surface can be held as an
 * integer identity rather than to a tolerance.
 */
export const ROD_LENGTH = 13 / 5;
export const HALF_SINE = 12 / 13;
export const HALF_COSINE = 5 / 13;
export const MAX_TWIST = 2 * Math.asin(HALF_SINE);
export const FULL_HEIGHT = 119 / 65;
export const WAIST = 5 / 13;

/** The stage's whole turn over the clip: a sixth, which the accents' period closes. */
export const TURNTABLE = Math.PI / 3;

export function eased(t) {
  return t * t * (3 - 2 * t);
}

/** The collars' separation at a twist: what is left of the rod once its chord is taken. */
export function heightAt(twist) {
  const chord = 2 * RADIUS * Math.sin(twist / 2);
  return Math.sqrt(ROD_LENGTH * ROD_LENGTH - chord * chord);
}

export function waistAt(twist) {
  return RADIUS * Math.cos(twist / 2);
}

/** Every rod's two ends at a twist, the lower collar turned back and the upper forward. */
export function structureAt(twist) {
  if (!(twist >= 0 && twist <= MAX_TWIST)) {
    throw new RangeError("The twist runs from nought to the full twist.");
  }
  const half = twist / 2;
  const height = heightAt(twist);
  const rods = [];
  for (let index = 0; index < ROD_COUNT; index += 1) {
    const bearing = 2 * Math.PI * index / ROD_COUNT;
    rods.push({
      index,
      accent: index % ACCENT_EVERY === 0,
      bottom: [RADIUS * Math.cos(bearing - half), -height / 2, RADIUS * Math.sin(bearing - half)],
      top: [RADIUS * Math.cos(bearing + half), height / 2, RADIUS * Math.sin(bearing + half)]
    });
  }
  return { twist, height, waist: waistAt(twist), rods };
}

/*
 * The clip: the collars rest untwisted, twist to the full pin, rest, untwist and rest,
 * while the stage turns a sixth of a turn, so that the last frame is the first.
 */
export const ACTS = [["open", 30], ["twist", 120], ["closed", 60], ["untwist", 120], ["open", 30]];
export const ACT_FRAMES = ACTS.reduce((sum, [, frames]) => sum + frames, 0);

export function actAt(frameIndex) {
  if (!Number.isSafeInteger(frameIndex)) {
    throw new TypeError("The frame index must be a safe integer.");
  }
  const frame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  let start = 0;
  for (const [name, frames] of ACTS) {
    if (frame < start + frames) {
      return { frame, name, progress: (frame - start) / frames };
    }
    start += frames;
  }
  throw new RangeError("The acts do not cover the clip.");
}

/** The lever: nought untwisted, one at the full twist. */
export function leverAtFrame(frameIndex) {
  const { name, progress } = actAt(frameIndex);
  if (name === "open") return 0;
  if (name === "closed") return 1;
  if (name === "twist") return eased(progress);
  return 1 - eased(progress);
}

/** The twist the lever stands for; both ends are returned exactly. */
export function twistAtLever(lever) {
  if (!(lever >= 0 && lever <= 1)) {
    throw new RangeError("The lever runs from nought to one.");
  }
  if (lever === 0) return 0;
  if (lever === 1) return MAX_TWIST;
  return MAX_TWIST * lever;
}

export function spinAtFrame(frameIndex) {
  const { frame } = actAt(frameIndex);
  return TURNTABLE * frame / TOTAL_FRAMES;
}

export function sceneAt(frameIndex) {
  const { frame } = actAt(frameIndex);
  const lever = leverAtFrame(frame);
  return { frameIndex: frame, lever, spin: spinAtFrame(frame), ...structureAt(twistAtLever(lever)) };
}

/*
 * Exact arithmetic, at the full twist.
 *
 * A rational point of the unit circle, `(a / d, b / d)` with `a² + b² = d²`, is a rod's
 * bearing; the collars' turn by the half-angle is a multiplication by `(5 ∓ 12 i) / 13`,
 * which keeps the point rational. So a rod's two ends are rational, its squared length
 * is an integer identity, and a rational point along it can be put into the surface's
 * equation with a residue of exactly nought. Values are `{ numerator, denominator }`
 * with BigInt parts, or numerators over a shared denominator.
 */
const RADIUS_N = 1n;

function assertBigInts(values) {
  if (!values.every((value) => typeof value === "bigint")) {
    throw new TypeError("Exact coordinates must be BigInts.");
  }
}

/** The pin's numbers, as integers over their denominators, so a test can pass a wrong one. */
export const EXACT_PIN = Object.freeze({
  sine: { numerator: 12n, denominator: 13n },
  cosine: { numerator: 5n, denominator: 13n },
  length: { numerator: 13n, denominator: 5n },
  height: { numerator: 119n, denominator: 65n }
});

function times(p, q) {
  return { numerator: p.numerator * q.numerator, denominator: p.denominator * q.denominator };
}

function plus(p, q) {
  return { numerator: p.numerator * q.denominator + q.numerator * p.denominator, denominator: p.denominator * q.denominator };
}

function minus(p, q) {
  return { numerator: p.numerator * q.denominator - q.numerator * p.denominator, denominator: p.denominator * q.denominator };
}

function equal(p, q) {
  return p.numerator * q.denominator === q.numerator * p.denominator;
}

/**
 * A rod's two ends at the full twist, from its rational bearing: the bottom end is the
 * bearing turned back by the half-angle, the top end turned forward, at heights
 * `∓ height / 2`.
 */
export function exactRod(a, b, d, pin = EXACT_PIN) {
  assertBigInts([a, b, d]);
  if (d <= 0n || a * a + b * b !== d * d) {
    throw new RangeError("Use a rational unit point and a positive denominator.");
  }
  const bearing = { x: { numerator: a * RADIUS_N, denominator: d }, z: { numerator: b * RADIUS_N, denominator: d } };
  const { sine, cosine, height } = pin;
  // (x + i z)(cos ∓ i sin): back for the bottom, forward for the top.
  const bottom = {
    x: plus(times(bearing.x, cosine), times(bearing.z, sine)),
    y: { numerator: -height.numerator, denominator: 2n * height.denominator },
    z: minus(times(bearing.z, cosine), times(bearing.x, sine))
  };
  const top = {
    x: minus(times(bearing.x, cosine), times(bearing.z, sine)),
    y: { numerator: height.numerator, denominator: 2n * height.denominator },
    z: plus(times(bearing.z, cosine), times(bearing.x, sine))
  };
  return { bottom, top };
}

/** Whether a rod end lies on its collar: `x² + z² = R²` exactly. */
export function exactlyOnCollar(end) {
  const radial = plus(times(end.x, end.x), times(end.z, end.z));
  return equal(radial, { numerator: RADIUS_N * RADIUS_N, denominator: 1n });
}

/** The rod's squared length, exactly, against the pin's `L²`. */
export function exactlyRodLength(rod, pin = EXACT_PIN) {
  const dx = minus(rod.top.x, rod.bottom.x);
  const dy = minus(rod.top.y, rod.bottom.y);
  const dz = minus(rod.top.z, rod.bottom.z);
  const squared = plus(plus(times(dx, dx), times(dy, dy)), times(dz, dz));
  return equal(squared, times(pin.length, pin.length));
}

/** The point a rational share `u` of the way up a rod. */
export function exactPointOnRod(rod, u) {
  if (typeof u.numerator !== "bigint" || typeof u.denominator !== "bigint" || u.denominator <= 0n) {
    throw new TypeError("The share along the rod is a rational with BigInt parts.");
  }
  return {
    x: plus(rod.bottom.x, times(u, minus(rod.top.x, rod.bottom.x))),
    y: plus(rod.bottom.y, times(u, minus(rod.top.y, rod.bottom.y))),
    z: plus(rod.bottom.z, times(u, minus(rod.top.z, rod.bottom.z)))
  };
}

/**
 * Whether a point lies on the hyperboloid the rods span at the full twist:
 * `x² + z² − w² = (2y / h)² (R² − w²)`, with `w` the waist `cos` and `h` the height.
 */
export function exactlyOnHyperboloid(point, pin = EXACT_PIN) {
  const waist = times(pin.cosine, { numerator: RADIUS_N, denominator: 1n });
  const left = minus(plus(times(point.x, point.x), times(point.z, point.z)), times(waist, waist));
  const share = times({ numerator: 2n, denominator: 1n }, times(point.y, { numerator: pin.height.denominator, denominator: pin.height.numerator }));
  const right = times(times(share, share), minus({ numerator: RADIUS_N * RADIUS_N, denominator: 1n }, times(waist, waist)));
  return equal(left, right);
}
