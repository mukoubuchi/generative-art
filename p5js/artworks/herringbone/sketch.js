import { GRID_SIZE, allSegments } from "./geometry.js";

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
// The Processing sketch never called background(), so it drew on the default grey with
// the default black stroke. That grey is what the sketch actually renders, so the port
// states it rather than substituting white.
const BACKGROUND = 204;
const STROKE = 0;
// One pixel against the original's 50 px grid unit, kept in grid units so it scales with
// the weave rather than with the canvas.
const STROKE_WEIGHT = 1 / 50;

const segments = allSegments();

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
    p.stroke(STROKE);
    p.strokeWeight(STROKE_WEIGHT);
    for (const segment of segments) {
      p.line(segment.x1, segment.y1, segment.x2, segment.y2);
    }
    window.__ARTWORK_STATE__ = {
      kind: "image",
      segmentCount: segments.length,
      gridSize: GRID_SIZE,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
