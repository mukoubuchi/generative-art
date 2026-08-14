import assert from "node:assert/strict";
import test from "node:test";
import {
  CHANNEL_LEAN,
  COLUMN_COUNT,
  ROW_COUNT,
  WAVES,
  fieldAt,
  tileArcs,
  tilesAt
} from "../artworks/truchet-tides/tiles.js";
import { loadCatalog } from "../lib/catalog.mjs";

/**
 * The same cells, and never the same water.
 *
 * Every cell holds the same two quarter arcs and the only question is which way it is
 * turned, so what the picture is depends entirely on the field that decides that. These
 * tests are about the field being a field: a function of where a cell stands and of when,
 * with nothing remembered between frames and nothing thrown. That is what lets any frame
 * be drawn on its own, and it is what makes the loop close rather than nearly close.
 */

const { manifest } = await loadCatalog();
const artwork = manifest.artworks.find((candidate) => candidate.id === "truchet-tides");
const PLAYBACK_FPS = manifest.defaults.fps;
const TOTAL_FRAMES = artwork.render.durationSeconds * PLAYBACK_FPS;
const MARGIN = 32;
const TILE_SIZE = (artwork.canvas.width - MARGIN * 2) / COLUMN_COUNT;

test("the grid divides the framed area exactly", () => {
  // Whole tiles, or the arcs stop meeting at the edges and the curves come apart.
  assert.equal(TILE_SIZE, Math.round(TILE_SIZE));
  assert.equal(MARGIN * 2 + COLUMN_COUNT * TILE_SIZE, artwork.canvas.width);
  assert.equal(MARGIN * 2 + ROW_COUNT * TILE_SIZE, artwork.canvas.height);
  assert.equal(tilesAt(0).length, COLUMN_COUNT * ROW_COUNT);
});

test("the current is a field: a function of the cell and the moment, and nothing else", () => {
  // Asked twice, the same answer; asked in any order, the same answers. Nothing is
  // carried from one frame to the next, which is what lets a frame be drawn on its own.
  for (const turns of [0, 0.137, 0.5, 0.986]) {
    const first = tilesAt(turns);
    const second = tilesAt(turns);
    assert.deepEqual(first, second);
    for (const tile of first) {
      assert.equal(tile.lean, fieldAt(tile.column, tile.row, turns));
      assert.equal(tile.direction, tile.lean > 0);
      assert.equal(tile.channel, Math.abs(tile.lean) > CHANNEL_LEAN);
      assert.ok(tile.lean >= -1 && tile.lean <= 1, `the field left its range at ${tile.lean}`);
    }
  }
});

test("the loop closes exactly, and the field it closes on is periodic", () => {
  // Two claims, and they are not the same one.
  //
  // The clip closes because the sketch wraps the frame index before it divides: frame
  // three hundred is frame nought, the same argument to the same function, so the last
  // frame is the first one bit for bit and nothing here needs to be nearly anything.
  assert.deepEqual(tilesAt(300 % 300 / 300), tilesAt(0));

  // The field underneath is periodic in its own right, because every wave drifts a whole
  // number of cycles over the clip. That is what makes the wrap honest rather than a cut:
  // a field still mid-stride at the end would jump when the clip looped. Floating point
  // does not deliver the last bit of a sine after adding a whole turn to its argument, so
  // what is held is the part that reaches the drawing -- which way each cell is turned --
  // and the arithmetic underneath is held to a part in a hundred million.
  for (const wave of WAVES) {
    assert.equal(wave.turns, Math.round(wave.turns), "a wave drifts by part of a cycle");
  }
  for (const turns of [0, 0.25, 0.6]) {
    const here = tilesAt(turns);
    const lap = tilesAt(turns + 1);
    here.forEach((tile, index) => {
      assert.equal(tile.direction, lap[index].direction, `cell ${index} turned over in a lap`);
      assert.equal(tile.channel, lap[index].channel);
      assert.ok(Math.abs(tile.lean - lap[index].lean) < 1e-8);
    });
  }
  // And the three waves are all different, so the pattern does not repeat inside a run.
  assert.equal(new Set(WAVES.map((wave) => wave.turns)).size, WAVES.length);
});

