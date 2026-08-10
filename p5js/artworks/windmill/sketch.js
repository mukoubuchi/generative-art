import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawKeyIndicator } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  STEPS_PER_SECOND,
  STEPS_TO_TOP_SPEED,
  advance,
  bladeTriangles,
  createWheel,
  wheelAfter
} from "./wheel.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The Processing sketch reached 200 px on a 500 px canvas; 0.4 of the canvas keeps that
// proportion and leaves a tenth of the canvas as margin for the blade tips.
const OUTER_RADIUS = BASE_DIMENSION * 0.4;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
// Wind all the way up to the speed cap, then coast to a full stop.
const HOLD_STEPS = STEPS_TO_TOP_SPEED;
const TOTAL_STEPS = 2 * STEPS_TO_TOP_SPEED;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;
const ACCELERATE_KEY = "k";
const KEY_HINT = [
  { cap: "K", text: "hold to spin up" },
  { cap: "release", text: "coast to rest" }
];

const blades = bladeTriangles(OUTER_RADIUS);
const liveWheel = createWheel();
let accelerating = false;

const P5 = window.p5;

new P5((p) => {
  function drawWheel(wheel) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(255);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.rotate(wheel.angle);
    p.noStroke();
    p.fill(0);
    for (const blade of blades) {
      p.triangle(blade[0].x, blade[0].y, blade[1].x, blade[1].y, blade[2].x, blade[2].y);
    }
    p.pop();
  }

  /** The wheel, and the note that it answers to a key wherever that note belongs. */
  function drawFrame(wheel) {
    drawWheel(wheel);
    if (HINT.shown) {
      drawKeyHint(p, KEY_HINT, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }
  }

  function drawLive() {
    drawFrame(liveWheel);
  }

  function publishState(frameIndex, wheel) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      speed: wheel.speed,
      angle: wheel.angle,
      accelerating,
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
      // Nothing accumulates on the canvas, so a frame can be replayed from rest on its
      // own. The last frame lands exactly on the stopped wheel.
      window.__renderFrame = (frameIndex) => {
        const steps = (frameIndex + 1) * STEPS_PER_FRAME;
        const wheel = wheelAfter(steps, HOLD_STEPS);
        drawFrame(wheel);
        if (INDICATOR) {
          // The key that is doing this, lit while it is down: the first half of the clip
          // is the hold, the second is the key released and the wheel coasting.
          p.push();
          p.scale(RENDER_SCALE);
          drawKeyIndicator(p, [{ label: "K", active: steps <= HOLD_STEPS }], LOGICAL_WIDTH, LOGICAL_HEIGHT);
          p.pop();
        }
        return Promise.resolve(publishState(frameIndex, wheel));
      };
    }
    drawLive();
    publishState(0, liveWheel);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    for (let step = 0; step < STEPS_PER_FRAME; step += 1) {
      advance(liveWheel, accelerating);
    }
    drawLive();
    publishState(p.frameCount, liveWheel);
  };

  // p5 2.x reports keys through `key`; `keyCode` still holds the legacy number.
  p.keyPressed = () => {
    if (p.key?.toLowerCase() !== ACCELERATE_KEY) {
      return true;
    }
    accelerating = true;
    return false;
  };

  p.keyReleased = () => {
    if (p.key?.toLowerCase() !== ACCELERATE_KEY) {
      return true;
    }
    accelerating = false;
    return false;
  };
});
