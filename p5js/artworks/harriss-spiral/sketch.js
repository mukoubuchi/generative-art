import {
  arcPoints,
  buildCells,
  partitionLines,
  rectangleCorners,
  rootRectangle
} from "./spiral.js";

const LOGICAL_WIDTH = 795;
const LOGICAL_HEIGHT = 600;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
// The Processing sketch set these against a 600 px height, so they are kept as fractions
// of it and the construction is the same at any canvas size.
const MARGIN = LOGICAL_HEIGHT * (20 / 600);
const MINIMUM_SQUARE_SIDE = LOGICAL_HEIGHT * (5 / 600);
const ARC_VERTEX_SPACING = LOGICAL_HEIGHT * (4 / 600);
const PARTITION_WEIGHT = LOGICAL_HEIGHT * (0.75 / 600);
const ARC_WEIGHT = LOGICAL_HEIGHT * (1.2 / 600);
const PARTITION_INK = 190;
const ARC_INK = 35;

const root = rootRectangle(LOGICAL_WIDTH, LOGICAL_HEIGHT, MARGIN);
const cells = buildCells(root, MINIMUM_SQUARE_SIDE);

const P5 = window.p5;

new P5((p) => {
  function polyline(points, close) {
    p.beginShape();
    for (const point of points) {
      p.vertex(point.x, point.y);
    }
    p.endShape(close ? p.CLOSE : undefined);
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.noLoop();
  };

  p.draw = () => {
    p.background(255);
    p.scale(RENDER_SCALE);
    p.noFill();

    // The scaffolding first, so the spiral itself is never broken by a partition line.
    p.stroke(PARTITION_INK);
    p.strokeWeight(PARTITION_WEIGHT);
    polyline(rectangleCorners(root), true);
    for (const cell of cells) {
      for (const [start, end] of partitionLines(cell)) {
        p.line(start.x, start.y, end.x, end.y);
      }
    }

    p.stroke(ARC_INK);
    p.strokeWeight(ARC_WEIGHT);
    for (const cell of cells) {
      polyline(arcPoints(cell.largeBranchArc, ARC_VERTEX_SPACING), false);
      polyline(arcPoints(cell.smallBranchArc, ARC_VERTEX_SPACING), false);
    }

    window.__ARTWORK_STATE__ = {
      kind: "image",
      cellCount: cells.length,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