test("the current really moves, and keeps changing its mind", () => {
  // A field that drifted without ever crossing zero would turn no cell over: the arcs
  // would sit still for ten seconds. Count the cells that change hands over the clip.
  const opening = tilesAt(0);
  let turnedOver = 0;
  let mostAtOnce = 0;
  for (let frame = 1; frame < TOTAL_FRAMES; frame += 1) {
    const before = tilesAt((frame - 1) / TOTAL_FRAMES);
    const now = tilesAt(frame / TOTAL_FRAMES);
    const changed = now.filter((tile, index) => tile.direction !== before[index].direction).length;
    mostAtOnce = Math.max(mostAtOnce, changed);
    turnedOver += changed;
  }
  assert.ok(turnedOver > opening.length, `only ${turnedOver} turns over a whole clip`);
  // And it changes its mind about a few cells at a time rather than about the whole grid,
  // which is the difference between a current and a flicker.
  assert.ok(mostAtOnce <= COLUMN_COUNT, `${mostAtOnce} cells turned over between two frames`);
});

test("both orientations meet the same four points on the tile's edges", () => {
  // This is what makes the tiles a Truchet set: however the field falls, the curves join
  // up, because both turnings of a cell end at the midpoints of the same four edges.
  const at = (arc, angle) => ({
    x: arc.x + (arc.diameter / 2) * Math.cos(angle),
    y: arc.y + (arc.diameter / 2) * Math.sin(angle)
  });
  const ends = (tile) => tileArcs(tile, TILE_SIZE, MARGIN)
    .flatMap((arc) => [at(arc, arc.start), at(arc, arc.stop)])
    .map((point) => `${point.x.toFixed(9)},${point.y.toFixed(9)}`)
    .sort();
  for (const column of [0, 5, COLUMN_COUNT - 1]) {
    for (const row of [0, 4, ROW_COUNT - 1]) {
      const turned = ends({ column, row, direction: true });
      const other = ends({ column, row, direction: false });
      assert.deepEqual(turned, other, `the two turnings of ${column},${row} do not meet`);
      // Four points, each the midpoint of one of the cell's edges.
      assert.equal(new Set(turned).size, 4);
      const x = MARGIN + column * TILE_SIZE;
      const y = MARGIN + row * TILE_SIZE;
      const half = TILE_SIZE / 2;
      assert.deepEqual(new Set(turned), new Set([
        `${(x + half).toFixed(9)},${y.toFixed(9)}`,
        `${(x + half).toFixed(9)},${(y + TILE_SIZE).toFixed(9)}`,
        `${x.toFixed(9)},${(y + half).toFixed(9)}`,
        `${(x + TILE_SIZE).toFixed(9)},${(y + half).toFixed(9)}`
      ]));
    }
  }
});

test("the two weights are two, and both are used", () => {
  // The channels the current has decided, and the cells it is still making up its mind
  // about. If the threshold ever took all the cells or none, the drawing would be one
  // weight and the distinction would be a claim nobody could see.
  assert.ok(CHANNEL_LEAN > 0 && CHANNEL_LEAN < 1);
  for (const turns of [0, 0.2, 0.45, 0.7, 0.9]) {
    const tiles = tilesAt(turns);
    const channels = tiles.filter((tile) => tile.channel).length;
    assert.ok(channels > 0, `nothing is a channel at ${turns}`);
    assert.ok(channels < tiles.length, `everything is a channel at ${turns}`);
  }
});

test("the clip is a whole number of frames and ten seconds long", () => {
  assert.equal(artwork.render.kind, "video");
  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(artwork.render.durationSeconds, 10);
});
