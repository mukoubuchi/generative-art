import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSections } from "../artworks/fibonacci-spiral/geometry.js";
import {
  NOTHING_HELD,
  REPEAT_DELAY_MS,
  REPEAT_PERIOD_MS,
  applyHold,
  keyDown,
  keyUp,
  stepsDue
} from "../artworks/fibonacci-spiral/repeat.js";

/**
 * A held arrow is the only part of this artwork that answers to a clock rather than to a
 * frame number, so it is the only part that could quietly come to depend on how fast the
 * reader's machine draws or on how their operating system is set to repeat a key. These
 * tests hold it to the clock: what a hold has earned is asked of the elapsed time alone,
 * and every count below is walked out of the module rather than declared here.
 */

const SECTIONS = buildSections().length;
const RIGHT = "ArrowRight";
const LEFT = "ArrowLeft";

/**
 * The whole spiral, built by leaning on the right arrow and sampling at `frameMs` — the
 * sketch takes its steps in `draw`, so the module is only ever asked at whatever moments
 * a frame happens to land on. Returns the moment each section arrived.
 */
function buildByHolding(frameMs, { key = RIGHT, direction = 1, from = 1, until = 4000 } = {}) {
  let hold = keyDown(NOTHING_HELD, key, direction, 0);
  let count = from;
  const arrivals = [];
  for (let now = 0; now <= until; now += frameMs) {
    const advanced = applyHold(hold, now, count, SECTIONS);
    for (let extra = count; extra !== advanced.count; extra += direction) {
      arrivals.push(now);
    }
    hold = advanced.hold;
    count = advanced.count;
  }
  return { arrivals, count, hold };
}

test("a tap is one section, however the frames fall around it", () => {
  // The press earns its step immediately, and nothing more until the delay is up. A tap
  // shorter than that delay therefore cannot be worth two sections at any frame rate.
  for (const held of [0, 1, 16, 60, REPEAT_DELAY_MS - 1]) {
    assert.equal(stepsDue(held), 1, `${held} ms into a tap`);
  }
  let hold = keyDown(NOTHING_HELD, RIGHT, 1, 0);
  const pressed = applyHold(hold, 0, 1, SECTIONS);
  assert.equal(pressed.count, 2, "the press itself did not move the spiral");
  hold = pressed.hold;
  // Held on for almost the whole delay, across several frames, and let go: still one.
  for (let now = 16; now < REPEAT_DELAY_MS; now += 16) {
    const advanced = applyHold(hold, now, pressed.count, SECTIONS);
    assert.equal(advanced.count, 2, `a tap grew a second section at ${now} ms`);
    hold = advanced.hold;
  }
  assert.equal(keyUp(hold, RIGHT), NOTHING_HELD);
});

test("the repeat starts when the delay is up, and keeps the beat from there", () => {
  // Two steps at exactly the delay, three at exactly one beat later, and so on: the
  // boundaries are the moments themselves, not the frames that happen to straddle them.
  assert.equal(stepsDue(REPEAT_DELAY_MS - 0.001), 1);
  assert.equal(stepsDue(REPEAT_DELAY_MS), 2);
  for (let beat = 0; beat < 40; beat += 1) {
    const at = REPEAT_DELAY_MS + beat * REPEAT_PERIOD_MS;
    assert.equal(stepsDue(at), 2 + beat, `at the beat ${beat} boundary`);
    assert.equal(stepsDue(at - 0.001), 1 + beat, `just short of beat ${beat}`);
  }
  // And it never runs backwards or skips a step between one moment and the next.
  let previous = stepsDue(0);
  for (let now = 0; now <= 5000; now += 0.5) {
    const due = stepsDue(now);
    assert.ok(due === previous || due === previous + 1, `${previous} jumped to ${due} at ${now} ms`);
    previous = due;
  }
});

test("holding fills the spiral in under two seconds, and no frame rate hurries it", () => {
  // The artwork's own beat, not the machine's: a fast frame rate and a slow one put the
  // sections in at the same moments, and a whole spiral takes the same time either way.
  // The moment each section is owed at, which is the thing a frame rate cannot move: the
  // press, then one a delay later, then one a beat apart from there.
  const owedAt = (index) => (index === 0 ? 0 : REPEAT_DELAY_MS + (index - 1) * REPEAT_PERIOD_MS);
  for (const frameMs of [4, 16, 50]) {
    const { arrivals, count } = buildByHolding(frameMs);
    assert.equal(count, SECTIONS, `a ${frameMs} ms frame did not finish the spiral`);
    assert.equal(arrivals.length, SECTIONS - 1);
    // A frame takes whatever is owed by the time it runs, so a section arrives at its own
    // moment or in the frame after it, and never before.
    arrivals.forEach((moment, index) => {
      const late = moment - owedAt(index);
      assert.ok(late >= 0 && late < frameMs, `section ${index + 2} landed ${late} ms out`);
    });
  }
  // The length of the build, which is what a reader waits through: the press puts in the
  // second rectangle, the delay puts in the third, and a beat apiece puts in the rest.
  const filled = owedAt(SECTIONS - 2);
  assert.equal(filled, REPEAT_DELAY_MS + (SECTIONS - 3) * REPEAT_PERIOD_MS);
  // A little under one and three quarter seconds, which is what the README says of it.
  assert.ok(filled > 1500 && filled < 1750, `the spiral filled in ${filled} ms`);
});

