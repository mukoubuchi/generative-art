import { mulberry32 } from "../shared/random.js";
import {
  BUILD_FRAMES,
  FILM_SATURATION,
  RAIN_POINTS,
  RAIN_SEED,
  TOTAL_FRAMES,
  buildGasket,
  chaosPoints,
  deepestCells,
  dropFallAt,
  fallenAt,
  gasketDepth,
  isDrawnFalling,
  rippleAt,
  wetting
} from "./geometry.js";

/**
 * Two constructions that never mention each other, agreeing. First the pyramid is
 * built the way this artwork has always built it — three half-size triangles ringing
 * every parent, seven generations deep — and then the rain begins: a wanderer jumping
 * halfway to a random corner, forever, falling where it lands. No rule tells the rain
 * about the stone, and it can land nowhere else; the water fills exactly the figure
 * that was built, which is the gasket's whole argument.
 *
 * What the rain leaves is a film rather than a scatter of grains. Each landing wets
 * the smallest triangle that holds it, and three thousand two hundred landings wet
 * seven hundred and twenty of the seven hundred and twenty-nine there are — so the
 * water gathers into the shape of the figure instead of speckling it. The film is the
 * evidence; the drops and their rings are how a single landing reads.
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

/**
 * Night, the stone, and the water.
 *
 * The temperatures are the other way round from how this artwork first stood. The
 * figure is read as a pyramid, so it takes the settled gold the sun-side ball of
 * Toggle Color Ball is painted in — the quietest of the collection's golds, because
 * stone that outshone the rain falling on it would put the living thing behind the
 * still one. The rain is Bounding Spots' star blue, light enough to be seen on the
 * night this artwork already stood on, and it is one colour for all three of its
 * states: the drop in the air, the ring where it lands, the film it leaves.
 */
const GROUND = [12, 15, 20];
const STONE = [214, 152, 58];
const WATER = [128, 176, 236];

/**
 * The weather, in canvas pixels. The fall is a fifth of the canvas high and takes
 * DROP_FRAMES, so a drop crosses the picture too quickly to be followed and slowly
 * enough to be seen leaving somewhere. The ring's reach is about two cells wide,
 * which is enough to be found and too little to cover the stone it opens on.
 */
const FALL_PX = 120;
const DROP_PX = 13;
const DROP_WEIGHT_PX = 1.7;
const RIPPLE_PX = 10;
const RIPPLE_WEIGHT_PX = 1.3;
/** How dark the film is on a cell's first landing, and once it can take no more. */
const FILM_FIRST = 48;
const FILM_FULL = 150;

const GASKET = buildGasket({ x: 0, y: 0 }, 1, CUTOFF_RATIO);
const DEPTH = gasketDepth(GASKET);
const RAIN = chaosPoints({ x: 0, y: 0 }, 1, RAIN_POINTS, mulberry32(RAIN_SEED));
const CELLS = deepestCells(GASKET);
const WETTING = wetting(GASKET, RAIN);

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

  /** How many landings each cell has taken by now, in the order they landed. */
  function wetnessBy(fallen) {
    const counts = new Map();
    for (let index = 0; index < fallen; index += 1) {
      const landing = WETTING[index];
      if (landing.cell !== -1) {
        counts.set(landing.cell, landing.hits);
      }
    }
    return counts;
  }

  function drawScene(frameIndex) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(OFFSET_X, OFFSET_Y);
    p.scale(SCALE);

    // The water that has gathered, under the stone so the edges stay sharp. A cell
    // darkens with every landing it takes rather than switching on at the first, so
    // the film keeps deepening long after it has finished spreading: three quarters
    // of the cells are wet by a third of the way through the rain.
    const fallen = fallenAt(frameIndex);
    const wetness = wetnessBy(fallen);
    p.noStroke();
    for (const [cell, hits] of wetness) {
      const depth = Math.min(hits / FILM_SATURATION, 1);
      p.fill(...WATER, FILM_FIRST + (FILM_FULL - FILM_FIRST) * depth);
      const [a, b, c] = trianglePoints(CELLS[cell]);
      p.triangle(a.x, a.y, b.x, b.y, c.x, c.y);
    }

    // The stone, level by level: a generation gets its moment before the next.
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
      p.stroke(...STONE, (168 - node.depth * 13) * reveal);
      p.strokeWeight(1.1 / SCALE);
      const [a, b, c] = trianglePoints(node);
      p.triangle(a.x, a.y, b.x, b.y, c.x, c.y);
    }

    // The rings. Only a landing that finds a dry cell rings, so the rain grows
    // quieter as the figure fills: the sound is the sound of somewhere new.
    let ringing = 0;
    p.noFill();
    p.strokeWeight(RIPPLE_WEIGHT_PX / SCALE);
    for (let index = 0; index < fallen; index += 1) {
      if (!WETTING[index].first) {
        continue;
      }
      const open = rippleAt(index, frameIndex);
      if (open === null) {
        continue;
      }
      ringing += 1;
      p.stroke(...WATER, 235 * (1 - open));
      p.circle(RAIN[index].x, RAIN[index].y, (2 * RIPPLE_PX * open) / SCALE);
    }

    // The drops still in the air. One landing in eight is drawn falling — every one
    // of them wets its cell, but drawn all together they are a sheet of water rather
    // than rain with drops in it. Each falls from rest, so it is longest and quickest
    // just before it arrives.
    let falling = 0;
    p.strokeWeight(DROP_WEIGHT_PX / SCALE);
    p.stroke(...WATER, 225);
    for (let index = 0; index < RAIN_POINTS; index += 1) {
      if (!isDrawnFalling(index)) {
        continue;
      }
      const dropped = dropFallAt(index, frameIndex);
      if (dropped === null) {
        continue;
      }
      falling += 1;
      const above = (FALL_PX * (1 - dropped ** 2)) / SCALE;
      const length = (DROP_PX * dropped) / SCALE;
      const { x, y } = RAIN[index];
      p.line(x, y - above - length, x, y - above);
    }

    p.pop();
    return { laceCount, fallen, wet: wetness.size, ringing, falling };
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
      cellsWet: drawn.wet,
      ringsOpen: drawn.ringing,
      dropsFalling: drawn.falling,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    // Pinned only while capturing, and only after the canvas exists. Before it, p5 has
    // nothing to set the density on and the call is quietly ignored; on a Retina screen
    // the backing store then comes out twice the size asked for. Left alone in the
    // browser, so a reader on such a screen gets the picture drawn at their own
    // resolution -- and pinned here, so an export is the size the manifest says
    // rather than whatever density the machine doing the rendering happens to have.
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
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
