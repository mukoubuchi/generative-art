import assert from "node:assert/strict";
import test from "node:test";
import { hintMode } from "../artworks/shared/hint-mode.js";
import { hintTextSize } from "../artworks/shared/key-hint.js";

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
