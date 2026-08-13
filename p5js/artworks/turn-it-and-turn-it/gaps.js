/**
 * Turn it and turn it: the three-distance theorem.
 *
 * Start anywhere on a circle and turn by the same angle again and again, marking where you
 * land. After any number of turns the marks cut the circle into arcs, and however many
 * marks there are, those arcs are only ever of three lengths — and the longest is exactly
 * the sum of the other two. It does not matter how far you go. Three lengths, always.
 *
 * The angle here is a share of a whole turn equal to the square root of three, less one.
 * The point is that it is irrational: no number of turns ever brings you back to the start,
 * so the marks never stop being new, and yet the gaps between them never stop being three.
 *
 * The arithmetic is exact and it costs nothing to make it so. A mark is where k turns land,
 * which is the fractional part of k times the square root of three less one; that is the
 * same as the fractional part of k times the square root of three, because the two differ
 * by the whole number k. So a mark is exactly
 *
 *     k * sqrt(3)  -  floor(k * sqrt(3))
 *
 * and the floor of k times the square root of three is the whole square root of three k
 * squared, which is a whole number found by bisection. Every mark is therefore a + b*sqrt(3)
 * for whole a and b, and so is every gap, since gaps are differences of marks. Two of those
 * are equal only when both parts match — the square root of three being irrational leaves
 * no other way — so counting how many distinct gap lengths there are is comparing pairs of
 * whole numbers. There is no tolerance anywhere, and nothing here can be nearly equal.
 */

/** The whole square root of a whole number, by bisection, so no rounding decides anything. */
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

/** Which root is turned by: three, so the share of a turn is its root less one. */
export const ROOT = 3n;

/**
 * The sign of a + b*sqrt(root), decided in whole numbers. Squaring is only safe once the
 * two sides are known to be positive, which is what the branches are for.
 */
export function signOf(a, b, root = ROOT) {
  if (b === 0n) {
    return a === 0n ? 0 : (a > 0n ? 1 : -1);
  }
  if (b > 0n) {
    if (a >= 0n) {
      return 1;
    }
    const left = root * b * b;
    const right = a * a;
    return left > right ? 1 : (left === right ? 0 : -1);
  }
  if (a <= 0n) {
    return -1;
  }
  const left = a * a;
  const right = root * b * b;
  return left > right ? 1 : (left === right ? 0 : -1);
}

export const compare = (first, second, root = ROOT) =>
  signOf(first.a - second.a, first.b - second.b, root);
export const minus = (first, second) => ({ a: first.a - second.a, b: first.b - second.b });
export const plus = (first, second) => ({ a: first.a + second.a, b: first.b + second.b });
/** Two lengths are the same length exactly when both whole parts agree. */
export const nameOf = (length) => `${length.a}|${length.b}`;

/**
 * Where the k-th turn lands, exactly. Whole numbers in, whole numbers out: the mark is
 * -floor(k*sqrt(3)) + k*sqrt(3), which lies in [0, 1) by construction.
 */
export function markAt(k, root = ROOT) {
  return { a: -squareRoot(root * k * k), b: k };
}

/** The marks after `turns` turns, the start among them, in the order they lie on the circle. */
export function marksUpTo(turns, root = ROOT) {
  const marks = [];
  for (let k = 0n; k <= turns; k += 1n) {
    marks.push(markAt(k, root));
  }
  return marks.sort((first, second) => compare(first, second, root));
}

/**
 * The arcs the marks cut the circle into, in order round the circle. There are as many arcs
 * as marks, the last running from the final mark round through the start.
 */
export function gapsUpTo(turns, root = ROOT) {
  const marks = marksUpTo(turns, root);
  const gaps = [];
  for (let index = 0; index < marks.length - 1; index += 1) {
    gaps.push(minus(marks[index + 1], marks[index]));
  }
  gaps.push(minus({ a: marks[0].a + 1n, b: marks[0].b }, marks.at(-1)));
  return gaps;
}

/**
 * The distinct lengths among those arcs, shortest first. The theorem says there are never
 * more than three of them; nothing here enforces that, it is measured and returned.
 */
export function lengthsUpTo(turns, root = ROOT) {
  const distinct = new Map();
  for (const gap of gapsUpTo(turns, root)) {
    distinct.set(nameOf(gap), gap);
  }
  return [...distinct.values()].sort((first, second) => compare(first, second, root));
}

