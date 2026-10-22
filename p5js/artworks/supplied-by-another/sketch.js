import { WIDTH, HEIGHT, GROUND, buildFabric, traceEdges, drawFabric } from "./fabric.js";

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = HEIGHT * RENDER_SCALE;
const FABRIC = buildFabric();
const PATHS = traceEdges(FABRIC);
const P5 = window.p5;

new P5((p) => {
  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.noLoop();
  };

  p.draw = () => {
    p.background(...GROUND);
    p.push();
    p.scale(RENDER_SCALE);
    drawFabric(p.drawingContext, PATHS);
    p.pop();
    window.__ARTWORK_STATE__ = {
      kind: "image",
      faces: FABRIC.faces.length,
      edges: FABRIC.edges.length,
      logicalSize: { width: WIDTH, height: HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
