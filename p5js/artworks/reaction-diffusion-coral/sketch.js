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
    for (let outputY = 0; outputY < OUTPUT_HEIGHT; outputY += 1) {
      const gridY = outputY * (SIM_SIZE - 1.001) / (OUTPUT_HEIGHT - 1);
      const logicalY = outputY / RENDER_SCALE;
      const normalizedY = (outputY - OUTPUT_HEIGHT * 0.5) / (OUTPUT_HEIGHT * VIGNETTE_SCALE);
      for (let outputX = 0; outputX < OUTPUT_WIDTH; outputX += 1) {
        const gridX = outputX * (SIM_SIZE - 1.001) / (OUTPUT_WIDTH - 1);
        const concentration = sampleBilinear(simulation.chemicalB, gridX, gridY);
        const body = Math.min(1, concentration * 2.35);
        const ridge = Math.exp(-(((concentration - 0.27) / 0.105) ** 2));
        // The palette noise is read in logical coordinates so the export scale changes the
        // resolution of the image without changing the size of its colour drift.
        const logicalX = outputX / RENDER_SCALE;
        const hue = 340 + p.noise(
          logicalX * PALETTE_NOISE_SCALE,
          logicalY * PALETTE_NOISE_SCALE
        ) * 42;

        const normalizedX = (outputX - OUTPUT_WIDTH * 0.5) / (OUTPUT_WIDTH * VIGNETTE_SCALE);
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
        const offset = (outputX + outputY * OUTPUT_WIDTH) * 4;
        pixels[offset] = red;
        pixels[offset + 1] = green;
        pixels[offset + 2] = blue;
        pixels[offset + 3] = 255;
      }
    }
    p.updatePixels();
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
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
