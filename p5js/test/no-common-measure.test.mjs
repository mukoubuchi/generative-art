import assert from "node:assert/strict";
import test from "node:test";
import {
  BEAD_CORE,
  SHORTFALL_LIMIT,
  SPAN,
  curve,
  defect,
  descends,
  distanceToBareLine,
  fold,
  ladder,
  pairsWithShortfall,
  place,
  shortfalls,
  squareRoot
} from "../artworks/no-common-measure/descent.js";

/**
 * The artwork's claim is that no pair of whole numbers measures both the leg and the
 * hypotenuse of a right isosceles triangle — that the curve of nought carries nothing.
 *
 * A claim of absence is the easy kind to fake, so these hold it from several sides. The
 * fold is shown to keep the shortfall's size exactly, so a pair that measured the triangle
 * would keep measuring it all the way down. The descent is shown to be forced rather than
 * lucky: the condition for it re-reads as a condition on the shortfall, and nought always
 * satisfies it. Descents are shown to be finite, so the two together are a contradiction.
 * And the control changes one number — the two becomes a four — at which point the pairs
 * that never appeared appear in quantity, under the same rule and the same search.
 *
 * Every one of these is done in BigInt. A BigInt cannot hold a non-integer, so none of them
 * can pass by being nearly right.
 */

const CURVES = shortfalls();

/** How far a point falls from a drawn polyline, measured along its segments. */
function distanceToPath(at, path) {
  let closest = Infinity;
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    const along = lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((at.x - from.x) * dx + (at.y - from.y) * dy) / lengthSquared));
    closest = Math.min(closest, Math.hypot(from.x + along * dx - at.x, from.y + along * dy - at.y));
  }
  return closest;
}

test("the fold keeps the shortfall's size exactly, and only turns it round", () => {
  // The invariant the whole argument rests on: (2q - p)^2 - 2(p - q)^2 == -(p^2 - 2q^2).
  // A pair whose shortfall is nought therefore folds to another whose shortfall is nought.
  // Held over a grid rather than at a few points, and in integers, so "exactly" means it.
  let checked = 0;
  for (let p = -40n; p <= 40n; p += 1n) {
    for (let q = -40n; q <= 40n; q += 1n) {
      const next = fold(p, q);
      assert.equal(defect(next.p, next.q), -defect(p, q));
      checked += 1;
    }
  }
  assert.equal(checked, 81 * 81);
  // And the sizes really do vary over that grid, so the equality is not holding because
  // everything in sight is nought.
  const sizes = new Set();
  for (let p = 0n; p <= 20n; p += 1n) {
    for (let q = 0n; q <= 20n; q += 1n) {
      sizes.add(defect(p, q));
    }
  }
  assert.ok(sizes.size > 90, `only ${sizes.size} different shortfalls in the sample`);
});

test("a pair that measured the triangle could not fail to descend", () => {
  // The engine. `descends` asks the folded pair directly; here it is shown to be the same
  // as a condition on the shortfall alone — which is what lets it be applied to a pair
  // nobody can exhibit. Both sides vary over the grid, so this is not vacuous.
  let descending = 0;
  let standing = 0;
  for (let p = 0n; p <= 60n; p += 1n) {
    for (let q = 1n; q <= 60n; q += 1n) {
      const shortfall = defect(p, q);
      const byShortfall = shortfall > -(q * q) && shortfall < 2n * q * q;
      assert.equal(descends(p, q), byShortfall, `p=${p} q=${q}`);
      if (byShortfall) {
        descending += 1;
      } else {
        standing += 1;
      }
    }
  }
  assert.ok(descending > 400 && standing > 400, `${descending} descending, ${standing} not`);

  // And nought lies inside those bounds for every positive q. This is the step that makes
  // the descent forced: not that such a pair would happen to descend, but that no positive
  // q could put it outside the interval.
  for (let q = 1n; q <= 400n; q += 1n) {
    assert.ok(-(q * q) < 0n && 0n < 2n * q * q, `nought escapes the bounds at q=${q}`);
  }
});

test("every descent from a pair of whole numbers runs out", () => {
  // The other half of the contradiction. Whatever it starts from, the ladder is finite and
  // ends where the fold stops giving a smaller pair of positive whole numbers. A pair with
  // shortfall nought would have to descend for ever by the test above, and cannot by this
  // one, so there is no such pair.
  let longest = 0;
  let started = 0;
  for (let p = 1n; p <= 120n; p += 1n) {
    for (let q = 1n; q <= 120n; q += 1n) {
      const rungs = ladder(p, q);
      assert.ok(rungs.length >= 1);
      assert.ok(!descends(rungs.at(-1).p, rungs.at(-1).q), `ladder from ${p}/${q} stopped early`);
      // Strictly decreasing in q the whole way down: no step stands still or climbs.
      for (let index = 1; index < rungs.length; index += 1) {
        assert.ok(rungs[index].q < rungs[index - 1].q);
        assert.ok(rungs[index].q > 0n && rungs[index].p > 0n);
      }
      longest = Math.max(longest, rungs.length);
      started += 1;
    }
  }
  assert.equal(started, 120 * 120);
  // Liveness: some of those ladders are long, so "finite" is not standing in for "never
  // moved". And short enough to confirm how fast the descent bites.
  assert.ok(longest >= 6 && longest <= 12, `the longest ladder was ${longest} rungs`);
});

