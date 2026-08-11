import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawKeyIndicator } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import { captureFrameCount, captureState } from "./capture.js";
import { buildSections, convergence, goldenRectangle } from "./geometry.js";

const LOGICAL_WIDTH = 1010;
const LOGICAL_HEIGHT = 640;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
const MARGIN = BASE_DIMENSION * 0.03125;
// The Processing sketch drew at the default weight of 1 px on a 500 px short side.
const STROKE_WEIGHT = BASE_DIMENSION * 0.002;
const QUARTER_TURN = Math.PI / 2;

/** The dark table, the convergence's two ends, and the ivory the spiral is drawn in. */
const GROUND = [14, 12, 10];
const EMBER = [158, 74, 44];
const GOLD = [246, 198, 98];
const ARC_IVORY = [248, 234, 202];
const SKELETON = [204, 192, 168, 88];

// The tiling is integers — 987 by 610 units — scaled to the canvas in one transform.
// The exact golden rectangle stays as the skeleton: the limit the convergents close on,
// missing the integer root's aspect by about one part in a million.
const sections = buildSections();
const ROOT_UNITS = { width: sections[0].width, height: sections[0].height };
const UNIT_SCALE = Math.min(
  (LOGICAL_WIDTH - 2 * MARGIN) / ROOT_UNITS.width,
  (LOGICAL_HEIGHT - 2 * MARGIN) / ROOT_UNITS.height
);
const TILING_LEFT = (LOGICAL_WIDTH - ROOT_UNITS.width * UNIT_SCALE) / 2;
const TILING_TOP = (LOGICAL_HEIGHT - ROOT_UNITS.height * UNIT_SCALE) / 2;
const SKELETON_RECT = goldenRectangle(
  LOGICAL_WIDTH - 2 * MARGIN,
  LOGICAL_HEIGHT - 2 * MARGIN
);

function mix(from, to, amount) {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount
  ];
}

// The page starts from one section so the arrow keys build the spiral up the way the
// Processing sketch did. The capture starts complete: its scenario is in capture.js, and
// its opening frame — which is also the clip's timeline still — is the finished spiral.
let visibleSections = CAPTURE_MODE ? sections.length : 1;
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
const TOTAL_FRAMES = captureFrameCount(sections.length);
const KEY_HINT = [
  { cap: "→", text: "add a section" },
  { cap: "←", text: "remove the newest" }
];

const P5 = window.p5;

new P5((p) => {
  function drawSpiral(count) {
    p.background(...GROUND);
    p.push();
    p.scale(RENDER_SCALE);
    // The skeleton first: the exact golden rectangle the integer tiling converges to.
    p.noFill();
    p.stroke(...SKELETON);
    p.strokeWeight(STROKE_WEIGHT);
    p.rect(
      (LOGICAL_WIDTH - SKELETON_RECT.width) / 2,
      (LOGICAL_HEIGHT - SKELETON_RECT.height) / 2,
      SKELETON_RECT.width,
      SKELETON_RECT.height
    );
    p.translate(TILING_LEFT, TILING_TOP);
    p.scale(UNIT_SCALE);
    for (const section of sections.slice(0, count)) {
      p.push();
      p.translate(section.x, section.y);
      p.rotate(section.rotation);
      p.noStroke();
      // Colour is the convergence: the rough inner convergents in ember, the sections
      // whose ratio has all but reached phi in gold. Adding a section gilds the spiral.
      p.fill(...mix(EMBER, GOLD, convergence(section)));
      p.rect(0, 0, section.width, section.height);
      // The quarter arc is inscribed in the square half of the rectangle, so its two
      // radii lie exactly on edges the neighbouring rectangles already draw.
      p.noFill();
      p.stroke(...ARC_IVORY);
      p.strokeWeight(STROKE_WEIGHT / UNIT_SCALE);
      p.arc(
        section.height,
        section.height,
        2 * section.height,
        2 * section.height,
        Math.PI,
        Math.PI + QUARTER_TURN,
        p.OPEN
      );
      p.pop();
    }
    p.pop();
  }

  function publishState(frameIndex, count) {
    window.__ARTWORK_STATE__ = {
      kind: CAPTURE_MODE ? "video" : "image",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      sectionCount: sections.length,
      visibleSections: count,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
    return window.__ARTWORK_STATE__;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.noLoop();
    if (CAPTURE_MODE) {
      // Every frame is a pure function of its index — the scenario lives in capture.js —
      // so any frame can be rebuilt on its own.
      window.__renderFrame = (frameIndex) => {
        const state = captureState(frameIndex, sections.length);
        drawSpiral(state.visibleSections);
        if (INDICATOR) {
          // The two keys of the page's legend, in the legend's order, each lit while the
          // scenario is pressing it.
          p.push();
          p.scale(RENDER_SCALE);
          drawKeyIndicator(p, [
            { label: "→", active: state.rightActive },
            { label: "←", active: state.leftActive }
          ], LOGICAL_WIDTH, LOGICAL_HEIGHT);
          p.pop();
        } else if (HINT.shown) {
          drawKeyHint(p, KEY_HINT, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
        }
        return Promise.resolve(publishState(frameIndex, state.visibleSections));
      };
    }
  };

  p.draw = () => {
    drawSpiral(visibleSections);
    if (HINT.shown) {
      drawKeyHint(p, KEY_HINT, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }
    publishState(0, visibleSections);
  };

  p.keyPressed = () => {
    if (CAPTURE_MODE) {
      return true;
    }
    // p5 2.x reports arrow keys through `key`, where LEFT_ARROW and RIGHT_ARROW are the
    // KeyboardEvent names. `keyCode` still holds the legacy number, so comparing it
    // against these constants never matches.
    if (p.key === p.RIGHT_ARROW) {
      visibleSections = Math.min(sections.length, visibleSections + 1);
    } else if (p.key === p.LEFT_ARROW) {
      visibleSections = Math.max(1, visibleSections - 1);
    } else {
      return true;
    }
    // Unlike the Processing sketch, the whole list is redrawn on a cleared background,
    // so removing a section actually erases it.
    p.redraw();
    return false;
  };
});
