import {
  SLOWEST_REVOLUTION_SECONDS,
  STEPS_PER_SECOND,
  advance,
  createSpots,
  position
} from "./simulation.js";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 480;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// Ratios of the Processing sketch's 700x350 canvas: orbit 300, baseline 25, dot 10.
const ORBIT_RADIUS = BASE_DIMENSION * (300 / 350);
const BASELINE_OFFSET = BASE_DIMENSION * (25 / 350);
const SPOT_DIAMETER = BASE_DIMENSION * (10 / 350);
// One revolution of the outermost spot, so the clip ends where the motion began.
const TOTAL_FRAMES = SLOWEST_REVOLUTION_SECONDS * PLAYBACK_FPS;
// The video samples the 60-per-second simulation, so each frame is two steps.
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
// Processing's colour maxima were all 300 here, and the trail was a near-transparent
// black wash laid over the whole canvas before each frame.
const COLOR_MAX = 300;
const SPOT_SATURATION = 300;
const SPOT_BRIGHTNESS = 200;
const TRAIL_ALPHA = 10;

let spots = createSpots(ORBIT_RADIUS);
let renderedFrame = -1;

const P5 = window.p5;

new P5((p) => {
  function resetSimulation() {
    spots = createSpots(ORBIT_RADIUS);
    p.background(0, 0, 0);
    renderedFrame = -1;
  }

  function simulationStep() {
    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    p.fill(0, 0, 0, TRAIL_ALPHA);
    p.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - BASELINE_OFFSET);
    for (const spot of spots) {
      advance(spot);
      const { x, y } = position(spot);
      p.fill(spot.radiusRatio * COLOR_MAX, SPOT_SATURATION, SPOT_BRIGHTNESS);
      p.ellipse(x, y, SPOT_DIAMETER, SPOT_DIAMETER);
    }
    p.pop();
  }

  function stepOnce() {
    for (let step = 0; step < STEPS_PER_FRAME; step += 1) {
      simulationStep();
    }
    renderedFrame += 1;
  }

  /**
   * Trails accumulate, so a frame depends on every frame before it. Replaying from the
   * start whenever a frame is requested out of order keeps the same index producing the
   * same image; the renderer's own sequential walk still costs one step per frame.
   */
  function renderUpTo(frameIndex) {
    if (frameIndex < renderedFrame) {
      resetSimulation();
    }
    while (renderedFrame < frameIndex) {
      stepOnce();
    }
  }

  function publishState() {
    const state = {
      kind: "video",
      frameIndex: renderedFrame,
      totalFrames: TOTAL_FRAMES,
      spotCount: spots.length,
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
    p.colorMode(p.HSB, COLOR_MAX, COLOR_MAX, COLOR_MAX, COLOR_MAX);
    p.frameRate(PLAYBACK_FPS);
    p.background(0, 0, 0);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => {
        renderUpTo(frameIndex);
        return Promise.resolve(publishState());
      };
    }
    publishState();
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      // Frames are driven entirely by __renderFrame.
      return;
    }
    stepOnce();
    publishState();
  };
});