test("the size of the shortfall never changes along a descent", () => {
  // Perlin's invariant seen along the orbits rather than as an identity: a near miss stays
  // a near miss of exactly the same size, all the way to the bottom. This is why the
  // descent can never wear a shortfall away and arrive at a common measure.
  for (const [p, q] of [[239n, 169n], [99n, 70n], [41n, 29n], [17n, 12n], [11n, 7n], [50n, 33n]]) {
    const rungs = ladder(p, q);
    const sizes = new Set(rungs.map((rung) => (rung.defect < 0n ? -rung.defect : rung.defect)));
    assert.equal(sizes.size, 1, `the shortfall changed size descending from ${p}/${q}`);
    // And it alternates in sign, which is what "turns it round" means.
    for (let index = 1; index < rungs.length; index += 1) {
      assert.equal(rungs[index].defect, -rungs[index - 1].defect);
    }
  }
  assert.deepEqual(
    ladder(239n, 169n).map((rung) => [Number(rung.p), Number(rung.q), Number(rung.defect)]),
    [[239, 169, -1], [99, 70, 1], [41, 29, -1], [17, 12, 1], [7, 5, -1], [3, 2, 1], [1, 1, -1]]
  );
});

test("nothing sits on the curve of nought, and changing one number puts it there", () => {
  // The negative control, and the point of the artwork stated from the other side. The same
  // search that finds nothing for a triangle whose hypotenuse is root two times its leg
  // finds plenty the moment the two is a four.
  let onNought = 0;
  let searched = 0;
  for (let p = 1n; p <= 400n; p += 1n) {
    for (let q = 1n; q <= 400n; q += 1n) {
      if (defect(p, q, 2n) === 0n) {
        onNought += 1;
      }
      searched += 1;
    }
  }
  assert.equal(onNought, 0, "a pair measured the triangle after all");
  assert.equal(searched, 400 * 400);

  // Three, likewise nothing. Four, and they are everywhere — every p that is twice its q.
  let onNoughtThree = 0;
  let onNoughtFour = 0;
  for (let p = 1n; p <= 400n; p += 1n) {
    for (let q = 1n; q <= 400n; q += 1n) {
      if (defect(p, q, 3n) === 0n) {
        onNoughtThree += 1;
      }
      if (defect(p, q, 4n) === 0n) {
        onNoughtFour += 1;
      }
    }
  }
  assert.equal(onNoughtThree, 0);
  assert.equal(onNoughtFour, 200, "the control found no pairs either, so it controls nothing");
});

test("where the hypotenuse is the leg, no pair descends and pairs exist", () => {
  // The contrast that says the descent is doing the work. At n = 1 the bounds on the
  // shortfall read 0 < shortfall < 0, so nothing descends at all — and sure enough the
  // pairs that would have been descended away are simply there, one for every whole number.
  for (let p = 0n; p <= 60n; p += 1n) {
    for (let q = 1n; q <= 60n; q += 1n) {
      assert.equal(descends(p, q, 1n), false, `${p}/${q} descended where nothing should`);
    }
  }
  for (let k = 1n; k <= 40n; k += 1n) {
    assert.equal(defect(k, k, 1n), 0n);
    assert.equal(ladder(k, k, 1n).length, 1, "a common measure was descended away");
  }
  // So "able to descend" and "no such pair" stand or fall together, which is the argument.
  assert.equal(descends(17n, 12n, 2n), true);
  assert.equal(descends(17n, 12n, 1n), false);
});

