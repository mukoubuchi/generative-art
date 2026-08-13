import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawPointerIndicator, ripplePhase } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  HORIZON_STEPS,
  STEPS_PER_SECOND,
  STRIKE_PERIOD_STEPS,
  bellGlow,
  isInsideBell,
  periodicStrikes,
  ringsFromStrikes
} from "./bell.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const CAPTURE_STRIKES = 3;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
const HINT_LEGEND = [
  { cap: "click", text: "the bell tolls" }
];
/** How long the capture's strike visibly holds the pointer down, in simulation steps. */
const PRESS_HOLD_STEPS = 8;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
/** The bell's mouth, seen end on. Small enough that the night around it is most of the picture. */
const BELL_RADIUS = BASE_DIMENSION * 0.18;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = CAPTURE_STRIKES * STRIKE_PERIOD_STEPS / STEPS_PER_FRAME;

/** The night the bell hangs in. */
const GROUND = [12, 14, 24];
/** The wavefronts: pale moon-silver, thinning and dimming as they die. */
const RING_SILVER = [214, 220, 236];
const RING_PEAK_ALPHA = 235;
/** The bell at rest and the bell just struck. */
const BELL_SLATE = [36, 40, 56];
const BELL_LIT = [206, 210, 226];
const RIM_REST = [122, 128, 148];
const RIM_LIT = [230, 234, 246];
/** The body swells a breath on the strike and settles as the sound does. */
const SWELL = 0.06;

function mix(from, to, amount) {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount
  ];
}

const live = { step: 0, strikes: [] };

const P5 = window.p5;

new P5((p) => {
  function render(step, strikes) {
    const rings = ringsFromStrikes(step, strikes);
    const glow = bellGlow(step, strikes);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    // The sound: each front a circle, its strength the one decay law. Oldest first,
    // so a fresh toll passes over the remnant of the last one.
    p.noFill();
    for (let index = rings.length - 1; index >= 0; index -= 1) {
      const ring = rings[index];
      p.stroke(...RING_SILVER, RING_PEAK_ALPHA * ring.amplitude);
      p.strokeWeight(2.5 + 7 * ring.amplitude);
      p.circle(0, 0, 2 * ring.radius * BELL_RADIUS);
    }

    // The bell: its body and rim ring with the most recent strike and fade with it.
    p.push();
    p.scale(1 + SWELL * glow);
    p.stroke(...mix(RIM_REST, RIM_LIT, glow));
    p.strokeWeight(3);
    p.fill(...mix(BELL_SLATE, BELL_LIT, glow));
    p.circle(0, 0, 2 * BELL_RADIUS);
    p.pop();
    p.pop();

    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }

    return { ringCount: rings.length, glow };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      ringCount: drawn.ringCount,
      bellGlow: drawn.glow,
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
      // The capture strikes on the periodic clock, so each frame is a function of its
      // index alone — including the faded remnant of the toll before the clip began.
      window.__renderFrame = (frameIndex) => {
        const step = frameIndex * STEPS_PER_FRAME;
        const strikes = periodicStrikes(step);
        const drawn = render(step, strikes);
        if (INDICATOR) {
          const lastStruck = strikes.filter((struck) => struck <= step).at(-1);
          const age = lastStruck === undefined ? null : step - lastStruck;
          p.push();
          p.scale(RENDER_SCALE);
          // The hand rests on the bell but off its heart, the way a striker lands.
          drawPointerIndicator(
            p,
            LOGICAL_WIDTH / 2 + BELL_RADIUS * 0.45,
            LOGICAL_HEIGHT / 2 + BELL_RADIUS * 0.35,
            LOGICAL_WIDTH,
            LOGICAL_HEIGHT,
            {
              pressed: age !== null && age <= PRESS_HOLD_STEPS,
              ripple: ripplePhase(age === null ? null : age / STEPS_PER_FRAME)
            }
          );
          p.pop();
        }
        return Promise.resolve(publishState(frameIndex, drawn));
      };
    }
    publishState(0, render(0, []));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    live.step += STEPS_PER_FRAME;
    live.strikes = live.strikes.filter((struck) => live.step - struck <= HORIZON_STEPS);
    publishState(p.frameCount, render(live.step, live.strikes));
  };

  p.mousePressed = () => {
    const inside = isInsideBell(
      p.mouseX - LOGICAL_WIDTH / 2,
      p.mouseY - LOGICAL_HEIGHT / 2,
      BELL_RADIUS
    );
    if (inside) {
      live.strikes.push(live.step);
    }
    return true;
  };
});
