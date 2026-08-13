import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawPointerIndicator } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  RING_SPACING,
  SCENARIO_FRAMES,
  ringCount,
  scenarioCenter
} from "./rings.js";

/**
 * Two families of thin rings, one fixed, one carried by the pointer. The drawing never
 * computes a fringe: the hyperbolas that sweep the canvas as the centres part are the
 * beat between the two ring gratings, and they are the same figure two wave sources
 * make — a hyperbola is the locus of constant difference of distances to two foci. The
 * fringes coarsen as the centres approach and vanish when they coincide, which is where
 * the capture begins and ends.
 */
const LOGICAL_SIZE = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
const HINT_LEGEND = [
  { cap: "move", text: "the pointer carries the second centre" }
];
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;
const RING_COUNT = ringCount(LOGICAL_SIZE, LOGICAL_SIZE, RING_SPACING);
const TOTAL_FRAMES = SCENARIO_FRAMES;

const BACKGROUND = [13, 18, 27];
const FIXED_RING = [148, 164, 188, 165];
const WANDERING_RING = [214, 190, 132, 165];
const STROKE_WEIGHT = RING_SPACING * 0.34;

const P5 = window.p5;

new P5((p) => {
  function drawFamily(centerX, centerY, color) {
    p.stroke(...color);
    for (let ring = 1; ring <= RING_COUNT; ring += 1) {
      p.circle(centerX, centerY, 2 * ring * RING_SPACING);
    }
  }

  function drawFrame(wandering) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...BACKGROUND);
    p.noFill();
    p.strokeWeight(STROKE_WEIGHT);
    // The fixed family first, the wandering one over it: the beat between them is the
    // artwork, and neither is complete without the other.
    drawFamily(LOGICAL_SIZE / 2, LOGICAL_SIZE / 2, FIXED_RING);
    drawFamily(wandering.x, wandering.y, WANDERING_RING);
    p.pop();

    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_SIZE, LOGICAL_SIZE, HINT.scale);
    }
  }

  function publishState(frameIndex, wandering) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      wanderingCenter: { x: wandering.x, y: wandering.y },
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
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
      window.__renderFrame = (frameIndex) => {
        const wandering = scenarioCenter(frameIndex, LOGICAL_SIZE, LOGICAL_SIZE);
        drawFrame(wandering);
        if (INDICATOR) {
          // The dot rides the wandering centre itself: the hand in the picture is
          // exactly where the second family is being held.
          p.push();
          p.scale(RENDER_SCALE);
          drawPointerIndicator(p, wandering.x, wandering.y, LOGICAL_SIZE, LOGICAL_SIZE);
          p.pop();
        }
        return Promise.resolve(publishState(frameIndex, wandering));
      };
    }
    const opening = scenarioCenter(0, LOGICAL_SIZE, LOGICAL_SIZE);
    drawFrame(opening);
    publishState(0, opening);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const wandering = {
      x: p.constrain(p.mouseX, 0, LOGICAL_SIZE),
      y: p.constrain(p.mouseY, 0, LOGICAL_SIZE),
      resting: false
    };
    drawFrame(wandering);
    publishState(p.frameCount, wandering);
  };
});
