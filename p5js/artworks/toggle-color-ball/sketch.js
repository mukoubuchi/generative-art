import {
  CYCLE_STEPS,
  DISC_COUNT,
  STEPS_PER_SECOND,
  discColor,
  discOffset,
  discState
} from "./discs.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// Ratios of the Processing sketch's 600 px canvas: swing 200, disc diameter 280. The
// discs run past the canvas edge at full swing there too; that full-bleed crop is the
// composition, not an accident of the canvas size.
const SWING_RADIUS = BASE_DIMENSION * (200 / 600);
const DISC_DIAMETER = BASE_DIMENSION * (280 / 600);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = CYCLE_STEPS / STEPS_PER_FRAME;
const QUARTER_TURN = Math.PI / 2;
// The Processing sketch turned the whole group three eighths of a turn to sit the discs
// squarely in the canvas, then a further quarter turn per handover.
const GROUP_ROTATION = QUARTER_TURN * 1.5;

const P5 = window.p5;

new P5((p) => {
  function render(step) {
    const state = discState(step);
    const offset = discOffset(state.theta, SWING_RADIUS);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(255);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.rotate(GROUP_ROTATION + state.frontDisc * QUARTER_TURN);
    p.noStroke();
    for (let index = 0; index < DISC_COUNT; index += 1) {
      p.fill(...discColor(state.frontDisc, index));
      p.ellipse(0, offset, DISC_DIAMETER, DISC_DIAMETER);
      p.rotate(QUARTER_TURN);
    }
    p.pop();

    return state;
  }

  function publishState(frameIndex, state) {
    const published = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      counterDegrees: state.counterDegrees,
      frontDisc: state.frontDisc,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = published;
    window.__ARTWORK_READY__ = true;
    return published;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // Each frame is a pure function of its index, so any one can be drawn on its own.
      window.__renderFrame = (frameIndex) => Promise.resolve(
        publishState(frameIndex, render(frameIndex * STEPS_PER_FRAME))
      );
    }
    publishState(0, render(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    publishState(p.frameCount, render(p.frameCount * STEPS_PER_FRAME));
  };
});
