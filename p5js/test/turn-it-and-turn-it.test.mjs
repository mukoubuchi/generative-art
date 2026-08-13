import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { P5JS_DIRECTORY } from "../lib/catalog.mjs";
import {
  LONGEST,
  MIDDLE,
  ROOT,
  SHORTEST,
  asTurn,
  closestReturns,
  compare,
  gapsUpTo,
  lengthsUpTo,
  markAt,
  marksUpTo,
  nameOf,
  plus,
  rationalGaps,
  ringAt,
  squareRoot
} from "../artworks/turn-it-and-turn-it/gaps.js";

/**
 * The artwork's claim is the three-distance theorem: turn by the same irrational share of a
 * circle as often as you like, and the arcs between the marks come in at most three lengths,
 * the longest being the sum of the other two.
 *
 * The whole point of these tests is that "the same length" needs no tolerance. A mark is
 * exactly -floor(k*sqrt(3)) + k*sqrt(3), a whole-number pair, and so is every gap; two are
 * equal only when both parts agree. So counting distinct lengths is comparing pairs of whole
 * numbers, and a fourth length could not hide inside a rounding error.
 */

const STAGES = 96n;
const RINGS = Array.from({ length: Number(STAGES) }, (unused, index) => ringAt(BigInt(index + 1)));

test("however many marks there are, the arcs come in at most three lengths", () => {
  // The theorem. Nothing in the module caps the count: `lengthsUpTo` returns however many
  // distinct pairs it finds, and a fourth would simply be returned.
  let mostSeen = 0;
  const counts = new Map();
  for (let turns = 1n; turns <= 260n; turns += 1n) {
    const lengths = lengthsUpTo(turns);
    mostSeen = Math.max(mostSeen, lengths.length);
    counts.set(lengths.length, (counts.get(lengths.length) ?? 0) + 1);
    assert.ok(lengths.length <= 3, `${lengths.length} lengths after ${turns} turns`);
  }
  assert.equal(mostSeen, 3);
  // The vacuity guard: three is not standing in for "always the same". Both counts occur,
  // and three is much the commoner.
  assert.ok(counts.get(3) > 200, `only ${counts.get(3)} stages had three lengths`);
  assert.ok(counts.get(2) >= 10, `only ${counts.get(2)} stages had two`);
  assert.equal(counts.get(1) ?? 0, 0, "a stage came out with a single length");
});

test("the longest arc is exactly the other two put together", () => {
  // Exactly: whole part against whole part, no tolerance. This is what makes the picture's
  // colours mean something — the longest is what splits, and it splits into the other two.
  let checked = 0;
  for (let turns = 1n; turns <= 260n; turns += 1n) {
    const lengths = lengthsUpTo(turns);
    if (lengths.length !== 3) {
      continue;
    }
    assert.equal(nameOf(plus(lengths[0], lengths[1])), nameOf(lengths[2]));
    checked += 1;
  }
  assert.ok(checked > 200, `only ${checked} three-length stages were checked`);
});

test("the arcs close the circle exactly, every time", () => {
  // If the gaps did not add to one whole turn the lengths would be measuring something
  // other than the circle. One and nought lots of root three, not nearly.
  for (let turns = 1n; turns <= 200n; turns += 1n) {
    const total = gapsUpTo(turns).reduce(plus, { a: 0n, b: 0n });
    assert.equal(total.a, 1n);
    assert.equal(total.b, 0n);
    assert.equal(gapsUpTo(turns).length, Number(turns) + 1, "an arc went missing");
  }
});

