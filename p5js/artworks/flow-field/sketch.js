import { hsbToRgb } from "../shared/color.js";
import {
  ART_SEED,
  TOTAL_STEPS,
  advanceParticles,
  createParticles
} from "./field.js";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 640;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const TRAIL_WEIGHT = 1.1;
const TRAIL_SATURATION = 55;
const TRAIL_BRIGHTNESS = 95;
/**
 * Each segment is laid down at six per cent opacity, so a trail only becomes visible where
 * many particles have followed the same line. The image is a density map, not a drawing.
 */
const TRAIL_ALPHA = 0.06;
const BACKGROUND = [228, 22, 10];

const P5 = window.p5;

new P5((p) => {
  let particles = [];
  let stepsDrawn = 0;
  let context;

  /**
   * The rgba string for a particle's hue, rebuilt only when a replacement gives it a new
   * one. There are 1.665 million segments in a finished image; formatting a colour for each
   * of them would cost more than drawing them.
   */
  function strokeFor(particle) {
    if (particle.cachedHue !== particle.hue) {
      const [red, green, blue] = hsbToRgb(particle.hue, TRAIL_SATURATION, TRAIL_BRIGHTNESS);
      particle.cachedHue = particle.hue;
      particle.cachedStroke = `rgba(${red},${green},${blue},${TRAIL_ALPHA})`;
    }
    return particle.cachedStroke;
  }

  function drawSegment(particle, nextX, nextY) {
    context.strokeStyle = strokeFor(particle);
    context.beginPath();
    context.moveTo(particle.x, particle.y);
    context.lineTo(nextX, nextY);
    context.stroke();
  }

  /** Runs at most `requested` steps, stopping at the total the finished image is made of. */
  function paintSteps(requested) {
    const noise = (x, y) => p.noise(x, y);
    const random = (low, high) => p.random(low, high);
    const steps = Math.min(requested, TOTAL_STEPS - stepsDrawn);

    p.push();
    // The canvas is drawn in logical coordinates and the export scale is a transform, so a
    // larger export is the same picture at a higher resolution rather than a wider field.
    p.scale(RENDER_SCALE);
    context.lineWidth = TRAIL_WEIGHT;
    context.lineCap = "round";
    for (let step = 0; step < steps; step += 1) {
      advanceParticles(particles, LOGICAL_WIDTH, LOGICAL_HEIGHT, noise, random, drawSegment);
    }
    p.pop();
    stepsDrawn += steps;
  }

  function publishState() {
    window.__ARTWORK_STATE__ = {
      kind: "image",
      seed: ART_SEED,
      particleCount: particles.length,
      stepsDrawn,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    context = p.drawingContext;
    p.colorMode(p.HSB, 360, 100, 100, 100);
    // Seeded here rather than in draw, because the trails accumulate across every step and
    // the image is a function of the seed and the step count alone.
    p.randomSeed(ART_SEED);
    p.noiseSeed(ART_SEED);
    p.background(...BACKGROUND);

    particles = createParticles(LOGICAL_WIDTH, LOGICAL_HEIGHT, (low, high) => p.random(low, high));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      paintSteps(TOTAL_STEPS);
      publishState();
      window.__ARTWORK_READY__ = true;
      p.noLoop();
      return;
    }

    // On the page the field fills in one step per frame, so the trails are watched forming
    // over the same 900 steps the capture runs all at once.
    paintSteps(1);
    publishState();
    if (stepsDrawn >= TOTAL_STEPS) {
      window.__ARTWORK_READY__ = true;
      p.noLoop();
    }
  };
});
