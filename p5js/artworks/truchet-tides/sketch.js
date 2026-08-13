import { hsbToRgb } from "../shared/color.js";
import {
  COLUMN_COUNT,
  ROW_COUNT,
  TIDE_LAYERS,
  buildTiles,
  layerStroke,
  tileArcs
} from "./tiles.js";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 640;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const ART_SEED = 20260808;
const MARGIN = 32;
// The grid divides the framed area exactly: 28 columns of 32 across 896 px, and 18 rows of
// the same size down 576 px.
const TILE_SIZE = (LOGICAL_WIDTH - MARGIN * 2) / COLUMN_COUNT;
const NOISE_OCTAVES = 5;
const NOISE_FALLOFF = 0.54;
const PAPER_NOISE_X = 0.00417;
const PAPER_NOISE_Y = 0.00625;

const P5 = window.p5;

new P5((p) => {
  function paintPaper() {
    p.loadPixels();
    p.randomSeed(ART_SEED + 1);

    const pixels = p.pixels;
    const halfWidth = LOGICAL_WIDTH * 0.5;
    const halfHeight = LOGICAL_HEIGHT * 0.5;
    const maximumDistance = Math.hypot(halfWidth, halfHeight);
    const innerRadius = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) * 0.2;
    // The canvas is as many pixels across as the export scale asks for, times whatever the
    // display puts on top of that: on a Retina screen the backing store is twice the size
    // again. Writing a logical grid into a denser buffer fills one corner of it and leaves
    // the rest untouched, which is what put two copies of this picture in the top quarter
    // of the canvas on such a screen. So the density is read and the backing store is what
    // gets walked. At a density of one this is the loop it has always been, byte for byte;
    // above one the picture is computed at the resolution it is actually shown at.
    const density = p.pixelDensity();
    const backingWidth = OUTPUT_WIDTH * density;
    const backingHeight = OUTPUT_HEIGHT * density;
    const perLogical = RENDER_SCALE * density;
    for (let backingY = 0; backingY < backingHeight; backingY += 1) {
      // Read in logical coordinates so the export scale changes the resolution without
      // changing the size of the paper's texture.
      const logicalY = backingY / perLogical;
      for (let backingX = 0; backingX < backingWidth; backingX += 1) {
        const logicalX = backingX / perLogical;
        const broad = p.noise(logicalX * PAPER_NOISE_X, logicalY * PAPER_NOISE_Y);
        const grain = p.random(-1.35, 1.35);
        const distance = Math.hypot(logicalX - halfWidth, logicalY - halfHeight);
        const edgeShade = Math.max(0, Math.min(
          4.5,
          (distance - innerRadius) / (maximumDistance - innerRadius) * 4.5
        ));
        const [red, green, blue] = hsbToRgb(
          43 + broad * 5,
          10 + broad * 5,
          Math.max(0, Math.min(100, 97 - edgeShade + grain))
        );
        const offset = (backingX + backingY * backingWidth) * 4;
        pixels[offset] = red;
        pixels[offset + 1] = green;
        pixels[offset + 2] = blue;
        pixels[offset + 3] = 255;
      }
    }
    p.updatePixels();
  }

  function drawTides(tiles) {
    p.noFill();
    p.strokeCap(p.ROUND);
    for (const layer of TIDE_LAYERS) {
      p.strokeWeight(layer.weight);
      for (const tile of tiles) {
        const ink = layerStroke(layer, tile);
        p.stroke(ink.hue, ink.saturation, ink.brightness, ink.alpha);
        for (const shape of tileArcs(tile, TILE_SIZE, MARGIN)) {
          p.arc(shape.x, shape.y, shape.diameter, shape.diameter, shape.start, shape.stop, p.OPEN);
        }
      }
    }
  }

  function drawFrame() {
    p.noFill();
    p.stroke(210, 44, 38, 34);
    p.strokeWeight(1.2);
    p.rect(MARGIN, MARGIN, LOGICAL_WIDTH - MARGIN * 2, LOGICAL_HEIGHT - MARGIN * 2);
    p.stroke(44, 16, 100, 55);
    p.strokeWeight(0.65);
    p.rect(
      MARGIN + 2,
      MARGIN + 2,
      LOGICAL_WIDTH - MARGIN * 2 - 4,
      LOGICAL_HEIGHT - MARGIN * 2 - 4
    );
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
    p.noLoop();
  };

  p.draw = () => {
    // Seeded here rather than in setup, so the image is a function of the seed alone.
    p.randomSeed(ART_SEED);
    p.noiseSeed(ART_SEED);
    p.noiseDetail(NOISE_OCTAVES, NOISE_FALLOFF);

    const tiles = buildTiles((x, y) => p.noise(x, y));
    // The paper is painted through the pixel buffer, which ignores the transform, so the
    // scale is applied only to the strokes that follow.
    paintPaper();
    p.push();
    p.scale(RENDER_SCALE);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    drawTides(tiles);
    drawFrame();
    p.pop();

    window.__ARTWORK_STATE__ = {
      kind: "image",
      seed: ART_SEED,
      tileCount: tiles.length,
      grid: { columns: COLUMN_COUNT, rows: ROW_COUNT },
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
