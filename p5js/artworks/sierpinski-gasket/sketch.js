import { mulberry32 } from "../shared/random.js";
import {
  BUILD_FRAMES,
  RAIN_FRAMES,
  RAIN_POINTS,
  RAIN_SEED,
  TOTAL_FRAMES,
  buildGasket,
  chaosPoints,
  gasketDepth
} from "./geometry.js";

/**
 * Two constructions that never mention each other, agreeing. First the skeleton is
 * built the way this artwork has always built it — three half-size triangles ringing
 * every parent, seven generations deep — and then the rain begins: a wanderer jumping
 * halfway to a random corner, forever, its trail drawn where it lands. No rule tells
 * the rain about the lace, and it can land nowhere else; the ember points fill
 * exactly the steel skeleton, which is the gasket's whole argument.
 */
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
/** The recursion's floor, as a share of the root radius: seven generations. */
const CUTOFF_RATIO = 1 / 64;
const FILL_RATIO = 0.92;

const GROUND = [12, 15, 20];
const LACE = [172, 194, 214];
const EMBER = [255, 178, 92];
const RAIN_DOT_PX = 1.6;

const GASKET = buildGasket({ x: 0, y: 0 }, 1, CUTOFF_RATIO);
const DEPTH = gasketDepth(GASKET);
const RAIN = chaosPoints({ x: 0, y: 0 }, 1, RAIN_POINTS, mulberry32(RAIN_SEED));

/** Every node with its generation, walked once; the draw stagger needs the depth. */
const NODES = [];
(function collect(node, depth) {
  NODES.push({ center: node.center, radius: node.radius, depth });
  for (const child of node.children) {
    collect(child, depth + 1);
  }
})(GASKET, 0);

/** The figure's own envelope, centred the way the shells and the cube are. */
const BOUNDS = NODES.reduce(
  (bounds, node) => ({
    left: Math.min(bounds.left, node.center.x - node.radius),
    right: Math.max(bounds.right, node.center.x + node.radius),
    top: Math.min(bounds.top, node.center.y - node.radius),
    bottom: Math.max(bounds.bottom, node.center.y + node.radius)
  }),
  { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
);
const SPAN = Math.max(BOUNDS.right - BOUNDS.left, BOUNDS.bottom - BOUNDS.top);
const SCALE = (FILL_RATIO * Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT)) / SPAN;
const OFFSET_X = LOGICAL_WIDTH / 2 - SCALE * (BOUNDS.left + BOUNDS.right) / 2;
const OFFSET_Y = LOGICAL_HEIGHT / 2 - SCALE * (BOUNDS.top + BOUNDS.bottom) / 2;

const P5 = window.p5;

new P5((p) => {
  function trianglePoints(node) {
    return [0, 1, 2].map((index) => {
      const angle = (index * Math.PI * 2) / 3;
      return {
        x: node.center.x + node.radius * Math.cos(angle),
        y: node.center.y + node.radius * Math.sin(angle)
      };
    });
  }

  function drawScene(frameIndex) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(OFFSET_X, OFFSET_Y);
    p.scale(SCALE);

    // The skeleton, level by level: a generation gets its moment before the next.
    const levelSpan = BUILD_FRAMES / (DEPTH + 1);
    p.noFill();
    let laceCount = 0;
    for (const node of NODES) {
      const start = node.depth * levelSpan;
      const reveal = Math.min(Math.max((frameIndex - start) / 10, 0), 1);
      if (reveal === 0) {
        continue;
      }
      laceCount += 1;
      p.stroke(...LACE, (168 - node.depth * 13) * reveal);
      p.strokeWeight(1.1 / SCALE);
      const [a, b, c] = trianglePoints(node);
      p.triangle(a.x, a.y, b.x, b.y, c.x, c.y);
    }

    // The rain, in the order the wanderer landed.
    const fallen = Math.min(
      Math.max(Math.floor(((frameIndex - BUILD_FRAMES) / RAIN_FRAMES) * RAIN.length), 0),
      RAIN.length
    );
    p.noStroke();
    p.fill(...EMBER, 205);
    for (let index = 0; index < fallen; index += 1) {
      p.circle(RAIN[index].x, RAIN[index].y, (2 * RAIN_DOT_PX) / SCALE);
    }
    p.pop();
    return { laceCount, fallen };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      depth: DEPTH,
      triangles: NODES.length,
      laceDrawn: drawn.laceCount,
      rainFallen: drawn.fallen,
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
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawScene(frameIndex)));
    }
    publishState(0, drawScene(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawScene(frameIndex));
  };
});
