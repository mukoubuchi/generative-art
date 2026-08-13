import { spiralCells } from "./spiral.js";

/**
 * The counting numbers wound into a square coil, and only the primes drawn. The layout
 * knows nothing about primality, so the diagonals the dots crowd onto are not put there
 * by the drawing — they are the quadratic polynomials a spiral diagonal carries, some of
 * which happen to be rich in primes.
 *
 * The page lays the numbers down the way the spiral does, from the centre out, because
 * the order of construction is the explanation: first the winding is visible, then the
 * dots take over and the diagonals assemble themselves. A capture skips the wait.
 */
const LOGICAL_SIZE = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

// An odd number of cells across, so the spiral's centre cell sits exactly at the middle.
// Enough rings that the eye reads streaks rather than speckle: the famous diagonals are
// a statistical surplus, and a statistic needs a population.
const CELLS_ACROSS = 399;
const CELL_SIZE = LOGICAL_SIZE / CELLS_ACROSS;
const CELL_COUNT = CELLS_ACROSS * CELLS_ACROSS;
// Wide enough that two primes sharing a diagonal nearly touch corner to corner, so a
// run of them fuses into a streak instead of staying a row of separate specks.
const DOT_RADIUS = CELL_SIZE * 0.38;
// How long the live page spends laying the numbers down, centre to rim.
const REVEAL_SECONDS = 9;
const REVEAL_FRAMES = REVEAL_SECONDS * PLAYBACK_FPS;
/**
 * The clip winds the spiral for those nine seconds and holds the finished field for one, so
 * a card looping it shows the primes standing on their diagonals rather than cutting from
 * the last ring straight back to bare ground.
 */
const CLIP_SECONDS = 10;
const TOTAL_FRAMES = CLIP_SECONDS * PLAYBACK_FPS;

const BACKGROUND = [13, 18, 27];
const DOT_COLOR = [235, 224, 200, 240];

const CELLS = spiralCells(CELL_COUNT);

const P5 = window.p5;

new P5((p) => {
  let revealed = 0;

  function cellCenter(cell) {
    // The module's y grows upward; the canvas's grows downward, so the grid is flipped
    // rather than the mathematics.
    return [
      LOGICAL_SIZE / 2 + cell.x * CELL_SIZE,
      LOGICAL_SIZE / 2 - cell.y * CELL_SIZE
    ];
  }

  function drawCells(from, to) {
    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    p.fill(...DOT_COLOR);
    for (let index = from; index < to; index += 1) {
      const cell = CELLS[index];
      if (cell.prime) {
        const [x, y] = cellCenter(cell);
        p.circle(x, y, 2 * DOT_RADIUS);
      }
    }
    p.pop();
  }

  /**
   * How much of the walk has been laid down by `frameIndex`. Cubic in the time, so the
   * first seconds go slowly enough to watch the winding rule and the outer rings, which
   * only repeat the lesson, sweep past. A pure function of the index, which is what lets
   * any frame be asked for and answered the same way twice.
   */
  function revealedBy(frameIndex) {
    const part = Math.min(frameIndex / REVEAL_FRAMES, 1);
    return Math.min(Math.round(CELL_COUNT * part * part * part), CELL_COUNT);
  }

  /**
   * Winds the spiral forward until `target` cells are down. The dots accumulate and the
   * ground is never cleared, so this only goes forward; asked for an earlier frame than the
   * one already drawn, it lays the ground again and starts the walk over.
   */
  function windUpTo(target) {
    if (target < revealed) {
      p.background(...BACKGROUND);
      revealed = 0;
    }
    drawCells(revealed, target);
    revealed = target;
  }

  function publishState(frameIndex, revealedCells) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      cellsAcross: CELLS_ACROSS,
      cellCount: CELL_COUNT,
      revealedCells,
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    // Pinned only while capturing, and only after the canvas exists. Before it, p5 has
    // nothing to set the density on and the call is quietly ignored; on a Retina screen
    // the backing store then comes out twice the size asked for. Left alone in the
    // browser, so a reader on such a screen gets the picture drawn at their own
    // resolution -- and pinned here, so an export is the size the manifest says
    // rather than whatever density the machine doing the rendering happens to have.
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    p.background(...BACKGROUND);
    if (CAPTURE_MODE) {
      p.noLoop();
      // The dots accumulate and are never cleared, so a frame is wound up to rather than
      // drawn on its own. The renderer asks in order and the thumbnail asks for one from a
      // fresh page; winding forward from wherever the walk stands serves both.
      window.__renderFrame = (frameIndex) => {
        windUpTo(revealedBy(frameIndex));
        return Promise.resolve(publishState(frameIndex, revealed));
      };
    }
    publishState(0, 0);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    if (p.frameCount > TOTAL_FRAMES) {
      // The walk finished at nine seconds and the last second held it; there is nothing
      // further to lay down, and stopping keeps the page from spinning on a done picture.
      p.noLoop();
      return;
    }
    // The background never clears: each frame adds the next stretch of the walk, so what
    // accumulates on screen is the spiral itself being wound. The pace is cubic in time —
    // the first seconds walk the innermost rings slowly enough to watch the winding rule,
    // and the outer rings, which only repeat the lesson, sweep past.
    windUpTo(revealedBy(p.frameCount));
    publishState(p.frameCount, revealed);
  };
});
