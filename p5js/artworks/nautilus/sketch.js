import { buildSquares, fitToCanvas } from "./geometry.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const FILL_RATIO = 0.88;
// The original drew a 1 px stroke against a start radius of 200, so the stroke stays that
// fraction of the figure. Drawing inside a scaled coordinate system scales it with the rest.
const STROKE_WEIGHT = 1 / 200;
const INK = [255, 255, 255, 30];

const squares = buildSquares();
const placement = fitToCanvas(squares, LOGICAL_WIDTH, LOGICAL_HEIGHT, FILL_RATIO);

const P5 = window.p5;

new P5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.noLoop();
  };

  p.draw = () => {
    p.background(0);
    p.scale(RENDER_SCALE);
    p.translate(placement.offsetX, placement.offsetY);
    p.scale(placement.scale);
    p.fill(...INK);
    p.stroke(...INK);
    p.strokeWeight(STROKE_WEIGHT);
    for (const square of squares) {
      p.beginShape();
      for (const corner of square) {
        p.vertex(corner.x, corner.y);
      }
      p.endShape(p.CLOSE);
    }
    window.__ARTWORK_STATE__ = {
      kind: "image",
      squareCount: squares.length,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
