import {
  ART_SEED,
  ITERATIONS,
  SIM_SIZE,
  advance,
  createSimulation,
  sampleBilinear,
  seedColonies
} from "./reaction.js";
import { hsbToRgb } from "../shared/color.js";

/**
 * A Gray-Scott colony, shown forming.
 *
 * The still this artwork used to be was the twelve-hundredth step of a reaction that had
 * been run out of sight. The clip is those twelve hundred steps, in order and at one rate:
 * seventy-two seeded specks feed, spread and poison one another until the field has settled
 * into the coral it was always going to settle into. Nothing is placed and nothing is
 * drawn on top -- the pattern is what the two chemicals do to each other, and the last
 * frame is step twelve hundred, which is the picture the catalogue has always carried.
 *
 * The palette and the dither belong to the paper rather than to the moment, so they are
 * measured once and read from there. Everything that moves is concentration.
 */

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const NOISE_OCTAVES = 4;
const NOISE_FALLOFF = 0.55;
const PALETTE_NOISE_SCALE = 0.00515;
const VIGNETTE_SCALE = 0.72;
const PLAYBACK_FPS = 30;
const GROWTH_SECONDS = 9;
const CLIP_SECONDS = GROWTH_SECONDS + 1;
const TOTAL_FRAMES = CLIP_SECONDS * PLAYBACK_FPS;
const GROWTH_FRAMES = GROWTH_SECONDS * PLAYBACK_FPS;

const P5 = window.p5;

