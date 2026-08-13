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
const PLAYBACK_FPS = 30;
/**
 * The clip lays the field down over nine seconds and holds the finished image for one, so
 * that a card looping it shows what was made rather than cutting from the last stroke back
 * to bare ground. The page follows the same schedule, so what a reader watches forming is
 * the clip they would have seen.
 */
const CLIP_SECONDS = 10;
const REVEAL_SECONDS = 9;
const TOTAL_FRAMES = CLIP_SECONDS * PLAYBACK_FPS;
const REVEAL_FRAMES = REVEAL_SECONDS * PLAYBACK_FPS;
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

  /**
   * How many of the field's steps have been walked by `frameIndex`. A pure function of the
   * index, which is what lets the renderer ask for a frame and get the same picture every
   * time — and what lets the thumbnail jump straight to one from a fresh page.
   */
  function stepsBy(frameIndex) {
    const part = Math.min(frameIndex / REVEAL_FRAMES, 1);
    return Math.min(TOTAL_STEPS, Math.round(TOTAL_STEPS * part));
  }

  /**
   * Walks the field forward until `target` steps have been laid down. The trails accumulate
   * on the canvas rather than being redrawn, so this only ever goes forward; asked for an
   * earlier frame than the one already drawn, it starts the field again from its seed.
   */
  function paintUpTo(target) {
    if (target < stepsDrawn) {
      reset();
    }
    paintSteps(target - stepsDrawn);
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

  function publishState(frameIndex) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      seed: ART_SEED,
      particleCount: particles.length,
      stepsDrawn,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  /** Back to bare ground with the same seed, which is where every frame is counted from. */
  function reset() {
    p.randomSeed(ART_SEED);
    p.noiseSeed(ART_SEED);
    p.background(...BACKGROUND);
    particles = createParticles(LOGICAL_WIDTH, LOGICAL_HEIGHT, (low, high) => p.random(low, high));
    stepsDrawn = 0;
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
    context = p.drawingContext;
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.frameRate(PLAYBACK_FPS);
    // Seeded in reset rather than in draw, because the trails accumulate across every step
    // and the image is a function of the seed and the step count alone.
    reset();

    if (CAPTURE_MODE) {
      p.noLoop();
      // The trails are laid on top of one another and never cleared, so a frame is not
      // drawn on its own: it is walked up to. The renderer asks for frames in order and the
      // thumbnail asks for one from a fresh page, and both are served by walking forward
      // from wherever the field has got to.
      window.__renderFrame = (frameIndex) => {
        paintUpTo(stepsBy(frameIndex));
        return Promise.resolve(publishState(frameIndex));
      };
    }
    publishState(0);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }

    // On the page the field fills to the same schedule the clip follows, so what is watched
    // forming here is what the clip shows.
    paintUpTo(stepsBy(p.frameCount));
    publishState(p.frameCount);
    if (p.frameCount >= TOTAL_FRAMES) {
      p.noLoop();
    }
  };
});
