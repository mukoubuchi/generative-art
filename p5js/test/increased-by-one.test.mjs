import assert from "node:assert/strict";
import test from "node:test";
import { WIDTH, HEIGHT, FRAMES, SEEDS, BIRTHS, COUNT, SAMPLES, DENOMINATOR, CENTRE,
  RADIUS, ARCHIVE_RADIUS, createChronicle, nextEvent, meanOf, sample, pointOf,
  archivePosition, sectionPoint, stateAt, frameAt } from "../artworks/increased-by-one/events.js";

const events = createChronicle();
const flatten = (event) => event.coefficients.flat();
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; }

// Independent, fraction-free row elimination, rather than a count of assigned mode names.
function rank(rows) {
  const a = rows.map((row) => [...row]);
  let found = 0;
  for (let col = 0; col < a[0].length && found < a.length; col++) {
    const pivot = a.findIndex((row, i) => i >= found && row[col] !== 0n);
    if (pivot < 0) continue;
    [a[found], a[pivot]] = [a[pivot], a[found]];
    for (let row = found + 1; row < a.length; row++) {
      const factor = a[row][col];
      if (!factor) continue;
      a[row] = a[row].map((value, k) => value * a[found][col] - a[found][k] * factor);
      const divisor = a[row].reduce(gcd, 0n);
      if (divisor) a[row] = a[row].map((value) => value / divisor);
    }
    found++;
  }
  return found;
}

function inheritsAll(child, past) {
  return child.coefficients.every((pair, mode) => mode === child.id || pair.every((value, axis) =>
    BigInt(past.length) * value === past.reduce((sum, event) => sum + event.coefficients[mode][axis], 0n)));
}

test("each birth retains every predecessor exactly and appends one independent event", () => {
  const ranks = [];
  for (let n = 1; n <= COUNT; n++) ranks.push(rank(events.slice(0, n).map(flatten)));
  assert.deepEqual(ranks, Array.from({ length: COUNT }, (_, i) => i + 1));
  for (let n = SEEDS; n < COUNT; n++) {
    const past = events.slice(0, n), before = structuredClone(past), child = nextEvent(past);
    assert.deepEqual(past, before);
    assert.deepEqual(child.parents, past.map((event) => event.id));
    assert.ok(inheritsAll(child, past));
    assert.deepEqual(child.inherited, meanOf(past));
    assert.ok(past.every((event) => event.coefficients[n].every((value) => value === 0n)));
    assert.ok(child.coefficients[n].some((value) => value !== 0n));
    // Removing a predecessor from the asserted mean must fail, for every predecessor.
    for (const parent of past) assert.ok(!inheritsAll(child, past.filter((event) => event !== parent)));
  }
  assert.throws(() => nextEvent(events), /complete/);
  console.log(JSON.stringify({ events: events.length, births: BIRTHS, exactRanks: ranks,
    coefficientDenominator: String(DENOMINATOR) }));
});

test("the new event changes the next gathering; an average without novelty fails the rank check", () => {
  for (let n = SEEDS; n < COUNT; n++) {
    const past = events.slice(0, n);
    const withoutNovelty = { ...events[n], coefficients: meanOf(past) };
    assert.equal(rank([...past, withoutNovelty].map(flatten)), n);
    assert.equal(rank([...past, events[n]].map(flatten)), n + 1);
    if (n + 1 < COUNT) {
      assert.deepEqual(events[n + 1].coefficients[n].map((v) => v * BigInt(n + 1)), events[n].coefficients[n]);
      const counterfactual = nextEvent([...past, withoutNovelty]);
      assert.notDeepEqual(counterfactual.coefficients, events[n + 1].coefficients);
      assert.deepEqual(counterfactual.coefficients[n], [0n, 0n]);
    }
  }
});

test("independent Fourier recovery reads the coefficients back from the curves that are drawn", () => {
  let worst = 0;
  for (const event of events) {
    const points = sample(event.coefficients);
    for (let mode = 0; mode < COUNT; mode++) {
      let a = 0, b = 0;
      points.forEach(([x, y], i) => {
        const theta = 2 * Math.PI * i / SAMPLES, c = Math.cos((mode + 2) * theta), s = Math.sin((mode + 2) * theta);
        a += (x * c + y * s) / SAMPLES;
        b += (y * c - x * s) / SAMPLES;
      });
      const error = Math.max(Math.abs(a - Number(event.coefficients[mode][0]) / Number(DENOMINATOR)),
        Math.abs(b - Number(event.coefficients[mode][1]) / Number(DENOMINATOR)));
      worst = Math.max(worst, error);
      assert.ok(error < 2e-14);
    }
    const start = pointOf(event.coefficients, 0), end = pointOf(event.coefficients, 2 * Math.PI);
    assert.ok(Math.hypot(start[0] - end[0], start[1] - end[1]) < 1e-13);
  }
  console.log(JSON.stringify({ fourierRecoveryMaxError: worst }));
});

test("copies start at their retained originals and meet the actual inherited mean", () => {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const event of events.slice(SEEDS)) {
    const target = sample(event.inherited);
    for (const parent of event.parents) {
      const source = sample(events[parent].coefficients), origin = archivePosition(parent);
      for (let i = 0; i < SAMPLES; i++) {
        const start = sectionPoint(source, target, parent, 0, i), end = sectionPoint(source, target, parent, 1, i);
        assert.deepEqual(start, origin.map((v, axis) => v + ARCHIVE_RADIUS * source[i][axis]));
        assert.ok(Math.hypot(...end.map((v, axis) => v - CENTRE[axis] - RADIUS * target[i][axis])) < 2e-13);
        for (let step = 0; step <= 22; step++) {
          const [x, y] = sectionPoint(source, target, parent, step / 22, i);
          bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
          bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
          assert.ok(x > 8 && y > 8 && x < WIDTH - 8 && y < HEIGHT - 8);
        }
      }
    }
  }
  console.log(JSON.stringify({ sampledSectionBounds: bounds }));
});

test("the complete capture grows by single births, includes every completed event, and holds", () => {
  const counts = new Set();
  let previous = SEEDS;
  for (let frame = 0; frame < FRAMES; frame++) {
    const state = stateAt(frame);
    assert.ok(state.count === previous || state.count === previous + 1);
    counts.add(state.count); previous = state.count;
    assert.equal(state.contributors, events[state.event].parents.length);
    assert.ok(!state.complete || state.novelty === 1);
    assert.ok(state.gather >= 0 && state.gather <= 1 && state.transfer >= 0 && state.transfer <= 1);
  }
  assert.deepEqual([...counts], Array.from({ length: BIRTHS + 1 }, (_, i) => i + SEEDS));
  assert.equal(stateAt(FRAMES - 1).count, COUNT);
  assert.equal(stateAt(FRAMES - 1).finished, true);
  assert.deepEqual(stateAt(FRAMES), stateAt(FRAMES - 1));
  assert.equal(frameAt(100), FRAMES - 1);
});
