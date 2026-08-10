import {
  CYCLE_STEPS,
  REVEAL_STATE,
  STEPS_PER_SECOND,
  inducerCorners,
  rotationsAt,
  stateAfter
} from "./illusion.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const CYCLES = 3;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The original placed the inducers a quarter of the canvas from the middle and drew them a
// third of the canvas across, so the figure reaches five sixths of the way to the edge.
const INDUCER_DISTANCE = BASE_DIMENSION / 4;
const INDUCER_DIAMETER = BASE_DIMENSION / 3;
// The whole figure sits on its diagonal, so the illusory edges run at 45 degrees.
const BASE_ROTATION = Math.PI / 4;
// A mouth is a quarter turn wide, so the drawn wedge is the remaining three quarters.
const WEDGE_SPAN = Math.PI * 3 / 2;
// The mouths are cut on the far side of each disc, which is what points them inwards.
const MOUTH_ROTATION = Math.PI / 4 + Math.PI;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = CYCLES * CYCLE_STEPS / STEPS_PER_FRAME;

const corners = inducerCorners(INDUCER_DISTANCE);

const P5 = window.p5;

new P5((p) => {
  function drawStep(step) {
    const state = stateAfter(step);
    const rotations = rotationsAt(state);

    p.background(255);

    p.push();
    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.rotate(BASE_ROTATION + rotations.inducers);
    p.noStroke();
    p.fill(0);
    for (const corner of corners) {
      if (state.index === REVEAL_STATE) {
        // The mouths are filled in, so the inducers become plain discs and the square they
        // used to imply has to be drawn if it is still to be there.
        p.circle(corner.x, corner.y, INDUCER_DIAMETER);
        continue;
      }
      p.push();
      p.translate(corner.x, corner.y);
      p.rotate(MOUTH_ROTATION + rotations.spin);
      p.arc(
        0, 0,
        INDUCER_DIAMETER, INDUCER_DIAMETER,
        corner.theta, corner.theta + WEDGE_SPAN,
        p.PIE
      );
      p.pop();
    }
    p.pop();

    if (rotations.quadrilateral === null) {
      return;
    }
    // Drawn on the same corners but at its own rotation, so it turns away from the discs
    // at twice the rate either of them moves.
    p.push();
    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.rotate(BASE_ROTATION + rotations.quadrilateral);
    p.noStroke();
    p.fill(255);
    p.beginShape();
    for (const corner of corners) {
      p.vertex(corner.x, corner.y);
    }
    p.endShape(p.CLOSE);
    p.pop();
  }

  function publishState(frameIndex, step) {
    const state = stateAfter(step);
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      step,
      cycleSteps: CYCLE_STEPS,
      stateIndex: state.index,
      angle: state.angle,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => {
        const step = frameIndex * STEPS_PER_FRAME;
        drawStep(step);
        return Promise.resolve(publishState(frameIndex, step));
      };
    }
    drawStep(0);
    publishState(0, 0);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const step = p.frameCount * STEPS_PER_FRAME;
    drawStep(step);
    publishState(p.frameCount, step);
  };
});