new P5((p) => {
  /**
   * The paper: everything a pixel's colour depends on that the reaction has no say in.
   *
   * The hue drift is a noise field over the page and the brightness dither is one draw
   * from a stream reseeded before every paint, so both are the same at step one as at step
   * twelve hundred. Reading them off a table costs one walk of the canvas instead of three
   * hundred, and the numbers are the ones the single-pass paint used to compute inline --
   * the same calls, in the same order, from the same seeds.
   *
   * Kept at full precision, and that is not fussiness. Stored as single floats the two
   * tables came back a hair off, and a hair is enough to carry a brightness across the
   * boundary between one byte and the next: two pixels of the five and a half million came
   * out one step from the picture this artwork registers. The vignette's factor is tabled
   * the same way and for the same reason: it is a fractional power of the pixel's own
   * position, the most expensive thing in the loop that the reaction has no say in.
   */
  let paper = null;

  function measurePaper() {
    p.randomSeed(ART_SEED + 1);
    const density = p.pixelDensity();
    const backingWidth = OUTPUT_WIDTH * density;
    const backingHeight = OUTPUT_HEIGHT * density;
    const perLogical = RENDER_SCALE * density;
    const hues = new Float64Array(backingWidth * backingHeight);
    const dither = new Float64Array(backingWidth * backingHeight);
    const lighting = new Float64Array(backingWidth * backingHeight);
    for (let backingY = 0; backingY < backingHeight; backingY += 1) {
      const logicalY = backingY / perLogical;
      const normalizedY = (backingY - backingHeight * 0.5) / (backingHeight * VIGNETTE_SCALE);
      for (let backingX = 0; backingX < backingWidth; backingX += 1) {
        // The palette noise is read in logical coordinates so the export scale changes the
        // resolution of the image without changing the size of its colour drift.
        const logicalX = backingX / perLogical;
        const cell = backingX + backingY * backingWidth;
        hues[cell] = 340 + p.noise(
          logicalX * PALETTE_NOISE_SCALE,
          logicalY * PALETTE_NOISE_SCALE
        ) * 42;
        dither[cell] = p.random(-1.6, 1.6);
        const normalizedX = (backingX - backingWidth * 0.5) / (backingWidth * VIGNETTE_SCALE);
        const vignette = Math.max(
          0,
          Math.min(1, 1 - normalizedX * normalizedX - normalizedY * normalizedY)
        );
        lighting[cell] = 0.48 + 0.52 * Math.pow(vignette, 0.24);
      }
    }
    return { hues, dither, lighting, backingWidth, backingHeight };
  }

  function paint(simulation) {
    p.loadPixels();
    const pixels = p.pixels;
    // The canvas is as many pixels across as the export scale asks for, times whatever the
    // display puts on top of that: on a Retina screen the backing store is twice the size
    // again. Writing a logical grid into a denser buffer fills one corner of it and leaves
    // the rest untouched, which is what put two copies of this picture in the top quarter
    // of the canvas on such a screen. So the density is read and the backing store is what
    // gets walked. At a density of one this is the loop it has always been, byte for byte;
    // above one the picture is computed at the resolution it is actually shown at.
    const { hues, dither, lighting, backingWidth, backingHeight } = paper;
    for (let backingY = 0; backingY < backingHeight; backingY += 1) {
      const gridY = backingY * (SIM_SIZE - 1.001) / (backingHeight - 1);
      for (let backingX = 0; backingX < backingWidth; backingX += 1) {
        const gridX = backingX * (SIM_SIZE - 1.001) / (backingWidth - 1);
        const concentration = sampleBilinear(simulation.chemicalB, gridX, gridY);
        const body = Math.min(1, concentration * 2.35);
        const ridge = Math.exp(-(((concentration - 0.27) / 0.105) ** 2));
        const cell = backingX + backingY * backingWidth;
        const saturation = 72 + body * 18 - ridge * 20;
        const brightness = (3.8 + body * 48 + ridge * 48 + dither[cell]) * lighting[cell];

        const [red, green, blue] = hsbToRgb(
          hues[cell],
          Math.max(0, Math.min(100, saturation)),
          Math.max(0, Math.min(100, brightness))
        );
        const offset = cell * 4;
        pixels[offset] = red;
        pixels[offset + 1] = green;
        pixels[offset + 2] = blue;
        pixels[offset + 3] = 255;
      }
    }
    p.updatePixels();
  }

  /** The colony, and how many steps it has taken. */
  let colony = null;
  let taken = 0;

  function seed() {
    // Both generators are reseeded here rather than in setup, so the field is a function
    // of the seed alone however many times the sketch is rebuilt.
    p.randomSeed(ART_SEED);
    p.noiseSeed(ART_SEED);
    p.noiseDetail(NOISE_OCTAVES, NOISE_FALLOFF);
    colony = createSimulation((x, y) => p.noise(x, y));
    seedColonies(colony, (low, high) => p.random(low, high));
    taken = 0;
  }

  /**
   * How many steps the reaction has taken by `frameIndex`: one rate throughout, so what a
   * reader watches is the reaction's own pace and not an eased account of it.
   */
  function stepsBy(frameIndex) {
    return Math.round(ITERATIONS * Math.min(frameIndex / GROWTH_FRAMES, 1));
  }

  /**
   * Runs the colony out to `target` steps. A reaction cannot be run backwards, so a frame
   * asked for out of order is served by seeding again and running forward to it -- which
   * is what lets the thumbnail jump to a frame on a fresh page.
   */
  function runTo(target) {
    if (target < taken) {
      seed();
    }
    while (taken < target) {
      advance(colony);
      taken += 1;
    }
    return taken;
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
    // Seeded first: the paper's hue drift is read from the same noise field the colony is
    // built from, and that field is only the artwork's once noiseSeed and noiseDetail have
    // been set. Measuring the paper before seeding would read p5's default octaves and
    // quietly shift every hue on the page.
    seed();
    paper = measurePaper();
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
    }
    publishState(0, drawFrame(0));
  };

  function publishState(frameIndex, steps) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      steps,
      seed: ART_SEED,
      iterations: ITERATIONS,
      simulationSize: SIM_SIZE,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  /** Runs the colony out to `frameIndex`, paints it, and says how many steps it has taken. */
  function drawFrame(frameIndex) {
    const steps = runTo(stepsBy(frameIndex));
    paint(colony);
    return steps;
  }

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The page runs the reaction to the same schedule the clip follows, frame for frame,
    // and then holds the settled colony: what is watched forming here is what the clip
    // shows. A page paints where the clip only counts, so a reader's screen may take
    // longer over it than ten seconds; the sequence is the same one.
    publishState(p.frameCount, drawFrame(p.frameCount));
    if (p.frameCount >= TOTAL_FRAMES) {
      p.noLoop();
    }
  };
});
