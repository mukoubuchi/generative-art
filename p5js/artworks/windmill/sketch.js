import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawKeyIndicator } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  CALM_STEPS,
  GUST_SEED,
  RELEASE_STEP,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  advanceMill,
  bladeTriangles,
  captureWindAt,
  createMill,
  gustTrack,
  millAfter
} from "./mill.js";

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
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;
const ACCELERATE_KEY = "k";
const KEY_HINT = [
  { cap: "K", text: "hold to raise the wind" },
  { cap: "release", text: "let it fall" }
];

const blades = bladeTriangles(OUTER_RADIUS);

const LIVE_TRACK = gustTrack(GUST_SEED);
const liveMill = createMill();
let liveStep = 0;
let liveEnvelope = 0;
let holding = false;

const P5 = window.p5;

new P5((p) => {
  /**
   * Four black triangles on white, and nothing else. What the artwork is about is what
   * the wheel does — that it will not start until the wind is worth more than the
   * friction, that it settles where thrust and loss agree, that it stops truly and does
   * not creep — and none of that is easier to see for the wheel being dressed as a mill.
   */
  function drawWheel(mill) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(255);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.rotate(mill.angle);
    p.noStroke();
    p.fill(0);
    for (const blade of blades) {
      p.triangle(blade[0].x, blade[0].y, blade[1].x, blade[1].y, blade[2].x, blade[2].y);
    }
    p.pop();
  }

  /** The wheel, and the note that it answers to a key wherever that note belongs. */
  function drawFrame(mill) {
    drawWheel(mill);
    if (HINT.shown) {
      drawKeyHint(p, KEY_HINT, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }
  }

  function publishState(frameIndex, mill, wind, accelerating) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      speed: mill.speed,
      angle: mill.angle,
      wind,
      accelerating,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
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
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is the fold of the seeded scenario up to its own step, so any
      // frame can be rebuilt on its own and the whole clip is reproducible.
      window.__renderFrame = (frameIndex) => {
        const steps = (frameIndex + 1) * STEPS_PER_FRAME;
        const mill = millAfter(steps);
        const wind = captureWindAt(steps);
        const held = steps > CALM_STEPS && steps <= RELEASE_STEP;
        drawFrame(mill);
        if (INDICATOR) {
          // The key that is raising this wind, lit while the scenario holds it.
          p.push();
          p.scale(RENDER_SCALE);
          drawKeyIndicator(p, [{ label: "K", active: held }], LOGICAL_WIDTH, LOGICAL_HEIGHT);
          p.pop();
        }
        return Promise.resolve(publishState(frameIndex, mill, wind, held));
      };
    }
    drawFrame(liveMill);
    publishState(0, liveMill, 0, false);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The live wind: the same seeded gusts, gated by an envelope that chases the key.
    const windAtLive = (step) => liveEnvelope * LIVE_TRACK.speedAt(step);
    let wind = 0;
    for (let step = 0; step < STEPS_PER_FRAME; step += 1) {
      liveEnvelope += ((holding ? 1 : 0) - liveEnvelope) * 0.05;
      advanceMill(liveMill, windAtLive, liveStep);
      liveStep += 1;
      wind = windAtLive(liveStep);
    }
    drawFrame(liveMill);
    publishState(p.frameCount, liveMill, wind, holding);
  };

  // p5 2.x reports keys through `key`; `keyCode` still holds the legacy number.
  p.keyPressed = () => {
    if (p.key?.toLowerCase() !== ACCELERATE_KEY) {
      return true;
    }
    holding = true;
    return false;
  };

  p.keyReleased = () => {
    if (p.key?.toLowerCase() !== ACCELERATE_KEY) {
      return true;
    }
    holding = false;
    return false;
  };
});
