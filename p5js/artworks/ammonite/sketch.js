import { fitToCanvas, stripTriangles, stripVertices } from "./geometry.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const FILL_RATIO = 0.9;
// The original's 0.1 px stroke, kept in the same model units the geometry is built in so
// it scales with the figure instead of with the canvas.
const STROKE_WEIGHT = 0.1;

const vertices = stripVertices();
const triangles = stripTriangles(vertices);
const placement = fitToCanvas(vertices, LOGICAL_WIDTH, LOGICAL_HEIGHT, FILL_RATIO);

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
    p.noFill();
    p.stroke(255);
    p.strokeWeight(STROKE_WEIGHT);
    for (const triangle of triangles) {
      p.triangle(
        triangle[0].x, triangle[0].y,
        triangle[1].x, triangle[1].y,
        triangle[2].x, triangle[2].y
      );
    }
    window.__ARTWORK_STATE__ = {
      kind: "image",
      vertexCount: vertices.length,
      triangleCount: triangles.length,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
