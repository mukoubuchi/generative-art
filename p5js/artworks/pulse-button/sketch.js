import { hintMode } from "../shared/hint-mode.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  CYCLE_STEPS,
  PULSE_STEPS,
  STEPS_PER_SECOND,
  alphaAt,
  inkAlpha,
  isInsideButton,
  playTriangle,
  pulseScale,
  scheduledPulseStep
} from "./pulse.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const CAPTURE_CYCLES = 3;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
/** Only a press inside the button starts a pulse. */
const HINT_LEGEND = [
  { cap: "click", text: "the button pulses once" }
];
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The Processing sketch used a radius of 150 on a 600 px canvas.
const BUTTON_RADIUS = BASE_DIMENSION * (150 / 600);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = CAPTURE_CYCLES * CYCLE_STEPS / STEPS_PER_FRAME;

const TRIANGLE = playTriangle(BUTTON_RADIUS);
let livePulseStep = null;

const P5 = window.p5;

new P5((p) => {
  function render(pulseStep) {
    const alpha = alphaAt(pulseStep);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(255);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.scale(pulseScale(alpha));
    p.noStroke();
    p.fill(0, inkAlpha(alpha));
    p.ellipse(0, 0, BUTTON_RADIUS * 2, BUTTON_RADIUS * 2);
    p.triangle(
      TRIANGLE[0].x, TRIANGLE[0].y,
      TRIANGLE[1].x, TRIANGLE[1].y,
      TRIANGLE[2].x, TRIANGLE[2].y
    );
    p.pop();

    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }

    return { pulseStep, alpha };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      pulseStep: drawn.pulseStep,
      alpha: drawn.alpha,
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
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      // The capture clicks on a schedule, so each frame is a function of its index.
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(
        frameIndex,
        render(scheduledPulseStep(frameIndex * STEPS_PER_FRAME))
      ));
    }
    publishState(0, render(null));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    for (let step = 0; step < STEPS_PER_FRAME; step += 1) {
      if (livePulseStep === null) {
        continue;
      }
      livePulseStep = livePulseStep + 1 < PULSE_STEPS ? livePulseStep + 1 : null;
    }
    publishState(p.frameCount, render(livePulseStep));
  };

  p.mousePressed = () => {
    const inside = isInsideButton(
      p.mouseX - LOGICAL_WIDTH / 2,
      p.mouseY - LOGICAL_HEIGHT / 2,
      BUTTON_RADIUS
    );
    if (inside && livePulseStep === null) {
      livePulseStep = 0;
    }
    return true;
  };
});
