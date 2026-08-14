import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DISSOLVE_FRAMES,
  HOLD_FRAMES,
  LAY_FRAMES,
  PHI,
  SECTION_COUNT,
  TOTAL_FRAMES,
  arcLengths,
  arcPoint,
  buildSections,
  fibonacciNumbers,
  sectionCorners,
  sectionCut,
  travelAt
} from "../artworks/fibonacci-spiral/geometry.js";

const sections = buildSections();

test("the tiling is fifteen integer rectangles whose sides are consecutive Fibonacci numbers", () => {
  const fibonacci = fibonacciNumbers();

  assert.equal(fibonacci.length, SECTION_COUNT + 1);
  for (let index = 2; index < fibonacci.length; index += 1) {
    assert.equal(fibonacci[index], fibonacci[index - 1] + fibonacci[index - 2]);
  }
  assert.equal(sections.length, SECTION_COUNT);
  assert.equal(sections[0].width, 987);
  assert.equal(sections[0].height, 610);
  assert.equal(sections.at(-1).width, 1);
  assert.equal(sections.at(-1).height, 1);
});

test("the recurrence is carpentry: each square split leaves exactly the next rectangle", () => {
  for (let index = 0; index < sections.length - 1; index += 1) {
    // Splitting the height-square off a width-by-height rectangle leaves width minus
    // height across, and that is the next section's height — as integers, with ===.
    assert.equal(sections[index].width - sections[index].height, sections[index + 1].height);
    assert.equal(sections[index].height, sections[index + 1].width);
  }
});

test("each section starts on the last one's far edge, a quarter turn on", () => {
  for (let index = 0; index < sections.length - 1; index += 1) {
    const here = sections[index];
    const next = sections[index + 1];
    assert.ok(Math.abs(next.x - (here.x + here.width * Math.cos(here.rotation))) < 1e-9);
    assert.ok(Math.abs(next.y - (here.y + here.width * Math.sin(here.rotation))) < 1e-9);
    assert.ok(Math.abs(next.rotation - here.rotation - Math.PI / 2) < 1e-12);
    assert.equal(sectionCorners(here).length, 4);
  }
});

test("the convergents close on phi from both sides, the error shrinking by phi squared", () => {
  const errors = sections.map((section) => section.ratio - PHI);

  // Build order runs best convergent first, so read the walk from the rough end.
  const walk = [...errors].reverse();
  for (let index = 1; index < walk.length; index += 1) {
    assert.ok(Math.sign(walk[index]) !== Math.sign(walk[index - 1]));
    assert.ok(Math.abs(walk[index]) < Math.abs(walk[index - 1]));
  }
  for (let index = walk.length - 4; index < walk.length; index += 1) {
    const shrink = Math.abs(walk[index - 1]) / Math.abs(walk[index]);
    assert.ok(Math.abs(shrink - PHI ** 2) < 0.02);
  }
  // The root's own aspect misses phi by about one part in a million.
  assert.ok(Math.abs(sections[0].ratio - PHI) < 1.3e-6);
});

test("the regions are shown by what divides them, and every cut is a real one", () => {
  // Nothing is filled: fourteen lines inside the root's outline are the whole drawing of
  // the tiling. Each is the cut that leaves a section's square behind, so it has to run
  // right across the section, at exactly a short side's distance along it.
  const cuts = sections.map(sectionCut);
  assert.equal(cuts.filter((cut) => cut !== null).length, SECTION_COUNT - 1);
  // The one with nothing to divide is the last: by then the section is already a square.
  assert.equal(cuts.at(-1), null);
  assert.equal(sections.at(-1).width, sections.at(-1).height);

  sections.forEach((section, index) => {
    const cut = cuts[index];
    if (cut === null) {
      return;
    }
    const length = Math.hypot(cut.to.x - cut.from.x, cut.to.y - cut.from.y);
    assert.ok(Math.abs(length - section.height) < 1e-9, `cut ${index} does not span the section`);
    // Its two ends stand on the section's own long sides, which is what makes it a cut
    // rather than a mark: both are corners of the square being left behind.
    const corners = sectionCorners(section);
    const onSide = (point, first, second) => {
      const cross = (second.x - first.x) * (point.y - first.y)
        - (second.y - first.y) * (point.x - first.x);
      return Math.abs(cross) < 1e-9;
    };
    assert.ok(onSide(cut.from, corners[0], corners[1]), `cut ${index} misses a long side`);
    assert.ok(onSide(cut.to, corners[3], corners[2]), `cut ${index} misses the other long side`);
  });
});

