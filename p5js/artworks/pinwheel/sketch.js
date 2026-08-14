import {
  DISSOLVE_FRAMES,
  FILL_FRAMES,
  GRID_SIZE,
  HOLD_FRAMES,
  LATTICE_FRAMES,
  TOTAL_FRAMES,
  emergentSquares,
  layingOrder
} from "./geometry.js";

/**
 * Order as arrangement: the tile walls go up first, quickly, along the diagonal sweep;
 * then the squares the walls have made — large and small, found by flooding the plan,
 * never placed — take their sits one by one, one russet at full strength for the great
 * and washed for the small, each in the spot the construction left for it. The whole
 * holds, then lets go, so the loop returns to the bare ground.
 */
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const UNIT = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) / GRID_SIZE;

/** How long one wall tile takes to drive in, and one square to take its seat. */
const DRIVE_FRAMES = 6;
const SEAT_FRAMES = 8;

/**
 * The paving, in one colour at two strengths.
 *
 * Herringbone next door is two directions in opposition and takes two hues for it. What
 * this construction leaves behind is not an opposition but two sizes of the same thing —
 * squares of side two and squares of side one — so one hue answers, at full strength for
 * the large family and washed towards the paper for the small. The walls are the paper
 * darkened a shade, which is what a joint between paving stones is.
 */
const GROUND = [230, 224, 208];
const WALL_JOINT = [205, 196, 178];
const LARGE_RUSSET = [166, 110, 66];
const SMALL_RUSSET = [206, 158, 96];
const WALL_WEIGHT = 0.07;

const TILES = layingOrder();
const SQUARES = emergentSquares();

const P5 = window.p5;

new P5((p) => {
  function drawPaving(frameIndex) {
    const dissolve = Math.max(0, frameIndex - (TOTAL_FRAMES - DISSOLVE_FRAMES)) / DISSOLVE_FRAMES;
    const fade = 1 - dissolve;

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.scale(UNIT);

    // The squares first, so the walls read over them as the joints of the paving.
    let seated = 0;
    SQUARES.forEach((square, index) => {
      const started = LATTICE_FRAMES + (index / SQUARES.length) * (FILL_FRAMES - SEAT_FRAMES);
      const seat = Math.min(Math.max((frameIndex - started) / SEAT_FRAMES, 0), 1);
      if (seat === 0) {
        return;
      }
      seated += 1;
      const family = square.size === 2 ? LARGE_RUSSET : SMALL_RUSSET;
      const grown = 0.55 + 0.45 * seat;
      const centreX = square.x + square.size / 2;
      const centreY = square.y + square.size / 2;
      p.noStroke();
      p.fill(...family, 255 * seat * fade);
      p.rect(
        centreX - (square.size / 2) * grown,
        centreY - (square.size / 2) * grown,
        square.size * grown,
        square.size * grown
      );
    });

    p.strokeCap(p.SQUARE);
    p.strokeWeight(WALL_WEIGHT);
    let laid = 0;
    TILES.forEach((tile, index) => {
      const started = (index / TILES.length) * (LATTICE_FRAMES - DRIVE_FRAMES);
      const drive = Math.min(Math.max((frameIndex - started) / DRIVE_FRAMES, 0), 1);
      if (drive === 0) {
        return;
      }
      laid += 1;
      p.stroke(...WALL_JOINT, 255 * fade);
      p.line(
        tile.x1,
        tile.y1,
        tile.x1 + (tile.x2 - tile.x1) * drive,
        tile.y1 + (tile.y2 - tile.y1) * drive
      );
    });
    p.pop();
    return { laid, seated };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      tiles: TILES.length,
      squares: SQUARES.length,
      laidTiles: drawn.laid,
      seatedSquares: drawn.seated,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
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
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawPaving(frameIndex)));
    }
    publishState(0, drawPaving(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawPaving(frameIndex));
  };
});
