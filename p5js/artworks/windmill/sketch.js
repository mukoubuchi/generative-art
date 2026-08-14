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
  captureWindAt,
  createMill,
  gustTrack,
  millAfter,
  sailBars
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
// proportion and leaves a tenth of the canvas as margin for the sail tips.
const OUTER_RADIUS = BASE_DIMENSION * 0.4;
// The windshaft stands above the middle of the canvas, because a mill is a thing on a
// tower and the tower has to have somewhere to stand. Everything else is measured from it.
const SHAFT_X = LOGICAL_WIDTH / 2;
const SHAFT_Y = LOGICAL_HEIGHT * 0.45;
const CAP_RADIUS = BASE_DIMENSION * 0.075;
const TOWER_TOP = CAP_RADIUS * 0.35;
const TOWER_TOP_HALF = BASE_DIMENSION * 0.062;
const TOWER_BASE_HALF = BASE_DIMENSION * 0.165;
const FRAME_WEIGHT = BASE_DIMENSION * 0.0072;
const BAR_WEIGHT = BASE_DIMENSION * 0.004;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;
const ACCELERATE_KEY = "k";
const KEY_HINT = [
  { cap: "K", text: "hold to raise the wind" },
  { cap: "release", text: "let it fall" }
];

/**
 * A cool dark ground with pale linen on it, which is the Electric Fan's palette turned
 * over: that one is a dark rotor on warm paper, indoors. The two stand as a pair, and the
 * pair is the point — one machine drives its own wind, the other waits for weather.
 */
const GROUND = [26, 30, 37];
const STONE = [78, 82, 90];
const CAP_STONE = [98, 101, 108];
const LINEN = [228, 220, 200];

const sails = sailBars(OUTER_RADIUS);

const LIVE_TRACK = gustTrack(GUST_SEED);
const liveMill = createMill();
let liveStep = 0;
let liveEnvelope = 0;
let holding = false;

const P5 = window.p5;

new P5((p) => {
  /**
   * A mill: a tower, the cap on top of it, and four framed sails on the windshaft. What
   * the artwork is about is still what the rotor does — that it will not start until the
   * wind is worth more than the friction, that it settles where thrust and loss agree,
   * that it stops truly and does not creep — and the figure is dressed only as far as it
   * takes to be read as a mill rather than as the fan next door. There is no weather
   * drawn here and no landscape: the mill stands in the frame and nothing else does.
   */
  function drawMill(mill) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(SHAFT_X, SHAFT_Y);

    // The tower, tapering to the cap, running off the bottom of the canvas rather than
    // standing on a drawn ground.
    p.noStroke();
    p.fill(...STONE);
    p.quad(
      -TOWER_TOP_HALF, TOWER_TOP,
      TOWER_TOP_HALF, TOWER_TOP,
      TOWER_BASE_HALF, LOGICAL_HEIGHT - SHAFT_Y,
      -TOWER_BASE_HALF, LOGICAL_HEIGHT - SHAFT_Y
    );

    // The cap the windshaft comes out of: a dome on a short collar.
    p.fill(...CAP_STONE);
    p.rect(-CAP_RADIUS, 0, 2 * CAP_RADIUS, TOWER_TOP);
    p.arc(0, 0, 2 * CAP_RADIUS, 2 * CAP_RADIUS, Math.PI, 2 * Math.PI, p.CHORD);

    // The sails. Every bar is a line, so the sail is a frame with air through it — which
    // is the whole of what separates it from a fan's solid blade.
    p.push();
    p.rotate(mill.angle);
    p.stroke(...LINEN);
    p.strokeCap(p.ROUND);
    for (const sail of sails) {
      for (const { kind, from, to } of sail) {
        p.strokeWeight(kind === "frame" ? FRAME_WEIGHT : BAR_WEIGHT);
        p.line(from.x, from.y, to.x, to.y);
      }
    }
    p.pop();

    // The end of the windshaft, which is where the four sails are pinned.
    p.noStroke();
    p.fill(...LINEN);
    p.circle(0, 0, FRAME_WEIGHT * 2.6);
    p.pop();
  }

  /** The mill, and the note that it answers to a key wherever that note belongs. */
  function drawFrame(mill) {
    drawMill(mill);
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
