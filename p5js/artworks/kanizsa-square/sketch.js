import {
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  leverAt,
  marksAt,
  revealAt,
  spinAt,
  supportRatioAt
} from "./illusion.js";

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
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// Half the square's diagonal: the inducers sit at its corners, a quarter of the canvas
// out, as they did in the original.
const SQUARE_HALF = BASE_DIMENSION / 4;
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;

/** Paper, ink, and the light the square is imagined in. */
const PAPER = [226, 220, 206];
const INK = [22, 20, 26];
const PLATE = [248, 246, 242];

const P5 = window.p5;

new P5((p) => {
  /**
   * The whole picture, painted from the list the module hands over. A wedge is an arc
   * and nothing else; there is no branch here that draws a line, and the square's
   * sides are never among the arguments. The one mark that is not a wedge is the plate
   * of the reveal, which is the figure owning up.
   */
  function drawStep(step) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...PAPER);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.noStroke();
    for (const mark of marksAt(step, SQUARE_HALF)) {
      if (mark.kind === "wedge") {
        p.fill(...INK);
        p.arc(mark.x, mark.y, 2 * mark.radius, 2 * mark.radius, mark.from, mark.to, p.PIE);
        continue;
      }
      // kind === "plate": the square, drawn at last, in the light it was imagined in.
      p.fill(...PLATE);
      p.beginShape();
      for (const corner of mark.corners) {
        p.vertex(corner.x, corner.y);
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
      lever: leverAt(step).name,
      supportRatio: supportRatioAt(step),
      spin: spinAt(step),
      reveal: revealAt(step),
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
      // Every frame is a pure function of its index, so any frame stands alone.
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
