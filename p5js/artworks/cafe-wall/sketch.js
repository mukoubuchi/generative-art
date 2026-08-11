import { TOTAL_FRAMES, courses, rowShift, wallState } from "./wall.js";

/**
 * The café wall illusion, with its two levers pulled one at a time. The mortar lines
 * between the courses are horizontal for every frame of the clip — the layout cannot
 * even express anything else — and still they bow into wedges while alternate rows sit
 * half a tile out of phase and the mortar's grey sits between the tiles' luminances.
 * The clip then lightens the mortar out of existence with the geometry frozen, and the
 * wedges drain away; brings it back; and slides the offset on to a whole tile, where
 * the checkerboard's own symmetry kills the illusion with the mortar untouched.
 */
const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 640;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

const ROWS = 8;
const MORTAR_TILES = 1 / 12;
// Square tiles: the height carries the eight courses and their seven mortar joints.
const TILE = LOGICAL_HEIGHT / (ROWS + (ROWS - 1) * MORTAR_TILES);
const MORTAR = TILE * MORTAR_TILES;

const DARK_TILE = [18, 22, 30];
const LIGHT_TILE = [235, 228, 214];
// Mid-grey at blend 0 — between the tiles' luminances, where the illusion lives — and
// the light tiles' own colour at blend 1, where the joints vanish into the courses.
const MORTAR_GREY = [126, 125, 122];

const BANDS = courses(ROWS, MORTAR_TILES);

const P5 = window.p5;

new P5((p) => {
  function drawFrame(frameIndex) {
    const state = wallState(frameIndex);
    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    // The mortar is the ground: tiles are laid over it, so the joints are simply where
    // tiles are not.
    const mortarColor = MORTAR_GREY.map(
      (channel, index) => channel + (LIGHT_TILE[index] - channel) * state.mortarBlend
    );
    p.background(...mortarColor);
    for (const band of BANDS) {
      const top = band.top * TILE;
      const shift = rowShift(band.row, state.offsetTiles) * TILE;
      // Two spare tiles either side cover every phase of the two-tile pattern.
      for (let column = -2; column < LOGICAL_WIDTH / TILE + 2; column += 1) {
        p.fill(...(((column % 2) + 2) % 2 === 0 ? DARK_TILE : LIGHT_TILE));
        p.rect(column * TILE + shift, top, TILE, TILE);
      }
    }
    p.pop();
    return state;
  }

  function publishState(frameIndex, state) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      offsetTiles: state.offsetTiles,
      mortarBlend: state.mortarBlend,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
    }
    publishState(0, drawFrame(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawFrame(frameIndex));
  };
});
