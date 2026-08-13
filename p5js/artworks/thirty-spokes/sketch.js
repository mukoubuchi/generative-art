import {
  HUB_RADIUS,
  RIM_RADIUS,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  loopAt,
  seededLoops,
  spokes,
  windingByCrossings
} from "./winding.js";

/**
 * Thirty spokes share one hub, and the loops threaded through it cannot get free.
 *
 * The wheel is drawn as the chapter describes it and no more: a rim, thirty spokes, and
 * at the middle nothing at all — the hub is the ground showing through, because the hole
 * is the part that does the work here. The stirring twists the whole field about that
 * hole and breathes it in and out, and it is built so that no point can cross the hub.
 *
 * Every loop is coloured by its own winding number, which is measured rather than
 * assigned. The colours therefore never change, however far the loops are dragged: warm
 * for loops that go round one way, cool for the other, deeper for going round twice, and
 * bare white for the one loop that does not enclose the hub at all — the only one that
 * could be pulled off the wheel, if anything were pulling.
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
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;

const GROUND = [12, 12, 16];
/** The wheel is the apparatus, not the subject: present, and quiet. */
const WHEEL = [92, 80, 66];
const RIM = [126, 110, 90];

/**
 * Colour by winding number. Sign chooses the family — warm one way round, cool the other
 * — and going round twice takes the deeper member of that family. Nought is left white,
 * because a loop that encloses nothing is the one the wheel has no hold over.
 */
const WINDINGS = new Map([
  [0, [236, 232, 224]],
  [1, [232, 168, 72]],
  [-1, [104, 156, 214]],
  [2, [206, 92, 48]],
  [-2, [78, 96, 190]]
]);
const UNEXPECTED = [150, 150, 150];

const LOOPS = seededLoops().map((points) => ({
  points,
  // Measured off the curve, once, before anything moves it. Nothing here was told.
  colour: WINDINGS.get(windingByCrossings(points)) ?? UNEXPECTED
}));
const SPOKES = spokes();

const P5 = window.p5;

new P5((p) => {
  function drawWheel() {
    p.noFill();
    p.stroke(...RIM);
    p.strokeWeight(3);
    p.circle(0, 0, 2 * RIM_RADIUS);
    p.stroke(...WHEEL);
    p.strokeWeight(2);
    for (const spoke of SPOKES) {
      p.line(spoke.x1, spoke.y1, spoke.x2, spoke.y2);
    }
    // The hub is not drawn. It is the ground, left showing through where the spokes stop,
    // which is the whole of what the chapter is about.
  }

  function drawLoops(step) {
    p.noFill();
    p.strokeWeight(2.6);
    p.strokeJoin(p.ROUND);
    for (const loop of LOOPS) {
      p.stroke(...loop.colour, 232);
      p.beginShape();
      for (const point of loopAt(loop.points, step)) {
        p.vertex(point.x, point.y);
      }
      p.endShape(p.CLOSE);
    }
  }

  function drawStep(step) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    drawWheel();
    drawLoops(step);
    p.pop();
  }

  function publishState(frameIndex, step) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      step,
      windings: LOOPS.map((loop) => windingByCrossings(loopAt(loop.points, step))),
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
      // Every frame is a pure function of its index: the stirring is a formula in the
      // phase, not an accumulation, so any frame can be drawn on its own.
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
    const step = (p.frameCount * STEPS_PER_FRAME) % TOTAL_STEPS;
    drawStep(step);
    publishState(p.frameCount, step);
  };
});
