import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawKeyIndicator } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  advanceFan,
  angleAt,
  bladeTriangles,
  createFan,
  heldAt,
  speedAt
} from "./motor.js";

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
// The same reach as the mill it stands beside, so the pair are read at one size.
const OUTER_RADIUS = BASE_DIMENSION * 0.4;
const HUB_RADIUS = OUTER_RADIUS * 0.13;
const SPINNER_RADIUS = OUTER_RADIUS * 0.05;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;
const RUN_KEY = "k";
const KEY_HINT = [
  { cap: "K", text: "hold to run the fan" },
  { cap: "release", text: "let it coast down" }
];

/**
 * Warm paper and one ink. The ground stands between the two the gallery already prints
 * on — Toggle Color Ball's and Kanizsa Square's — because a fan is an indoor thing and
 * the white the Processing sketch used is a screen rather than a room. The blades are a
 * single warm charcoal rather than black: on paper, black is a hole.
 */
const PAPER = [230, 224, 208];
const INK = [36, 31, 27];

const blades = bladeTriangles(OUTER_RADIUS);

const liveFan = createFan();
let holding = false;

const P5 = window.p5;

new P5((p) => {
  /**
   * Four pitched blades on a hub. What the artwork is about is what the motor does —
   * that the speed climbs in a straight line, that it stops climbing at a ceiling
   * however long the key is held, and that letting go spends exactly as long coming
   * down as the climb took and then stops dead — so the figure stays the bare rotor.
   */
  function drawFan(angle) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...PAPER);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.noStroke();
    p.fill(...INK);
    p.push();
    p.rotate(angle);
    for (const blade of blades) {
      p.triangle(blade[0].x, blade[0].y, blade[1].x, blade[1].y, blade[2].x, blade[2].y);
    }
    p.pop();
    // The hub, and the spinner cap read out of the paper rather than out of a second
    // colour: the blades converge on a boss, as they do on a machine.
    p.circle(0, 0, 2 * HUB_RADIUS);
    p.fill(...PAPER);
    p.circle(0, 0, 2 * SPINNER_RADIUS);
    p.pop();
  }

  /** The fan, and the note that it answers to a key wherever that note belongs. */
  function drawFrame(angle) {
    drawFan(angle);
    if (HINT.shown) {
      drawKeyHint(p, KEY_HINT, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }
  }

  function publishState(frameIndex, angle, speed, running) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      angle,
      speed,
      running,
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
      // The clip's speed and travel are closed forms of the step, so any frame can be
      // rebuilt on its own and the whole clip is the same on every render.
      window.__renderFrame = (frameIndex) => {
        const steps = (frameIndex + 1) * STEPS_PER_FRAME;
        const held = heldAt(steps - 1);
        drawFrame(angleAt(steps));
        if (INDICATOR) {
          // The key that is driving this, lit while the scenario holds it.
          p.push();
          p.scale(RENDER_SCALE);
          drawKeyIndicator(p, [{ label: "K", active: held }], LOGICAL_WIDTH, LOGICAL_HEIGHT);
          p.pop();
        }
        return Promise.resolve(publishState(frameIndex, angleAt(steps), speedAt(steps), held));
      };
    }
    drawFrame(liveFan.angle);
    publishState(0, liveFan.angle, liveFan.speed, false);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    for (let step = 0; step < STEPS_PER_FRAME; step += 1) {
      advanceFan(liveFan, holding);
    }
    drawFrame(liveFan.angle);
    publishState(p.frameCount, liveFan.angle, liveFan.speed, holding);
  };

  // p5 2.x reports keys through `key`; `keyCode` still holds the legacy number.
  p.keyPressed = () => {
    if (p.key?.toLowerCase() !== RUN_KEY) {
      return true;
    }
    holding = true;
    return false;
  };

  p.keyReleased = (event) => {
    if (event.key?.toLowerCase() !== RUN_KEY) {
      return true;
    }
    holding = false;
    return false;
  };
});