test("some shortfalls have pairs and some have none, and which is not written down", () => {
  // The vacuity guard for the picture. If every curve carried beads, or none did, the bare
  // line would say nothing by being bare. The counts are pinned so that a change to the
  // search or the span has to be looked at.
  const beaded = CURVES.filter((entry) => entry.pairs.length > 0).map((entry) => Number(entry.c));
  const bare = CURVES.filter((entry) => entry.pairs.length === 0).map((entry) => Number(entry.c));
  assert.equal(CURVES.length, 2 * Number(SHORTFALL_LIMIT) + 1);
  assert.deepEqual(beaded, [-17, -16, -14, -9, -8, -7, -4, -2, -1, 1, 2, 4, 7, 8, 9, 14, 16, 17]);
  assert.deepEqual(bare, [-15, -13, -12, -11, -10, -6, -5, -3, 0, 3, 5, 6, 10, 11, 12, 13, 15]);
  assert.ok(bare.includes(0), "the curve of nought is not among the bare ones");
  assert.equal(CURVES.reduce((total, entry) => total + entry.pairs.length, 0), 33);

  // The bare ones are not merely bare within the drawing. Every one of them stays empty out
  // to a leg count five hundred times the drawing's, which is why nought does not stand out
  // as the one value somebody decided to leave alone.
  for (const size of [3n, 5n, 6n, 10n, 11n, 12n, 13n, 15n]) {
    for (const c of [size, -size]) {
      assert.equal(pairsWithShortfall(c, 4000n).length, 0, `${c} turned out to have a pair`);
    }
  }
  // While the beaded ones go on having pairs far beyond the edge of the picture. They thin
  // out as they go — the pairs on a given curve grow by a factor of about six each time —
  // so a handful over that range is a lot, and none at all is the difference being drawn.
  for (const c of [1n, -1n, 2n, -2n, 7n, -7n]) {
    assert.ok(pairsWithShortfall(c, 600n).length >= 4, `${c} ran out of pairs`);
  }
});

test("every pair the search found really is on its curve, exactly", () => {
  // The picture and the arithmetic are the same thing: a bead is drawn where a pair is, and
  // a pair is where the shortfall is exactly that curve's value, in integers.
  let beads = 0;
  for (const { c, pairs } of CURVES) {
    for (const pair of pairs) {
      assert.equal(defect(pair.p, pair.q), c);
      assert.equal(typeof pair.p, "bigint");
      assert.ok(pair.q <= SPAN && pair.q >= 0n);
      assert.ok(pair.p > 0n || pair.q > 0n, "the triangle with no size was counted as a pair");
      beads += 1;
    }
  }
  assert.equal(beads, 33);

  // And the drawn curve passes through the drawn bead, so the beads sit on the curves in
  // the picture and not merely in the arithmetic. Measured to the drawn segments rather
  // than to the sampled corners: where a curve turns steeply its corners are far apart, and
  // taking the corners alone would report a bead as off a curve it is drawn exactly on.
  for (const { c, pairs } of CURVES) {
    if (pairs.length === 0) {
      continue;
    }
    const drawn = curve(Number(c), Number(SPAN)).map((point) => place(point.q, point.p));
    for (const pair of pairs) {
      const at = place(Number(pair.q), Number(pair.p));
      const away = distanceToPath(at, drawn);
      assert.ok(away < 0.4, `the bead at ${pair.p}/${pair.q} is ${away} from its curve`);
    }
  }
});

test("the drawn line of nought passes through no bead at all", () => {
  // What a viewer is asked to see, checked as a fact about the drawing rather than only
  // about the numbers. Every bead's core stands clear of the line, and the nearest one is
  // named so that the margin cannot quietly become nothing.
  let closest = Infinity;
  let nearestPair = null;
  for (const { pairs } of CURVES) {
    for (const pair of pairs) {
      const away = distanceToBareLine(Number(pair.q), Number(pair.p));
      if (away < closest) {
        closest = away;
        nearestPair = [Number(pair.p), Number(pair.q)];
      }
    }
  }
  assert.deepEqual(nearestPair, [7, 5]);
  assert.ok(closest > BEAD_CORE / 2,
    `the line covers the core of the bead at ${nearestPair}: ${closest} away, core ${BEAD_CORE}`);
  // The line only touches nothing because nothing is there to touch: the arithmetic, again.
  assert.equal(CURVES.find((entry) => entry.c === 0n).pairs.length, 0);
  assert.equal(distanceToBareLine(0, 0), 0, "the line does not start at the origin");
});

test("no floating point decides anything the argument uses", () => {
  // Squares are recognised by integer bisection, not by rounding a square root, so a value
  // one away from a square cannot be mistaken for one.
  for (let value = 0n; value <= 2000n; value += 1n) {
    const root = squareRoot(value);
    assert.equal(typeof root, "bigint");
    assert.ok(root * root <= value && (root + 1n) * (root + 1n) > value, `root of ${value}`);
  }
  assert.equal(squareRoot(9007199254740993n * 9007199254740993n), 9007199254740993n);
  // Everything the argument returns is a whole number by type, not by convention.
  const rung = ladder(99n, 70n).at(-1);
  for (const value of [defect(3n, 2n), fold(3n, 2n).p, fold(3n, 2n).q, rung.p, rung.q, rung.defect]) {
    assert.equal(typeof value, "bigint");
  }
  assert.deepEqual(shortfalls(), CURVES);
});