test("one more turn cuts exactly one arc in two and leaves the rest alone", () => {
  // The mechanism, and the reason the picture has walls running outward rather than a new
  // arrangement at every ring. It is also why the theorem holds: what gets cut is a longest
  // arc, and it is cut into the other two lengths.
  for (let turns = 1n; turns <= 120n; turns += 1n) {
    const before = gapsUpTo(turns).map(nameOf).sort();
    const after = gapsUpTo(turns + 1n).map(nameOf).sort();
    // Everything but one arc survives untouched.
    const survived = [...after];
    const lost = [];
    for (const gap of before) {
      const at = survived.indexOf(gap);
      if (at === -1) {
        lost.push(gap);
      } else {
        survived.splice(at, 1);
      }
    }
    assert.equal(lost.length, 1, `${lost.length} arcs vanished at turn ${turns + 1n}`);
    assert.equal(survived.length, 2, `the cut arc did not become two at turn ${turns + 1n}`);
    // And the piece that vanished was the two pieces that appeared, put together.
    const pieces = survived.map((name) => {
      const [a, b] = name.split("|");
      return { a: BigInt(a), b: BigInt(b) };
    });
    assert.equal(nameOf(plus(pieces[0], pieces[1])), lost[0]);
    // What was cut was a longest arc of its stage.
    assert.equal(lost[0], nameOf(lengthsUpTo(turns).at(-1)));
  }
});

test("a colour means a length, at every stage including the two-length ones", () => {
  // The picture colours by role, not by which of the lengths came first. On a stage with
  // only two lengths the two are shortest and longest and the middle colour is simply
  // absent — numbering them one and two would hand the longer of them the colour that means
  // "the middle one" everywhere else, and a colour would stop meaning a length.
  for (const ring of RINGS) {
    const roles = new Set(ring.arcs.map((arc) => arc.role));
    assert.ok([...roles].every((role) => [SHORTEST, MIDDLE, LONGEST].includes(role)));
    if (ring.lengths.length === 3) {
      assert.deepEqual([...roles].sort(), [SHORTEST, MIDDLE, LONGEST]);
    } else {
      assert.deepEqual([...roles].sort(), [SHORTEST, LONGEST], `stage ${ring.turns}`);
      assert.ok(!roles.has(MIDDLE), "a two-length stage used the middle colour");
    }
    // Every arc of a given role really is the same length, and roles are ordered by length.
    for (const role of roles) {
      const sizes = new Set(ring.arcs.filter((arc) => arc.role === role).map((arc) => nameOf(arc.gap)));
      assert.equal(sizes.size, 1, `role ${role} covered ${sizes.size} lengths at ${ring.turns}`);
    }
    const shortest = ring.arcs.find((arc) => arc.role === SHORTEST).gap;
    const longest = ring.arcs.find((arc) => arc.role === LONGEST).gap;
    assert.ok(compare(shortest, longest) < 0, "the shortest was not shorter than the longest");
  }
  // Three colours across the whole drawing, and no arc left without one.
  assert.equal(RINGS.reduce((total, ring) => total + ring.arcs.length, 0), 4752);
  assert.equal(new Set(RINGS.flatMap((ring) => ring.arcs.map((arc) => arc.role))).size, 3);
});

test("the rings that lose a colour are the turns that come nearest to starting again", () => {
  // The part nobody asked for. `closestReturns` knows nothing about arcs — it records which
  // turn counts land nearer the start than any before them, counting the two ways round
  // separately — and yet its list is exactly the stages whose arcs come in two lengths.
  // The first turn is a record only because nothing precedes it and has no stage to match.
  const twoLengths = [];
  for (let turns = 1n; turns <= 400n; turns += 1n) {
    if (lengthsUpTo(turns).length === 2) {
      twoLengths.push(Number(turns) + 1);
    }
  }
  const records = closestReturns(400n).map(Number).filter((k) => k > 1);
  assert.deepEqual(records, twoLengths);
  // Pinned, so that a change to either side has to be looked at rather than absorbed.
  assert.deepEqual(twoLengths, [2, 3, 4, 7, 11, 15, 26, 41, 56, 97, 153, 209, 362]);
  assert.ok(twoLengths.length >= 12, "too few coincidences to be a coincidence worth pinning");
});

