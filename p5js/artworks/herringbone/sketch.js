import {
  DISSOLVE_FRAMES,
  GRID_SIZE,
  HOLD_FRAMES,
  LAY_FRAMES,
  TOTAL_FRAMES,
  layingOrder
} from "./geometry.js";

/**
 * A weave laid before the eyes. Two families of tiles — one running with the warp,
 * one against it — arrive together along a diagonal sweep, each plank driven in along
 * its own axis beside the crosswise planks it locks with. The opposition is the
 * fabric: neither family alone is anything but stripes. Warm ochre runs one way,
 * cool slate the other, on a dark loom; the weave holds a while when it is whole,
 * then lets go, so the clip returns to the empty loom it began on.
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

/** How long one plank takes to drive in along its own axis. */
const DRIVE_FRAMES = 9;

/** The loom, and the two directions' voices. */
const GROUND = [16, 14, 12];
const WARP_OCHRE = [224, 170, 100];
const WEFT_SLATE = [112, 148, 198];
/** Plank thickness in grid units: stout enough to read as timber, not hairline. */
const PLANK_WEIGHT = 0.3;

const TILES = layingOrder();

const P5 = window.p5;

new P5((p) => {
  function drawWeave(frameIndex) {
    const dissolve = Math.max(0, frameIndex - LAY_FRAMES - HOLD_FRAMES) / DISSOLVE_FRAMES;
    const fade = 1 - dissolve;

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.scale(UNIT);
    p.strokeCap(p.SQUARE);
    p.strokeWeight(PLANK_WEIGHT);
    let laid = 0;
    TILES.forEach((tile, index) => {
      const started = (index / TILES.length) * LAY_FRAMES;
      const drive = Math.min(Math.max((frameIndex - started) / DRIVE_FRAMES, 0), 1);
      if (drive === 0) {
        return;
      }
      laid += 1;
      const family = tile.horizontal ? WARP_OCHRE : WEFT_SLATE;
      p.stroke(...family, 255 * fade);
      p.line(
        tile.x1,
        tile.y1,
        tile.x1 + (tile.x2 - tile.x1) * drive,
        tile.y1 + (tile.y2 - tile.y1) * drive
      );
    });
    p.pop();
    return laid;
  }

  function publishState(frameIndex, laid) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      tiles: TILES.length,
      laidTiles: laid,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawWeave(frameIndex)));
    }
    publishState(0, drawWeave(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawWeave(frameIndex));
  };
});
