import { morphSchedule, sampledCurve } from "./curve.js";

/**
 * One line filling a square, degree by degree. The clip holds each Hilbert curve and
 * then eases it into the next: every sample point slides to where its own moment of the
 * walk lives on the finer curve, so the line is never cut — it visibly grows room for
 * the detail it is about to have.
 *
 * The line is coloured by its own parameter, which is the curve's second lesson made
 * visible: the gradient stays smooth on the page because points close along the line
 * stay close in the square, at every degree. A shuffled curve with the same cells would
 * scatter this gradient into confetti.
 */
const LOGICAL_SIZE = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

const FIRST_DEGREE = 1;
const LAST_DEGREE = 6;
// 20 frames of rest at each degree, 36 of travel between; five stages and the final
// rest land exactly on the clip's 300 frames.
const PLAN = { first: FIRST_DEGREE, last: LAST_DEGREE, holdFrames: 20, morphFrames: 36 };
const TOTAL_FRAMES = morphSchedule(0, PLAN).totalFrames;

// As many samples as the finest curve has vertices, so degree six is drawn exactly.
const SAMPLES = 4 ** LAST_DEGREE;
const MARGIN = LOGICAL_SIZE * 0.07;
const SPAN = LOGICAL_SIZE - 2 * MARGIN;
const STROKE_WEIGHT = 2;

const BACKGROUND = [13, 18, 27];
// The parameter's colour runs warm gold to cool steel through a pale midpoint, so the
// two ends of the line are tellable apart and the middle carries the light.
const COLOR_STOPS = [
  [252, 202, 92],
  [240, 238, 228],
  [96, 148, 200]
];

const CURVES = new Map();
for (let degree = FIRST_DEGREE; degree <= LAST_DEGREE; degree += 1) {
  CURVES.set(degree, sampledCurve(degree, SAMPLES));
}

function parameterColor(t) {
  const scaled = t * (COLOR_STOPS.length - 1);
  const stop = Math.min(Math.floor(scaled), COLOR_STOPS.length - 2);
  const within = scaled - stop;
  return COLOR_STOPS[stop].map(
    (channel, index) => channel + (COLOR_STOPS[stop + 1][index] - channel) * within
  );
}

const P5 = window.p5;

new P5((p) => {
  function drawFrame(frameIndex) {
    const { from, to, blend } = morphSchedule(frameIndex, PLAN);
    const coarse = CURVES.get(from);
    const fine = CURVES.get(to);
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...BACKGROUND);
    p.strokeWeight(STROKE_WEIGHT);
    p.noFill();
    let previousX;
    let previousY;
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      const [x0, y0] = coarse[sample];
      const [x1, y1] = fine[sample];
      const x = MARGIN + (x0 + (x1 - x0) * blend) * SPAN;
      // The module's y grows upward; the canvas's downward. The flip keeps the walk
      // entering at the picture's lower left, the way the tests state it.
      const y = LOGICAL_SIZE - MARGIN - (y0 + (y1 - y0) * blend) * SPAN;
      if (sample > 0) {
        p.stroke(...parameterColor((sample - 0.5) / (SAMPLES - 1)));
        p.line(previousX, previousY, x, y);
      }
      previousX = x;
      previousY = y;
    }
    p.pop();
    return { from, to, blend };
  }

  function publishState(frameIndex, shown) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      fromDegree: shown.from,
      toDegree: shown.to,
      blend: shown.blend,
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => {
        const shown = drawFrame(frameIndex);
        return Promise.resolve(publishState(frameIndex, shown));
      };
    }
    publishState(0, drawFrame(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawFrame(frameIndex));
  };
});