test("the README's account of the hold is the module's", async () => {
  // Prose is where a number goes to rot: nothing else in the repository would notice if
  // the beat were retuned and the paragraph left standing.
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const paragraph = readme
    .split("\n")
    .find((line) => line.startsWith("An arrow that is leaned on now keeps going."));
  assert.ok(paragraph, "the README no longer has a paragraph about the held arrow");
  assert.ok(
    paragraph.includes(`${REPEAT_DELAY_MS} milliseconds before it starts repeating`),
    `the README does not give the delay as ${REPEAT_DELAY_MS} ms`
  );
  assert.ok(
    paragraph.includes(`a section every ${REPEAT_PERIOD_MS} milliseconds`),
    `the README does not give the beat as ${REPEAT_PERIOD_MS} ms`
  );
});

test("a hold stops at the end of the spiral, and stays stopped while the key is down", () => {
  // Leaning on the right arrow past the last section must not leave a debt that the left
  // arrow then has to pay off before it does anything.
  const { hold, count } = buildByHolding(16, { until: 10_000 });
  assert.equal(count, SECTIONS);
  assert.equal(hold.direction, 0, "the repeat is still asking for sections that do not exist");
  assert.equal(hold.key, RIGHT, "the key stopped counting as held");
  for (const now of [10_016, 20_000, 60_000]) {
    assert.equal(applyHold(hold, now, SECTIONS, SECTIONS).count, SECTIONS);
  }
  // Down to the first rectangle is the same at the other end.
  const stripped = buildByHolding(16, { key: LEFT, direction: -1, from: SECTIONS, until: 10_000 });
  assert.equal(stripped.count, 1);
  assert.equal(stripped.arrivals.length, SECTIONS - 1);
  assert.equal(stripped.hold.direction, 0);
});

test("the browser's own auto-repeat cannot restart the clock", () => {
  // p5 2.x reports a key going down once, but this must not be the thing that makes the
  // beat right: a browser that did deliver auto-repeat would otherwise reset `since` on
  // every one of them and the spiral would never get past its first section.
  let hold = keyDown(NOTHING_HELD, RIGHT, 1, 0);
  let count = 1;
  for (let now = 0; now <= 2000; now += 30) {
    hold = keyDown(hold, RIGHT, 1, now);
    const advanced = applyHold(hold, now, count, SECTIONS);
    hold = advanced.hold;
    count = advanced.count;
  }
  assert.equal(count, SECTIONS, "the repeated key downs stalled the build");
  assert.equal(hold.since, 0, "a repeated key down moved the moment the hold began");
});

test("the other arrow takes the hold over, and letting go of the wrong one changes nothing", () => {
  let hold = keyDown(NOTHING_HELD, RIGHT, 1, 0);
  let count = applyHold(hold, 0, 1, SECTIONS).count;
  hold = applyHold(hold, 0, 1, SECTIONS).hold;
  // The reader rolls onto the left arrow without letting go of the right one.
  hold = keyDown(hold, LEFT, -1, 500);
  assert.equal(hold.key, LEFT);
  assert.equal(hold.since, 500, "the new arrow inherited the old one's clock");
  assert.equal(hold.taken, 0, "the new arrow inherited the old one's steps");
  // Releasing the right arrow afterwards is about a key that is no longer the one held.
  assert.equal(keyUp(hold, RIGHT), hold);
  assert.equal(applyHold(hold, 500, count, SECTIONS).count, count - 1);
  // Releasing the left one does let go.
  assert.equal(keyUp(hold, LEFT), NOTHING_HELD);
  assert.equal(applyHold(NOTHING_HELD, 10_000, count, SECTIONS).count, count);
});

test("a spiral nobody is touching stands still", () => {
  // The sketch rests on this: with nothing held, `draw` takes no steps and puts itself
  // back to sleep. If an idle hold could ever move the count, the page would tick over
  // on its own for as long as it was open.
  for (const now of [0, 1, 1000, 86_400_000]) {
    const advanced = applyHold(NOTHING_HELD, now, 7, SECTIONS);
    assert.equal(advanced.count, 7);
    assert.equal(advanced.hold, NOTHING_HELD);
  }
});
