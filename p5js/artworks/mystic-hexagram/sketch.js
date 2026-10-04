import {
  CONIC_RADIUS_X,
  CONIC_RADIUS_Y,
  DURATION_SECONDS,
  PLAYBACK_FPS,
  TOTAL_FRAMES,
  VERTEX_LABELS,
  constructionAt
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

/**
 * The palette No Such Passage takes from the dark, lit works (All on One Circumference's
 * constants): night, bone hairlines over a bed for the given figure, steel for the
 * hexagon, gold for the line the three crossings share and for the crossings' light.
 */
const GROUND = [6, 7, 12];
const BED = [16, 18, 28];
const BONE = [246, 244, 236];
const STEEL_FACE = [104, 144, 204];
const GOLD_FACE = [222, 166, 96];
const GOLD_EDGE = [252, 204, 116];
const HEART_WHITE = [248, 250, 255];
/** How far a witness's light reaches, and in how many veils. */
const WITNESS_HALO = 46;
const WITNESS_LAYERS = 12;
const OPPOSITE_PAIRS = [
  ["KP", "VO"],
  ["PQ", "ON"],
  ["QV", "NK"]
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

  /**
   * A crossing is identified by accumulated light, not a diagram marker. The nested
   * veils have no rim; their shared centre is simply where the Pascal line burns most.
   * The light is the house gold with the white heart the house stars carry.
   *
   * The light reaches 46 pixels, which is far enough for the line to burn rather than
   * merely carry three dots, and short enough that the three stay three: over the whole
   * clip the nearest two witnesses come 121.8 pixels apart, and two reaches meet at 92.
   */
  function drawWitnessLight(point) {
    p.noStroke();
    p.blendMode(p.ADD);
    for (let layer = WITNESS_LAYERS; layer >= 1; layer -= 1) {
      p.fill(...GOLD_EDGE, 5);
      p.circle(point.x, point.y, 2 * WITNESS_HALO * layer / WITNESS_LAYERS);
    }
    p.fill(...GOLD_EDGE, 150);
    p.circle(point.x, point.y, 2 * 6.5);
    p.fill(...HEART_WHITE, 235);
    p.circle(point.x, point.y, 2 * 3.2);
    p.blendMode(p.BLEND);
  }

  function drawGeometry(frameIndex) {
    const construction = constructionAt(frameIndex);
    const { vertices, sides, intersections, pascalLine } = construction;
    p.background(...GROUND);
    p.push();
    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    // The conic as No Such Passage draws its eyelets: a bed under a bone hairline.
    p.noFill();
    p.stroke(...BED);
    p.strokeWeight(7);
    p.ellipse(0, 0, 2 * CONIC_RADIUS_X, 2 * CONIC_RADIUS_Y);
    p.stroke(...BONE, 0.3 * 255);
    p.strokeWeight(0.7);
    p.ellipse(0, 0, 2 * CONIC_RADIUS_X, 2 * CONIC_RADIUS_Y);

    // All six extensions recede into one ink; incidence, not colour coding, pairs them.
    for (const pair of OPPOSITE_PAIRS) {
      for (const side of pair) {
        drawInfiniteLine(sides[side], BONE, 20, 0.55);
      }
    }

    // The Pascal line is the passage: gold strokes under a gold heart line.
    drawInfiniteLine(pascalLine, GOLD_FACE, 9, 11);
    drawInfiniteLine(pascalLine, GOLD_FACE, 28, 4.2);
    drawInfiniteLine(pascalLine, GOLD_EDGE, 0.95 * 255, 1.3);

    // The hexagon in steel, as No Such Passage's walkers are drawn.
    p.noFill();
    p.stroke(...STEEL_FACE, 0.9 * 255);
    p.strokeWeight(1.3);
    p.beginShape();
    for (const label of VERTEX_LABELS) {
      p.vertex(vertices[label].x, vertices[label].y);
    }
    p.endShape(p.CLOSE);

    for (const point of Object.values(intersections)) {
      drawWitnessLight(point);
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
