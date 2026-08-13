/**
 * A right isosceles triangle has no common measure for its leg and its hypotenuse.
 *
 * Suppose it had: suppose some unit divided the leg exactly q times and the hypotenuse
 * exactly p times, with p and q whole numbers. Then p and q would satisfy p squared equals
 * twice q squared. Fold the triangle — swing a leg onto the hypotenuse and drop a
 * perpendicular where it lands — and out comes another right isosceles triangle, strictly
 * smaller, whose leg and hypotenuse the same unit still measures exactly:
 *
 *     (p, q)  ->  (2q - p, p - q)
 *
 * Both are whole numbers, both positive, and the second is strictly less than q. So the
 * supposed pair would yield a smaller pair, and that one a smaller one, without end. Whole
 * positive numbers cannot do that. There is no such unit, and the ratio of hypotenuse to
 * leg — the square root of two — is not a ratio of whole numbers.
 *
 * What the drawing shows is the same fact laid out as the values p squared minus twice q
 * squared can take. Each value has a curve; a pair of whole numbers on that curve is a pair
 * whose shortfall is exactly that value. Nought is the value a common measure would have,
 * and its curve is the straight line the others crowd towards.
 *
 * The arithmetic here is done entirely in BigInt. Not for range — the numbers are small —
 * but because a BigInt cannot represent a non-integer at all, so no rounding can creep into
 * the step the argument rests on and no test of it can pass by being nearly right. Ordinary
 * numbers appear only below the rule, where curves are being drawn rather than argued from.
 */

/**
 * How far a pair falls short of measuring the triangle: p squared minus n times q squared.
 * It is nought exactly when the pair is the common measure it claims to be.
 */
export function defect(p, q, n = 2n) {
  return p * p - n * q * q;
}

/**
 * The fold, as arithmetic. `n` is which square root is in question — two for the right
 * isosceles triangle, one for a triangle whose "hypotenuse" is its own leg.
 *
 * The fold multiplies the defect by exactly (1 - n). At n = 2 that is minus one: the
 * shortfall keeps its size for ever and merely changes sign, so a pair that measured the
 * triangle exactly would go on measuring it exactly, all the way down. At n = 1 it is
 * nought, and the whole question collapses, which is the difference between the two cases.
 */
export function fold(p, q, n = 2n) {
  return { p: n * q - p, q: p - q };
}

/**
 * Whether the fold takes this pair to a strictly smaller one that is still a pair of
 * positive whole numbers. Asked of the folded pair directly, so that there is no derivation
 * here to get wrong.
 *
 * What makes this the engine of the argument is that it can be re-read as a condition on
 * the defect alone, and the defect of a common measure is nought:
 *
 *     q' = p - q > 0   is   p > q    is   p^2 > q^2     is   defect > (1 - n) q^2
 *     q' = p - q < q   is   p < 2q   is   p^2 < 4q^2    is   defect < (4 - n) q^2
 *     p' = nq - p > 0  is   p < nq   is   p^2 < n^2q^2  is   defect < (n^2 - n) q^2
 *
 * At n = 2 those bounds are -q^2 < defect < 2q^2, an interval that contains nought for
 * every positive q. So it is not that a common measure would happen to descend; it could
 * not fail to. At n = 1 they read 0 < defect < 0, which nothing satisfies — no pair
 * descends at all, and the argument has no engine. That is the difference between a
 * triangle whose hypotenuse cannot be measured against its leg and one whose hypotenuse is
 * its leg. The equivalence is pinned in the tests rather than assumed here.
 */
export function descends(p, q, n = 2n) {
  if (q <= 0n) {
    return false;
  }
  const next = fold(p, q, n);
  return next.p > 0n && next.q > 0n && next.q < q;
}

/**
 * The whole ladder from a starting pair down to wherever it stops.
 *
 * Nothing here says how many rungs there are. The fold is applied for as long as it yields
 * a smaller pair of positive whole numbers, and the ladder is however long that turns out
 * to be — which for a genuine common measure would be for ever.
 */
export function ladder(p, q, n = 2n) {
  const rungs = [{ p, q, defect: defect(p, q, n) }];
  while (descends(rungs.at(-1).p, rungs.at(-1).q, n)) {
    const next = fold(rungs.at(-1).p, rungs.at(-1).q, n);
    rungs.push({ ...next, defect: defect(next.p, next.q, n) });
  }
  return rungs;
}

/** How far out the drawing reaches, in whole numbers of the supposed unit along the leg. */
export const SPAN = 8n;
/** Which shortfalls get a curve: every whole value from minus this to plus this. */
export const SHORTFALL_LIMIT = 17n;

