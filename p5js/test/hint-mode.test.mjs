import assert from "node:assert/strict";
import test from "node:test";
import { hintMode } from "../artworks/shared/hint-mode.js";
import {
  HINT_INSET_RATIO,
  fitHintSize,
  hintTextSize,
  legendRoom
} from "../artworks/shared/key-hint.js";

const parameters = (query) => new URLSearchParams(query);

test("the page shows the hint and a capture for posting does not", () => {
  assert.equal(hintMode(parameters(""), false).shown, true);
  assert.equal(hintMode(parameters("capture=1"), true).shown, false);
});

test("a thumbnail is a capture that shows the hint anyway, enlarged", () => {
  const mode = hintMode(parameters("capture=1&hint=1&hintScale=1.7"), true);
  assert.equal(mode.shown, true);
  assert.equal(mode.scale, 1.7);
});

test("a missing or unreadable scale leaves the hint at the page's own size", () => {
  assert.equal(hintMode(parameters("capture=1&hint=1"), true).scale, 1);
  assert.equal(hintMode(parameters("capture=1&hint=1&hintScale=zero"), true).scale, 1);
  // Zero would erase the hint rather than leave it alone, so it is not honoured either.
  assert.equal(hintMode(parameters("capture=1&hint=1&hintScale=0"), true).scale, 1);
});

test("the enlarged hint is still legible once a card has scaled the canvas down", () => {
  // A card fits the canvas into an opening about 353 pixels wide. The two artworks that
  // answer to a key are 680 square and 1010 by 640, so both arrive there at around two
  // fifths of their own size — and the hint has to survive that, not the full size.
  const openingWidth = 353;
  const cases = [
    { width: 680, height: 680 },
    { width: 1010, height: 640 }
  ];
  for (const { width, height } of cases) {
    const shrink = Math.min(openingWidth / width, (openingWidth * 3 / 4) / height);
    const onCard = hintTextSize(width, height, 1.7) * shrink;
    assert.ok(onCard >= 9.5, `${width}x${height} would land at ${onCard.toFixed(1)} pixels`);
    // And not so large that the note starts competing with the artwork it sits under.
    assert.ok(onCard <= 16, `${width}x${height} would land at ${onCard.toFixed(1)} pixels`);
  }
});

/**
 * A legend has to fit the canvas it is drawn on, and the card is where it fails first:
 * the same words are set 1.7 times larger there on a canvas of the same width. How wide
 * a word actually is can only be answered by a browser, so the renderer settles that on
 * the picture it is about to write; what can be settled here is the arithmetic that
 * shrinks the type, given a measurer.
 */

/** A stand-in for a font: width proportional to type size, as fonts nearly are. */
const proportional = (perPoint) => (size) => perPoint * size;

test("a legend that fits is left at the size it asked for", () => {
  const room = legendRoom(680, 680 * HINT_INSET_RATIO);
  const size = hintTextSize(680, 680, 1.7);
  assert.equal(fitHintSize(size, room, proportional(10)), size);
});

test("a legend that overruns is shrunk until it fits, however far it overran", () => {
  const width = 680;
  const room = legendRoom(width, width * HINT_INSET_RATIO);
  const asked = hintTextSize(width, width, 1.7);
  // Necker Cube's line overran the card by about five per cent; the second case is a
  // legend half as long again as the room, which must also come back inside.
  for (const perPoint of [22, 30, 60]) {
    const fitted = fitHintSize(asked, room, proportional(perPoint));
    assert.ok(fitted <= asked, "a fitted legend grew");
    assert.ok(proportional(perPoint)(fitted) <= room + 1e-9,
      `${perPoint} per point still measured ${proportional(perPoint)(fitted)} against ${room}`);
  }
});

test("the shrink is no more than it has to be", () => {
  // Shrinking further than the overrun would make short legends needlessly small.
  const room = 600;
  const fitted = fitHintSize(20, room, proportional(40));
  assert.ok(Math.abs(fitted - 15) < 1e-9, `fitted to ${fitted} rather than 15`);
});

test("a font whose widths do not scale exactly is still brought inside", () => {
  // Real fonts round to whole pixels and hint their stems, so the width at a smaller
  // size is not exactly proportional. The fit asks again after shrinking, which is what
  // the extra rounds are for.
  const room = 600;
  const lumpy = (size) => 40 * size + 25;
  const fitted = fitHintSize(20, room, lumpy);
  assert.ok(lumpy(fitted) <= room + 1e-9, `still ${lumpy(fitted)} against ${room}`);
});

test("the room a legend has is the canvas less an inset at each end", () => {
  assert.equal(legendRoom(680, 20), 640);
  // The plate hangs half a padding outside the inset at both ends, so the padding
  // cancels and the legend itself is what has to fit.
  assert.ok(legendRoom(680, 680 * HINT_INSET_RATIO) < 680);
});
