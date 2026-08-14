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
 * fabric: neither family alone is anything but stripes. A warm russet runs one way and
 * a cool steel the other, on paper; the weave holds a while when it is whole, then lets
 * go, so the clip returns to the bare floor it began on.
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

/**
 * The floor, and the two directions' voices.
 *
 * A weave is a thing of a room, so it is laid on the paper the other indoor works are
 * drawn on rather than on a dark loom, and the two families are timbers rather than
 * paints: a russet and a steel, dark enough to read against the paper and quiet enough
 * to sit beside it. Two colours, because the artwork's line from Heraclitus is about two
 * directions in opposition and nothing else here has to be told apart.
 */
const GROUND = [230, 224, 208];
const WARP_RUSSET = [166, 110, 66];
const WEFT_STEEL = [88, 104, 124];
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
      const family = tile.horizontal ? WARP_RUSSET : WEFT_STEEL;
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
