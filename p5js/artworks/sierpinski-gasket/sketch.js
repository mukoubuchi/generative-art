import { buildGasket, flattenTriangles } from "./geometry.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
// The Processing sketch used radius 0.48 and cutoff 10 on an 800 px canvas. Keeping both
// as ratios of the base dimension preserves the seven generations at any canvas size.
const ROOT_RADIUS = BASE_DIMENSION * 0.48;
const MINIMUM_RADIUS = BASE_DIMENSION * 0.0125;
const STROKE_WEIGHT = BASE_DIMENSION * 0.00125;

// Vertices sit at 0, 120 and 240 degrees, so the figure reaches a full radius to the
// right but only half a radius to the left. Shifting the anchor left by a quarter radius
// centres the bounding box horizontally; vertically the two halves are already symmetric.
const ROOT_CENTER = {
  x: LOGICAL_WIDTH / 2 - ROOT_RADIUS / 4,
  y: LOGICAL_HEIGHT / 2
};

const triangles = flattenTriangles(buildGasket(
  ROOT_CENTER,
  ROOT_RADIUS,
  MINIMUM_RADIUS
));

const P5 = window.p5;

new P5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.noLoop();
  };

  p.draw = () => {
    p.background(255);
    p.scale(RENDER_SCALE);
    p.noFill();
    p.stroke(18);
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
      triangleCount: triangles.length,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
