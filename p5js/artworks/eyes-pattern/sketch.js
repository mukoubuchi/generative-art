import { CIRCLE_DIAMETER, GRID_SIZE, allCentres } from "./geometry.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const UNIT = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) / GRID_SIZE;
// The Processing sketch never called background(), so it drew on the default grey with the
// default black stroke. That grey is what the sketch renders, so the port states it.
const BACKGROUND = 204;
const STROKE = 0;
// One pixel against the original's 100 px diameter, held in grid units so it scales with
// the lattice rather than with the canvas.
const STROKE_WEIGHT = 1 / 100;

const centres = allCentres();

const P5 = window.p5;

new P5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.noLoop();
  };

  p.draw = () => {
    p.background(BACKGROUND);
    p.scale(RENDER_SCALE * UNIT);
    p.noFill();
    p.stroke(STROKE);
    p.strokeWeight(STROKE_WEIGHT);
    for (const centre of centres) {
      p.circle(centre.x, centre.y, CIRCLE_DIAMETER);
    }
    window.__ARTWORK_STATE__ = {
      kind: "image",
      circleCount: centres.length,
      gridSize: GRID_SIZE,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
