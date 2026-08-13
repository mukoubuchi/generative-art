import {
  ART_SEED,
  ITERATIONS,
  SIM_SIZE,
  createSimulation,
  run,
  sampleBilinear,
  seedColonies
} from "./reaction.js";
import { hsbToRgb } from "../shared/color.js";

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

const P5 = window.p5;

new P5((p) => {
  function paint(simulation) {
    p.loadPixels();
    // The sketch reseeded before rendering so the brightness dither did not depend on how
    // many draws the colony had taken.
    p.randomSeed(ART_SEED + 1);

    const pixels = p.pixels;
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
      const gridY = backingY * (SIM_SIZE - 1.001) / (backingHeight - 1);
      const logicalY = backingY / perLogical;
      const normalizedY = (backingY - backingHeight * 0.5) / (backingHeight * VIGNETTE_SCALE);
      for (let backingX = 0; backingX < backingWidth; backingX += 1) {
        const gridX = backingX * (SIM_SIZE - 1.001) / (backingWidth - 1);
        const concentration = sampleBilinear(simulation.chemicalB, gridX, gridY);
        const body = Math.min(1, concentration * 2.35);
        const ridge = Math.exp(-(((concentration - 0.27) / 0.105) ** 2));
        // The palette noise is read in logical coordinates so the export scale changes the
        // resolution of the image without changing the size of its colour drift.
        const logicalX = backingX / perLogical;
        const hue = 340 + p.noise(
          logicalX * PALETTE_NOISE_SCALE,
          logicalY * PALETTE_NOISE_SCALE
        ) * 42;

        const normalizedX = (backingX - backingWidth * 0.5) / (backingWidth * VIGNETTE_SCALE);
        const vignette = Math.max(
          0,
          Math.min(1, 1 - normalizedX * normalizedX - normalizedY * normalizedY)
        );
        const saturation = 72 + body * 18 - ridge * 20;
        const brightness = (3.8 + body * 48 + ridge * 48 + p.random(-1.6, 1.6))
          * (0.48 + 0.52 * Math.pow(vignette, 0.24));

        const [red, green, blue] = hsbToRgb(
          hue,
          Math.max(0, Math.min(100, saturation)),
          Math.max(0, Math.min(100, brightness))
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
    // Both generators are reseeded here rather than in setup, so the image is a function
    // of the seed alone however many times the sketch is drawn.
    p.randomSeed(ART_SEED);
    p.noiseSeed(ART_SEED);
    p.noiseDetail(NOISE_OCTAVES, NOISE_FALLOFF);

    const simulation = createSimulation((x, y) => p.noise(x, y));
    seedColonies(simulation, (low, high) => p.random(low, high));
    run(simulation, ITERATIONS);
    paint(simulation);

    window.__ARTWORK_STATE__ = {
      kind: "image",
      seed: ART_SEED,
      iterations: ITERATIONS,
      simulationSize: SIM_SIZE,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
