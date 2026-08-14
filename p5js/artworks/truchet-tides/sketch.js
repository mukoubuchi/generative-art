import { COLUMN_COUNT, ROW_COUNT, tileArcs, tilesAt } from "./tiles.js";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 640;
const PLAYBACK_FPS = 30;
const DURATION_SECONDS = 10;
const TOTAL_FRAMES = DURATION_SECONDS * PLAYBACK_FPS;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const MARGIN = 32;
// The grid divides the framed area exactly: fourteen columns of sixty-four across 896 px,
// and nine rows of the same size down 576 px.
const TILE_SIZE = (LOGICAL_WIDTH - MARGIN * 2) / COLUMN_COUNT;
const CHANNEL_WEIGHT = TILE_SIZE * 0.11;
const EDDY_WEIGHT = TILE_SIZE * 0.045;

/**
 * Paper and one indigo. It was a hue that ran from cyan to deep blue over four stacked
 * passes of glow, on a paper painted pixel by pixel out of noise, and at twenty-eight
 * columns by eighteen the whole thing came out the size of graph paper: an even texture
 * with nothing happening at any scale a person looks at. The grid is half as fine, the
 * glow is gone, and the ink is one colour at two weights — the channels the current has
 * decided, and the cells it is still making up its mind about.
 */
const PAPER = [230, 224, 208];
const INK = [38, 52, 74];

const P5 = window.p5;

new P5((p) => {
  function drawTides(frameIndex) {
    const turns = (frameIndex % TOTAL_FRAMES) / TOTAL_FRAMES;
    const tiles = tilesAt(turns);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...PAPER);
    p.noFill();
    p.stroke(...INK);
    p.strokeCap(p.ROUND);
    let channels = 0;
    for (const tile of tiles) {
      channels += tile.channel ? 1 : 0;
      p.strokeWeight(tile.channel ? CHANNEL_WEIGHT : EDDY_WEIGHT);
      for (const arc of tileArcs(tile, TILE_SIZE, MARGIN)) {
        p.arc(arc.x, arc.y, arc.diameter, arc.diameter, arc.start, arc.stop);
      }
    }
    p.pop();

    return { turns, tiles: tiles.length, channels };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      turns: drawn.turns,
      tiles: drawn.tiles,
      channelTiles: drawn.channels,
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
      // Every frame is a pure function of its index -- the field is three sinusoids of the
      // frame and nothing else -- so any frame can be drawn on its own.
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawTides(frameIndex)));
    }
    publishState(0, drawTides(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    publishState(p.frameCount, drawTides(p.frameCount));
  };
});