/**
 * Every pair of whole numbers within the drawing whose shortfall is exactly `c`.
 *
 * Searched rather than constructed. Some values of `c` have pairs and some have none, and
 * which are which is not written down anywhere here — it is whatever the search finds. The
 * curve for nought is the one case that can be reasoned about instead of searched, and the
 * search is left to find that too.
 */
export function pairsWithShortfall(c, span = SPAN) {
  const found = [];
  for (let q = 0n; q <= span; q += 1n) {
    const squared = c + 2n * q * q;
    if (squared < 0n) {
      continue;
    }
    const p = squareRoot(squared);
    // A pair of nought and nought is the triangle with no size, which measures nothing.
    if (p * p === squared && (p > 0n || q > 0n)) {
      found.push({ p, q });
    }
  }
  return found;
}

/** Integer square root by bisection, so that no floating point decides what is a square. */
export function squareRoot(value) {
  if (value < 2n) {
    return value;
  }
  let low = 1n;
  let high = value;
  while (low < high) {
    const middle = (low + high + 1n) / 2n;
    if (middle * middle <= value) {
      low = middle;
    } else {
      high = middle - 1n;
    }
  }
  return low;
}

/**
 * The shortfalls that get drawn, each with whatever pairs lie on it. Every whole value in
 * range is here, including the ones that turn out to have no pairs at all: a curve with
 * nothing on it is as much a part of what is being shown as a curve with pairs on it.
 */
export function shortfalls(limit = SHORTFALL_LIMIT, span = SPAN) {
  const all = [];
  for (let c = -limit; c <= limit; c += 1n) {
    all.push({ c, pairs: pairsWithShortfall(c, span) });
  }
  return all;
}

/**
 * The descent, as a walk between curves. Each step lands on the curve of the opposite
 * shortfall, and the walk stops when the fold no longer gives a smaller pair of positive
 * whole numbers. On the curve of nought there is nothing to start from, and a walk that did
 * start there could never stop.
 */
export function walk(p, q) {
  return ladder(p, q).map((rung) => ({ p: rung.p, q: rung.q }));
}

// ---------------------------------------------------------------------------------------
// Drawing. Ordinary numbers from here down; nothing below decides anything above.
// ---------------------------------------------------------------------------------------

/** The slope the curves crowd towards, which is the ratio no pair of whole numbers is. */
export const SLOPE = Math.SQRT2;

export const CANVAS = 680;
export const MARGIN = 48;

/**
 * A pair is drawn as a soft halo with a hard core. The halo is only presence; the core is
 * the pair itself, and it is small enough that the line of nought clears every core in the
 * drawing — which it must, since it passes through no pair at all. Further out the pairs
 * come nearer the line than a core is wide, and still never meet it.
 */
export const BEAD_HALO = 9.6;
export const BEAD_CORE = 3.4;

/**
 * Whole numbers to the drawing. The two axes are scaled differently, so that the curve of
 * nought falls on the diagonal and the fan has the whole of the paper to open into. That is
 * an affine change of units and nothing the picture claims survives or fails by it: conics
 * stay conics, the line stays the line the others crowd towards, and a pair lies on a curve
 * in the drawing exactly when it lies on it in the arithmetic.
 */
export function place(q, p, span = Number(SPAN)) {
  return {
    x: MARGIN + q * ((CANVAS - 2 * MARGIN) / span),
    y: CANVAS - MARGIN - p * ((CANVAS - 2 * MARGIN) / (span * SLOPE))
  };
}

/** How far a drawn point falls from the drawn line of nought, in paper units. */
export function distanceToBareLine(q, p, span = Number(SPAN)) {
  const at = place(q, p, span);
  const from = place(0, 0, span);
  const to = place(span, span * SLOPE, span);
  const run = { x: to.x - from.x, y: to.y - from.y };
  return (
    Math.abs(run.x * (from.y - at.y) - run.y * (from.x - at.x)) / Math.hypot(run.x, run.y)
  );
}

/**
 * The curve of shortfall `c`, sampled as points (q, p) with p the positive root of
 * 2q squared plus c. Below the origin for negative c there is no curve at all until q is
 * large enough for the root to be real, which is why it starts where it starts.
 */
export function curve(c, span, steps = 320) {
  const from = c < 0 ? Math.sqrt(-c / 2) : 0;
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const q = from + ((span - from) * index) / steps;
    // Clamped, because the square root that gives `from` can land a hair under its own
    // square, which would make the first sample of a negative curve imaginary.
    points.push({ q, p: Math.sqrt(Math.max(0, 2 * q * q + c)) });
  }
  return points;
}
