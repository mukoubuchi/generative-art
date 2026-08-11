import assert from "node:assert/strict";
import test from "node:test";
import {
  PATTERN_PERIOD,
  TOTAL_FRAMES,
  courses,
  rowShift,
  wallState
} from "../artworks/cafe-wall/wall.js";

/**
 * The clip's argument is that the illusion needs both of its parameters, so the
 * schedule is tested as an argument: each parameter is swept while the other provably
 * holds still, the checkerboard moment exists, and the loop closes on a pattern the
 * two-tile period cannot tell from the start. The geometry's one truth — courses are
 * horizontal, whatever the frame does — is pinned last.
 */
test("the clip opens and closes on the same wall", () => {
  const opening = wallState(0);
  const closing = wallState(TOTAL_FRAMES - 1);
  assert.deepEqual(opening, { offsetTiles: 0, mortarBlend: 0 });
  // Two tiles of shift is a whole pattern period: the same wall by construction.
  assert.equal(closing.mortarBlend, 0);
  assert.equal(closing.offsetTiles % PATTERN_PERIOD, 0);
  assert.deepEqual(wallState(TOTAL_FRAMES), wallState(0), "the loop must close seamlessly");
});

test("the wedges build to half a tile and hold there", () => {
  // Mid-build the offset is strictly between the ends; through the whole mortar
  // excursion and its surrounding holds, it sits exactly at the half tile.
  assert.ok(wallState(45).offsetTiles > 0);
  assert.ok(wallState(45).offsetTiles < 0.5);
  for (const frame of [75, 100, 130, 160, 190, 210]) {
    assert.equal(wallState(frame).offsetTiles, 0.5, `frame ${frame} lets the geometry move`);
  }
});

test("the mortar drains and returns while the geometry holds still", () => {
  const before = wallState(99);
  assert.equal(before.mortarBlend, 0);
  let peak = 0;
  for (let frame = 100; frame < 190; frame += 1) {
    const state = wallState(frame);
    assert.equal(state.offsetTiles, 0.5);
    peak = Math.max(peak, state.mortarBlend);
  }
  assert.equal(peak, 1, "the mortar must fully match the light tiles at its far end");
  assert.equal(wallState(190).mortarBlend, 0, "the mortar must come all the way back");
});

test("the second sweep passes through the checkerboard", () => {
  // A whole tile of shift is the checkerboard, where the illusion dies with the mortar
  // untouched. The sweep must actually cross it, not step over it.
  let crossed = false;
  let previous = wallState(220).offsetTiles;
  for (let frame = 221; frame < 295; frame += 1) {
    const current = wallState(frame).offsetTiles;
    assert.ok(current >= previous, "the closing sweep must not double back");
    if (previous < 1 && current >= 1) {
      crossed = true;
    }
    previous = current;
  }
  assert.ok(crossed);
  assert.equal(wallState(294).offsetTiles, 2);
});

test("only odd courses slide", () => {
  for (const offset of [0, 0.25, 0.5, 1, 2]) {
    for (let row = 0; row < 8; row += 1) {
      assert.equal(rowShift(row, offset), row % 2 === 0 ? 0 : offset);
    }
  }
});

test("the courses are horizontal, whatever the frame does", () => {
  // The fact the illusion lies about: a course's vertical position is a function of its
  // row index alone. The layout function cannot even be asked about a frame.
  const mortar = 1 / 12;
  const bands = courses(8, mortar);
  assert.equal(bands.length, 8);
  for (const [index, band] of bands.entries()) {
    assert.equal(band.top, index * (1 + mortar));
    assert.equal(band.height, 1);
  }
});

test("the schedule fills its own length", () => {
  assert.equal(TOTAL_FRAMES, 300);
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const state = wallState(frame);
    assert.ok(Number.isFinite(state.offsetTiles) && Number.isFinite(state.mortarBlend));
  }
});