test("the arcs are one curve: each starts exactly where the last one stopped", () => {
  // The spiral is fifteen quarter arcs and it has to read as one line. Each is inscribed
  // in its section's square, so its two ends are corners of that square -- and the next
  // section's square shares one of them.
  for (let index = 0; index < sections.length - 1; index += 1) {
    const ends = arcPoint(sections[index], 1);
    const begins = arcPoint(sections[index + 1], 0);
    assert.ok(Math.hypot(ends.x - begins.x, ends.y - begins.y) < 1e-9, `arc ${index} does not join`);
  }
  // And every arc is a quarter of a circle of its section's short side, which its chords
  // say without anybody having to be told where the centre is: end to end a quarter circle
  // spans the radius times root two, and half of it spans twice the sine of an eighth of a
  // right angle. Both are the radius the square half of the section gives it.
  const lengths = arcLengths();
  const apart = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
  sections.forEach((section, index) => {
    assert.ok(Math.abs(lengths[index] - (Math.PI / 2) * section.height) < 1e-12);
    const whole = apart(arcPoint(section, 0), arcPoint(section, 1));
    assert.ok(Math.abs(whole - section.height * Math.SQRT2) < 1e-9, `arc ${index} is not a quarter`);
    const half = apart(arcPoint(section, 0), arcPoint(section, 0.5));
    assert.ok(Math.abs(half - 2 * section.height * Math.sin(Math.PI / 8)) < 1e-9);
    // Walked in equal steps of angle it advances in equal steps of length, which is what
    // makes it a circle rather than some other curve through the same two corners.
    const steps = Array.from({ length: 8 }, (unused, step) =>
      apart(arcPoint(section, step / 8), arcPoint(section, (step + 1) / 8)));
    for (const step of steps) {
      assert.ok(Math.abs(step - steps[0]) < 1e-9, `arc ${index} is not evenly curved`);
    }
  });
});

test("the mark travels at one steady speed, and the tail of the journey costs nothing", () => {
  // The pacing decision, measured rather than asserted. Equal shares of the journey are
  // equal lengths of curve -- that is what steady means -- and the consequence is that the
  // arcs too small to see take almost none of the clip.
  const whole = arcLengths().reduce((total, length) => total + length, 0);
  let walked = 0;
  let previous = travelAt(0).point;
  const steps = 4000;
  for (let step = 1; step <= steps; step += 1) {
    const here = travelAt(step / steps).point;
    walked += Math.hypot(here.x - previous.x, here.y - previous.y);
    previous = here;
  }
  // Walked in even shares of the journey, the distance covered comes to the whole curve.
  assert.ok(Math.abs(walked - whole) / whole < 1e-3, `walked ${walked} of ${whole}`);

  // Even in the small: any two equal shares of the journey are the same length of curve.
  const between = (from, to) => {
    let sum = 0;
    let last = travelAt(from).point;
    for (let step = 1; step <= 200; step += 1) {
      const here = travelAt(from + ((to - from) * step) / 200).point;
      sum += Math.hypot(here.x - last.x, here.y - last.y);
      last = here;
    }
    return sum;
  };
  const early = between(0.1, 0.2);
  const late = between(0.7, 0.8);
  assert.ok(Math.abs(early - late) / early < 1e-3, `${early} early against ${late} late`);

  // Which is the whole argument for the pacing: at a quarter turn a beat, the five arcs
  // under a hundredth of the root would take a third of the journey's beats and show a
  // mark standing still. At a steady speed they are a thousandth of it.
  const small = sections.filter((section) => section.height < sections[0].height / 100);
  assert.equal(small.length, 5);
  const tail = small.reduce((total, section) => total + (Math.PI / 2) * section.height, 0);
  assert.ok(tail / whole < 0.01, `the last arcs are ${(tail / whole) * 100} per cent of the journey`);
  assert.ok(small.length / sections.length > 0.3, "the small arcs are not a third of the count");
});

test("the mark and its arc are the same picture at every scale", () => {
  // The self-similarity, moved from the pacing to the mark. Its size is a share of the arc
  // it rides, so the ratio between the two never changes -- which a camera that does not
  // move can actually show, where a self-similar motion cannot.
  const shares = sections.map((section) => section.height / sections[0].height);
  for (let index = 0; index < shares.length - 2; index += 1) {
    const step = shares[index] / shares[index + 1];
    assert.ok(step > 1.5 && step < 2.1, `the arcs shrink by ${step}, which is not phi-ish`);
  }
  // The root's own aspect misses phi by about one part in a million, and that claim now
  // lives here rather than being drawn a second time as a skeleton nobody could tell from
  // the tiling: at the size the canvas draws it, the two would stand 0.02 of a pixel apart.
  assert.ok(Math.abs(sections[0].ratio - PHI) < 1.3e-6);
});

test("the clip lays the spiral, holds it, and lets it go", async () => {
  assert.equal(LAY_FRAMES + HOLD_FRAMES + DISSOLVE_FRAMES, TOTAL_FRAMES);
  assert.equal(TOTAL_FRAMES, 300);
  // The mark reaches the eye of the spiral exactly as the laying ends, and rests there.
  assert.equal(travelAt(1).index, sections.length - 1);
  assert.equal(travelAt(1).along, 1);
  assert.deepEqual(travelAt(0).point, arcPoint(sections[0], 0));

  const manifest = JSON.parse(
    await readFile(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "fibonacci-spiral");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.durationSeconds * 30, TOTAL_FRAMES);
  // The card is taken while the finished figure is held, not during the laying or the
  // letting go: a card of either would show a spiral somebody had interrupted.
  assert.ok(artwork.thumbnail.frame > LAY_FRAMES, "the card is taken while the spiral is drawn");
  assert.ok(artwork.thumbnail.frame <= LAY_FRAMES + HOLD_FRAMES, "the card is taken while it fades");
});
