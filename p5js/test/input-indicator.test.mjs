import assert from "node:assert/strict";
import test from "node:test";
import { hintMode, indicatorShown } from "../artworks/shared/hint-mode.js";
import { RIPPLE_FRAMES, ripplePhase } from "../artworks/shared/input-indicator.js";

function parameters(query) {
  return new URLSearchParams(query);
}

test("the legend and the indicator never appear together", () => {
  // Three renderings, three audiences: the page instructs, the clip depicts, the
  // thumbnail pictures the page. Each gets exactly one of the two marks.
  const page = parameters("");
  const clip = parameters("capture=1&renderScale=2");
  const thumbnail = parameters("capture=1&hint=1&hintScale=1.7");

  assert.equal(hintMode(page, false).shown, true);
  assert.equal(indicatorShown(page, false), false);

  assert.equal(hintMode(clip, true).shown, false);
  assert.equal(indicatorShown(clip, true), true);

  assert.equal(hintMode(thumbnail, true).shown, true);
  assert.equal(indicatorShown(thumbnail, true), false);

  for (const [query, capturing] of [[page, false], [clip, true], [thumbnail, true]]) {
    assert.notEqual(
      hintMode(query, capturing).shown,
      indicatorShown(query, capturing),
      "one mark, never both and never neither"
    );
  }
});

test("a ripple runs from the press and is gone when it has run", () => {
  assert.equal(ripplePhase(null), null, "no press, no ripple");
  assert.equal(ripplePhase(-1), null, "a press that has not happened yet has no ripple");
  assert.equal(ripplePhase(0), 0, "the press itself is the ripple's first instant");
  assert.equal(ripplePhase(RIPPLE_FRAMES / 2), 0.5);
  assert.equal(ripplePhase(RIPPLE_FRAMES), null, "a finished ripple is not drawn at all");
});

test("the ripple phase is deterministic in the frame index alone", () => {
  // The clips are rebuilt frame by frame in any order, so the ripple cannot depend on
  // what was drawn before it.
  const first = [...Array(20).keys()].map((frame) => ripplePhase(frame - 5));
  const again = [...Array(20).keys()].map((frame) => ripplePhase(frame - 5));
  assert.deepEqual(first, again);
});
