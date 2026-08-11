import assert from "node:assert/strict";
import test from "node:test";
import {
  KEY_LIT_FRAMES,
  captureFrameCount,
  captureState
} from "../artworks/fibonacci-spiral/capture.js";
import { buildSections } from "../artworks/fibonacci-spiral/geometry.js";
import { loadCatalog } from "../lib/catalog.mjs";

/** The tiling's own section count: fifteen integer rectangles, 987 by 610 down to 1 by 1. */
const SECTIONS = buildSections().length;

const { manifest } = await loadCatalog();
const artwork = manifest.artworks.find((candidate) => candidate.id === "fibonacci-spiral");
const frameCount = captureFrameCount(SECTIONS);
const frames = [...Array(frameCount).keys()].map((frame) => captureState(frame, SECTIONS));

test("the scenario's length is the manifest's duration, via the real section count", () => {
  // The scenario is sized by how many sections there are to take down and put back. If the
  // geometry ever yields a different count, the clip's length changes with it, and this is
  // what forces the manifest's declared duration to move too.
  assert.equal(frameCount, artwork.render.durationSeconds * manifest.defaults.fps);
});

test("the clip opens, closes, and is thumbnailed on the finished spiral", () => {
  // The first frame is what X shows on the timeline as the clip's still, so the strongest
  // picture has to be there rather than at the end of a build-up.
  assert.equal(frames[0].visibleSections, SECTIONS);
  assert.equal(frames.at(-1).visibleSections, SECTIONS);
  assert.equal(frames[artwork.thumbnail.frame].visibleSections, SECTIONS);
});

test("the keys take one section at a time, all the way down and all the way back", () => {
  let removals = 0;
  let additions = 0;
  let reachedOne = false;
  for (let frame = 1; frame < frameCount; frame += 1) {
    const change = frames[frame].visibleSections - frames[frame - 1].visibleSections;
    assert.ok([-1, 0, 1].includes(change), `frame ${frame} jumps by ${change}`);
    removals += change === -1 ? 1 : 0;
    additions += change === 1 ? 1 : 0;
  }
  for (const state of frames) {
    assert.ok(state.visibleSections >= 1 && state.visibleSections <= SECTIONS);
    reachedOne ||= state.visibleSections === 1;
  }
  assert.ok(reachedOne, "the spiral is never taken down to its first rectangle");
  assert.equal(removals, SECTIONS - 1);
  assert.equal(additions, SECTIONS - 1);
});

test("each key lights only in its own half, and for its measured moment", () => {
  let leftLit = 0;
  let rightLit = 0;
  let lastLeft = -1;
  let firstRight = Infinity;
  frames.forEach((state, frame) => {
    assert.ok(!(state.leftActive && state.rightActive), "both keys lit at once");
    if (state.leftActive) {
      leftLit += 1;
      lastLeft = frame;
    }
    if (state.rightActive) {
      rightLit += 1;
      firstRight = Math.min(firstRight, frame);
    }
  });
  assert.ok(lastLeft < firstRight, "the left arrow is still being pressed after the right one starts");
  assert.equal(leftLit, (SECTIONS - 1) * KEY_LIT_FRAMES);
  assert.equal(rightLit, (SECTIONS - 1) * KEY_LIT_FRAMES);
});