test("turning by a whole ratio closes up, and then nothing new ever happens", () => {
  // The control. Everything above depends on the turn being irrational; turn by three
  // eighths and the marks stop after eight, every arc the same length, for ever.
  for (const [p, q] of [[3n, 8n], [5n, 12n], [7n, 30n], [1n, 2n]]) {
    const settled = rationalGaps(p, q, q * 40n);
    assert.equal(settled.places, Number(q), `three eighths did not close at ${q}`);
    assert.equal(settled.distinct, 1, "a rational turn gave more than one gap length");
  }
  // And the irrational turn never closes: no two of the first many marks coincide.
  const marks = marksUpTo(400n);
  assert.equal(new Set(marks.map(nameOf)).size, 401);
  // Nor does any mark land back exactly on the start.
  for (let k = 1n; k <= 400n; k += 1n) {
    assert.notEqual(nameOf(markAt(k)), nameOf({ a: 0n, b: 0n }));
  }
});

test("the marks and the gaps are whole-number pairs, so equality is not a near thing", () => {
  // Where the exactness comes from. Every mark is -isqrt(3k^2) + k*sqrt(3), and the whole
  // square root is found by bisection so no rounding decides what a floor is.
  for (let value = 0n; value <= 1500n; value += 1n) {
    const root = squareRoot(value);
    assert.ok(root * root <= value && (root + 1n) * (root + 1n) > value, `root of ${value}`);
  }
  assert.equal(squareRoot(9007199254740993n * 9007199254740993n), 9007199254740993n);

  for (let k = 0n; k <= 300n; k += 1n) {
    const mark = markAt(k);
    assert.equal(typeof mark.a, "bigint");
    assert.equal(typeof mark.b, "bigint");
    assert.equal(mark.b, k);
    // Every mark lies in [0, 1), which is what makes it a place on the circle.
    assert.ok(compare(mark, { a: 0n, b: 0n }) >= 0, `mark ${k} fell below the start`);
    assert.ok(compare(mark, { a: 1n, b: 0n }) < 0, `mark ${k} ran past the start`);
  }
  assert.equal(ROOT, 3n);
  // Two lengths that agree as numbers to a dozen places are still told apart when they are
  // different pairs, which is the whole reason for working this way.
  const close = lengthsUpTo(200n);
  for (const length of close) {
    assert.equal(typeof length.a, "bigint");
    assert.ok(asTurn(length) > 0, "a length came out negative or nought");
  }
});

test("the README's list of rings that lose a colour is the module's own", async () => {
  // Prose is where a number goes stale: the code and the tests were right about this list
  // and the sentence was written out by hand with one of them missing. So the sentence is
  // read back and held against the module, and there is no second copy of the list for
  // anyone to keep in step.
  //
  // The range is a constant here and deliberately not the end of the list being checked.
  // Taking it from the prose would let the prose set its own examination: drop the last
  // entry and the measurement would stop one entry earlier and agree, which is exactly the
  // kind of slip — losing the end of a list while copying it — that this test is for.
  const REACH = 400n;
  const readme = await readFile(resolve(P5JS_DIRECTORY, "README.md"), "utf8");
  const claim = readme.match(
    /they fall at (?<list>[\d, ]+?) — all of them out to (?<reach>[\w ]+?) turns/u
  );
  assert.ok(claim, "the README no longer says where the rings that lose a colour fall");
  assert.equal(claim.groups.reach, "four hundred", "the README states a range this test does not check to");
  const stated = claim.groups.list.split(",").map((word) => Number(word.trim()));

  // Every stage out to the stated range, not merely every stage the sentence reaches.
  const measured = [];
  for (let turns = 1n; turns <= REACH; turns += 1n) {
    if (lengthsUpTo(turns).length === 2) {
      measured.push(Number(turns) + 1);
    }
  }
  assert.deepEqual(stated, measured, "the README's list is not the complete one the rings give");
  assert.equal(stated.length, 13, "the number of two-length rings out to four hundred turns changed");
  // And it is the same list the other calculation gives, which is the claim the sentence
  // goes on to make. Same range, and again not one the sentence chose.
  assert.deepEqual(stated, closestReturns(REACH).map(Number).filter((k) => k > 1));

  // The sentence also says how much of the list the drawing shows, which is a fact about
  // the picture rather than about the sequence.
  const inside = measured.filter((arcs) => arcs - 1 <= Number(STAGES)).length;
  assert.equal(inside, 10, `the drawing holds ${inside} of the two-length rings`);
  assert.ok(readme.includes("the first ten are inside the drawing and the last three lie past its edge"));
});