/**
 * Each arc of the circle at this stage, in order, with which of the distinct lengths it is.
 *
 * The role is what the drawing colours by, and it is shortest, middle or longest rather
 * than first, second or third. The difference matters on the stages that come out with only
 * two lengths: numbering those one and two would give the longer of them the colour that
 * means "the middle one" everywhere else, and a colour would stop meaning a length. Here
 * the two are shortest and longest, and the middle colour is simply absent — which is the
 * honest picture of a stage that has no middle length.
 */
export const SHORTEST = 0;
export const MIDDLE = 1;
export const LONGEST = 2;

export function ringAt(turns, root = ROOT) {
  const lengths = lengthsUpTo(turns, root);
  const roleOf = new Map();
  lengths.forEach((length, index) => {
    if (index === 0) {
      roleOf.set(nameOf(length), SHORTEST);
    } else if (index === lengths.length - 1) {
      roleOf.set(nameOf(length), LONGEST);
    } else {
      roleOf.set(nameOf(length), MIDDLE);
    }
  });
  const marks = marksUpTo(turns, root);
  return {
    turns,
    lengths,
    arcs: gapsUpTo(turns, root).map((gap, index) => ({
      from: marks[index],
      gap,
      role: roleOf.get(nameOf(gap))
    }))
  };
}

/**
 * How far the k-th turn lands short of the start, and how far past it: the mark itself, and
 * what is left of the circle after it. One of the two is how near that turn came to landing
 * back where it began, depending on which way round you count.
 */
export function shortOf(k, root = ROOT) {
  return markAt(k, root);
}

export function pastBy(k, root = ROOT) {
  const mark = markAt(k, root);
  return { a: 1n - mark.a, b: -mark.b };
}

/**
 * The turn counts that come nearer to landing back at the start than any turn count before
 * them, counting the two ways round separately.
 *
 * Separately is the point. A turn can be the best yet at creeping up on the start from one
 * side without beating the best from the other, and both kinds count. Nothing about the
 * rings is used here: this is a record of one quantity, measured turn by turn in whole
 * numbers, and it does not know that any circle has been cut into anything.
 *
 * It is worth having for what it turns out to coincide with. A stage whose arcs come in
 * only two lengths is one where the marks have cut the circle about as evenly as that many
 * marks can, which is the same thing as the turning having come round almost exactly. The
 * first turn is a record only because nothing precedes it, and there is no stage before the
 * first, so that one has nothing to correspond to. The tests hold the two lists against
 * each other rather than either being assumed.
 */
export function closestReturns(limit, root = ROOT) {
  const records = [];
  let bestShort = null;
  let bestPast = null;
  for (let k = 1n; k <= limit; k += 1n) {
    const short = shortOf(k, root);
    const past = pastBy(k, root);
    const beatsShort = bestShort === null || compare(short, bestShort, root) < 0;
    const beatsPast = bestPast === null || compare(past, bestPast, root) < 0;
    if (beatsShort) {
      bestShort = short;
    }
    if (beatsPast) {
      bestPast = past;
    }
    if (beatsShort || beatsPast) {
      records.push(k);
    }
  }
  return records;
}

/** A share of a whole turn as an ordinary number, for drawing and for nothing else. */
export const asTurn = (length, root = Number(ROOT)) =>
  Number(length.a) + Number(length.b) * Math.sqrt(root);

/**
 * The stage a rational turn reaches, for the control. Turning by p/q of a circle lands on
 * exactly q marks and then repeats for ever, and every arc is the same length — which is
 * what makes an irrational turn worth drawing.
 */
export function rationalGaps(p, q, turns) {
  const seen = new Set();
  for (let k = 0n; k <= turns; k += 1n) {
    seen.add(((k * p) % q + q) % q);
  }
  const places = [...seen].sort((first, second) => (first < second ? -1 : first > second ? 1 : 0));
  const gaps = [];
  for (let index = 0; index < places.length - 1; index += 1) {
    gaps.push(places[index + 1] - places[index]);
  }
  gaps.push(places[0] + q - places.at(-1));
  return { places: places.length, gaps, distinct: new Set(gaps).size };
}
