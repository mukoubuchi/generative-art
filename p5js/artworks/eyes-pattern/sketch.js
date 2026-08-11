import {
  CIRCLE_DIAMETER,
  DISSOLVE_FRAMES,
  FIRST_LATTICE_FRAMES,
  GRID_SIZE,
  REST_FRAMES,
  SECOND_LATTICE_FRAMES,
  TOTAL_FRAMES,
  rippleOrder
} from "./geometry.js";

/**
 * Nothing is drawn but circles, and for a while there are no eyes at all: the first
 * lattice ripples out and stands tangent, circle beside circle, each one sealed. Then
 * the second lattice arrives on the half points, and every circle it lands cuts four
 * lenses with its neighbours — the eyes appear only when the two families meet, which
 * is the artwork's whole argument. Cream for the first family, gold for the second,
 * on the indigo the shippō tradition dyes its cloth; the pattern holds, then lets go.
 */
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
const UNIT = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) / GRID_SIZE;

/** How long one circle takes to draw itself around. */
const COMPASS_FRAMES = 12;

const GROUND = [18, 24, 44];
const FIRST_CREAM = [236, 226, 198];
const SECOND_GOLD = [226, 184, 116];
const STROKE_UNITS = 0.022;

const FIRST_FAMILY = rippleOrder(0);
const SECOND_FAMILY = rippleOrder(CIRCLE_DIAMETER / 2);

const P5 = window.p5;

new P5((p) => {
  function drawFamily(family, ink, phaseStart, phaseLength, frameIndex, fade) {
    let arrived = 0;
    family.forEach((circle, index) => {
      const started = phaseStart
        + (index / family.length) * (phaseLength - COMPASS_FRAMES);
      const sweep = Math.min(Math.max((frameIndex - started) / COMPASS_FRAMES, 0), 1);
      if (sweep === 0) {
        return;
      }
      arrived += 1;
      p.stroke(...ink, 255 * fade);
      if (sweep === 1) {
        p.circle(circle.x, circle.y, CIRCLE_DIAMETER);
      } else {
        p.arc(
          circle.x,
          circle.y,
          CIRCLE_DIAMETER,
          CIRCLE_DIAMETER,
          -Math.PI / 2,
          -Math.PI / 2 + sweep * 2 * Math.PI
        );
      }
    });
    return arrived;
  }

  function drawPattern(frameIndex) {
    const dissolve = Math.max(0, frameIndex - (TOTAL_FRAMES - DISSOLVE_FRAMES)) / DISSOLVE_FRAMES;
    const fade = 1 - dissolve;

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.scale(UNIT);
    p.noFill();
    p.strokeWeight(STROKE_UNITS);
    const first = drawFamily(FIRST_FAMILY, FIRST_CREAM, 0, FIRST_LATTICE_FRAMES, frameIndex, fade);
    const second = drawFamily(
      SECOND_FAMILY,
      SECOND_GOLD,
      FIRST_LATTICE_FRAMES + REST_FRAMES,
      SECOND_LATTICE_FRAMES,
      frameIndex,
      fade
    );
    p.pop();
    return { first, second };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      firstFamily: FIRST_FAMILY.length,
      secondFamily: SECOND_FAMILY.length,
      arrivedFirst: drawn.first,
      arrivedSecond: drawn.second,
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
      // Every frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawPattern(frameIndex)));
    }
    publishState(0, drawPattern(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawPattern(frameIndex));
  };
});
