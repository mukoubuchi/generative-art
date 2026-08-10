import {
  CYCLE_STEPS,
  FULLY_EXTENDED_STEP,
  STEPS_PER_SECOND,
  advance,
  arcSpan,
  createState,
  stateAfter
} from "./simulation.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const CYCLES = 4;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The Processing sketch drew a 80 px arc with a 20 px stroke on a 100 px canvas, so the
// stroke reached exactly the canvas edge. The proportions of the indicator are kept —
// stroke is 2/5 of the outer radius, the arc centre line 4/5 of it — but the whole thing
// is scaled to 4/10 of the canvas so it has a margin to spin in.
const ARC_OUTER_RADIUS = BASE_DIMENSION * 0.4;
const STROKE_WEIGHT = ARC_OUTER_RADIUS * (20 / 50);
const ARC_DIAMETER = 2 * ARC_OUTER_RADIUS * (40 / 50);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = CYCLES * CYCLE_STEPS / STEPS_PER_FRAME;
// The state machine begins with a zero-length arc, which would open the clip on a blank
// frame. Starting where the arc is fully extended gives the clip a legible first frame
// and, over a whole number of cycles, an equally legible last one.
const FIRST_STEP = FULLY_EXTENDED_STEP;
const STROKE_COLOR = [0, 0, 255, 200];

const liveState = stateAfter(FIRST_STEP);

const P5 = window.p5;

new P5((p) => {
  function drawState(state) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(255);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.rotate(state.angle);
    p.noFill();
    p.stroke(...STROKE_COLOR);
    p.strokeWeight(STROKE_WEIGHT);
    p.strokeCap(p.SQUARE);
    const span = arcSpan(state);
    p.arc(
      0,
      0,
      ARC_DIAMETER,
      ARC_DIAMETER,
      p.radians(span.start),
      p.radians(span.end),
      p.OPEN
    );
    p.pop();
  }

  function publishState(frameIndex, state) {
    const span = arcSpan(state);
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      cycleSteps: CYCLE_STEPS,
      sweepDegrees: span.end - span.start,
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
      // Nothing accumulates between frames, so each one is recomputed from the start.
      // That makes any frame index reproducible on its own.
      window.__renderFrame = (frameIndex) => {
        const state = stateAfter(FIRST_STEP + frameIndex * STEPS_PER_FRAME);
        drawState(state);
        return Promise.resolve(publishState(frameIndex, state));
      };
    }
    drawState(liveState);
    publishState(0, liveState);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    for (let step = 0; step < STEPS_PER_FRAME; step += 1) {
      advance(liveState);
    }
    drawState(liveState);
    publishState(p.frameCount, liveState);
  };
});
