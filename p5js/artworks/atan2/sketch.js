import { hintMode } from "../shared/hint-mode.js";
import { HINT_TONE, drawKeyHint } from "../shared/key-hint.js";
import { angleArc, polarAngle, projectionDots, sweptPoint } from "./projection.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const SWEEP_SECONDS = 8;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
/** The point follows the pointer, so the readouts change with it. */
const HINT_LEGEND = [
  { cap: "move", text: "the pointer places the point" }
];
/**
 * An opaque plate here, where the others use a translucent one. This is the artwork that
 * prints its own readouts, and the lower of them passes behind the legend; seen through a
 * plate that lets it through, the two sets of type read as one smudge.
 */
const HINT_TONE_ATAN2 = { ...HINT_TONE, plate: [255, 255, 255, 255] };
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// Ratios of the Processing sketch's 400 px canvas. Its axes reached exactly 0.5, which
// put the arrowheads on the canvas edge; 0.47 keeps them whole.
const AXIS_RADIUS = BASE_DIMENSION * 0.47;
const ARROW_SIZE = BASE_DIMENSION * (5 / 400);
const POINT_DIAMETER = BASE_DIMENSION * (8 / 400);
const ARC_DIAMETER = BASE_DIMENSION * (50 / 400);
const DOT_SPACING = BASE_DIMENSION * (5 / 400);
const DOT_WEIGHT = BASE_DIMENSION * (1 / 400);
const TEXT_SIZE = BASE_DIMENSION * (12 / 400);
const SWEEP_RADIUS = BASE_DIMENSION * 0.25;
const TOTAL_FRAMES = SWEEP_SECONDS * PLAYBACK_FPS;
const QUARTER_TURN = Math.PI / 2;

const P5 = window.p5;

new P5((p) => {
  function drawAxes() {
    for (let quadrant = 0; quadrant < 4; quadrant += 1) {
      p.push();
      p.rotate(quadrant * QUARTER_TURN);
      // Only the positive x and y directions carry an arrowhead and a label.
      if (quadrant === 0 || quadrant === 3) {
        p.push();
        p.translate(0, AXIS_RADIUS);
        p.noStroke();
        p.triangle(0, 0, -ARROW_SIZE, -ARROW_SIZE, ARROW_SIZE, -ARROW_SIZE);
        if (quadrant === 0) {
          p.text("y", -3 * ARROW_SIZE, -2 * ARROW_SIZE);
        } else {
          p.push();
          p.translate(-4 * ARROW_SIZE, -2 * ARROW_SIZE);
          p.rotate(QUARTER_TURN);
          p.text("x", 0, 0);
          p.pop();
        }
        p.pop();
      }
      p.stroke(0);
      p.strokeWeight(DOT_WEIGHT);
      p.line(0, 0, 0, AXIS_RADIUS);
      p.pop();
    }
  }

  function render(point) {
    const angle = polarAngle(point);
    const arc = angleArc(angle);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(255);
    p.fill(0);
    p.textSize(TEXT_SIZE);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    drawAxes();

    // Fixed decimal places keep the readout stable: Java and JavaScript print floats
    // with different numbers of digits.
    p.noStroke();
    p.text(`radian: ${angle.toFixed(4)}`, ARROW_SIZE * 2, AXIS_RADIUS - TEXT_SIZE * 2.5);
    p.text(`degree: ${p.degrees(angle).toFixed(2)}`, ARROW_SIZE * 2, AXIS_RADIUS - TEXT_SIZE * 0.8);
    p.text(
      `(${Math.trunc(point.x)}, ${Math.trunc(point.y)})`,
      point.x + ARROW_SIZE * 2,
      point.y + (angle > 0 ? TEXT_SIZE * 1.7 : -TEXT_SIZE * 0.8)
    );

    p.ellipse(point.x, point.y, POINT_DIAMETER, POINT_DIAMETER);
    p.arc(0, 0, ARC_DIAMETER, ARC_DIAMETER, arc.start, arc.end, p.PIE);

    p.stroke(0);
    p.strokeWeight(DOT_WEIGHT);
    p.line(0, 0, point.x, point.y);
    for (const dot of projectionDots(point, DOT_SPACING)) {
      p.point(dot.x, dot.y);
    }
    p.pop();

    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale, HINT_TONE_ATAN2);
    }

    return { point, angle };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      angle: drawn.angle,
      point: drawn.point,
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
    p.noCursor();
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every capture frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(
        frameIndex,
        render(sweptPoint(frameIndex, TOTAL_FRAMES, SWEEP_RADIUS))
      ));
    }
    publishState(0, render(sweptPoint(0, TOTAL_FRAMES, SWEEP_RADIUS)));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The page follows the real pointer, which is what the sketch is for.
    publishState(p.frameCount, render({
      x: p.mouseX - LOGICAL_WIDTH / 2,
      y: p.mouseY - LOGICAL_HEIGHT / 2
    }));
  };
});
