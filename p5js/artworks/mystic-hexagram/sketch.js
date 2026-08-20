import {
  CONIC_RADIUS_X,
  CONIC_RADIUS_Y,
  DURATION_SECONDS,
  PLAYBACK_FPS,
  TOTAL_FRAMES,
  VERTEX_LABELS,
  constructionAt,
  phaseAt
} from "./pascal.js";

/**
 * Six points make Pascal's hexagon on one ellipse. Each opposite pair of sides is extended
 * to its intersection, and the three intersections illuminate the line they share.
 */
const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 640;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

const GROUND = [15, 11, 27];
const CONIC = [95, 80, 128];
const HEXAGRAM = [231, 197, 113];
const PASCAL = [224, 238, 219];
const LABEL = [220, 213, 196];
const PAIRS = [
  { sides: ["KP", "VO"], colour: [161, 125, 232] },
  { sides: ["PQ", "ON"], colour: [72, 192, 189] },
  { sides: ["QV", "NK"], colour: [226, 107, 151] }
];

const P5 = window.p5;

new P5((p) => {
  function lineAcrossCanvas(line) {
    const xLimit = LOGICAL_WIDTH / 2 - 18;
    const yLimit = LOGICAL_HEIGHT / 2 - 18;
    const candidates = [];

    if (Math.abs(line.b) > 1e-9) {
      for (const x of [-xLimit, xLimit]) {
        const y = -(line.a * x + line.c) / line.b;
        if (Math.abs(y) <= yLimit + 1e-7) {
          candidates.push({ x, y });
        }
      }
    }
    if (Math.abs(line.a) > 1e-9) {
      for (const y of [-yLimit, yLimit]) {
        const x = -(line.b * y + line.c) / line.a;
        if (Math.abs(x) <= xLimit + 1e-7) {
          candidates.push({ x, y });
        }
      }
    }

    let pair = [candidates[0], candidates[1]];
    let farthest = -1;
    for (let first = 0; first < candidates.length; first += 1) {
      for (let second = first + 1; second < candidates.length; second += 1) {
        const distance = p.dist(
          candidates[first].x,
          candidates[first].y,
          candidates[second].x,
          candidates[second].y
        );
        if (distance > farthest) {
          farthest = distance;
          pair = [candidates[first], candidates[second]];
        }
      }
    }
    return pair;
  }

  function drawInfiniteLine(line, colour, alpha, weight) {
    const [from, to] = lineAcrossCanvas(line);
    p.stroke(...colour, alpha);
    p.strokeWeight(weight);
    p.line(from.x, from.y, to.x, to.y);
  }

  function drawGeometry(frameIndex) {
    const construction = constructionAt(frameIndex);
    const { vertices, sides, intersections, pascalLine } = construction;
    p.background(...GROUND);
    p.push();
    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    p.noFill();
    p.stroke(...CONIC, 190);
    p.strokeWeight(2);
    p.ellipse(0, 0, 2 * CONIC_RADIUS_X, 2 * CONIC_RADIUS_Y);
    p.stroke(...CONIC, 35);
    p.ellipse(0, 0, 2 * CONIC_RADIUS_X + 14, 2 * CONIC_RADIUS_Y + 14);

    for (const pair of PAIRS) {
      for (const side of pair.sides) {
        drawInfiniteLine(sides[side], pair.colour, 42, 1.1);
      }
    }
    drawInfiniteLine(pascalLine, PASCAL, 210, 2.4);

    p.stroke(...HEXAGRAM, 215);
    p.strokeWeight(2.2);
    p.noFill();
    p.beginShape();
    for (const label of VERTEX_LABELS) {
      p.vertex(vertices[label].x, vertices[label].y);
    }
    p.endShape(p.CLOSE);

    p.textFont("Georgia");
    p.textSize(15);
    p.textAlign(p.CENTER, p.CENTER);
    for (const label of VERTEX_LABELS) {
      const point = vertices[label];
      const outward = 1.075;
      p.noStroke();
      p.fill(...HEXAGRAM, 245);
      p.circle(point.x, point.y, 9);
      p.fill(...LABEL, 225);
      p.text(label, point.x * outward, point.y * outward);
    }

    const phase = phaseAt(frameIndex);
    for (const [index, label] of ["M", "T", "S"].entries()) {
      const point = intersections[label];
      const pulse = 0.5 + 0.5 * Math.cos(Math.PI * 2 * phase * 3 - index * Math.PI * 2 / 3);
      p.noFill();
      p.stroke(...PASCAL, 80 + 140 * pulse);
      p.strokeWeight(1.5);
      p.circle(point.x, point.y, 13 + 9 * pulse);
      p.noStroke();
      p.fill(...PASCAL, 245);
      p.circle(point.x, point.y, 7);
      p.fill(...LABEL, 230);
      p.text(label, point.x + 15, point.y - 15);
    }

    p.pop();
    return construction;
  }

  function publishState(frameIndex, construction) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      pascalPoints: construction.intersections,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => {
        const construction = drawGeometry(frameIndex);
        return Promise.resolve(publishState(frameIndex, construction));
      };
    }
    const construction = drawGeometry(0);
    publishState(0, construction);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    const construction = drawGeometry(frameIndex);
    publishState(frameIndex, construction);
  };
});
