import {
  PATH_RADIUS_RATIO,
  STEPS_PER_CYCLE,
  STEPS_PER_SECOND,
  TRIANGLE_COUNT,
  TRIANGLE_RADIUS_RATIO,
  trianglesAt,
  triangleShape
} from "./orbit.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const CYCLES = 4;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The original's hexagon radius was a third of its canvas; the path and triangle radii
// follow from it, and together they reach 0.866 of the half-canvas.
const HEXAGON_RADIUS = BASE_DIMENSION / 3;
const PATH_RADIUS = HEXAGON_RADIUS * PATH_RADIUS_RATIO;
const TRIANGLE_RADIUS = PATH_RADIUS * TRIANGLE_RADIUS_RATIO;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = CYCLES * STEPS_PER_CYCLE / STEPS_PER_FRAME;

const P5 = window.p5;

new P5((p) => {
  function drawStep(step) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(255);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.noStroke();
    p.fill(0);
    for (const placed of trianglesAt(step, PATH_RADIUS)) {
      p.beginShape();
      for (const vertex of triangleShape(TRIANGLE_RADIUS, placed.rotation)) {
        p.vertex(placed.x + vertex.x, placed.y + vertex.y);
      }
      p.endShape(p.CLOSE);
    }
    p.pop();
  }

  function publishState(frameIndex, step) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      step,
      cycleSteps: STEPS_PER_CYCLE,
      triangleCount: TRIANGLE_COUNT,
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
      // Every frame is a function of its step alone, so any frame index can be asked for
      // in any order and always comes out the same.
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
