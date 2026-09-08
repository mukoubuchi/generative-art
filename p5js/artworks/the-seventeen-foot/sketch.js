import {
  COMMENSURABLE_RADII,
  CROSSING,
  DURATION_SECONDS,
  INTRUDER,
  LOGICAL_SIZE,
  ORIGIN,
  PLAYBACK_FPS,
  TOTAL_FRAMES,
  TRIANGLE_COUNT,
  VERTICES,
  arrivingVertex,
  onPage,
  sceneAt
} from "./the-seventeen-foot.js";

/**
 * Theodorus's roots up to the seventeen-foot, and the one that is not drawn.
 *
 * Sixteen right triangles share the origin, each new unit side standing perpendicular to the
 * radius just drawn, so the hypotenuses are √1 through √17. The page plays the clip: the
 * triangles arrive one after another, then the seventeenth comes along its unit side, its
 * radius passing the opening ray and crossing the first unit side, stays, and goes back, and
 * the sixteen are held before the figure dissolves to the ground it opened on. There is
 * nothing to press, and the retreat is given no reason.
 *
 * Night ground; bone for the unit sides and the radii, Platonic Duals' gold for the four
 * radii that are a whole number of feet and for a whisper of fill; the intruder in the
 * duals' steel; and the crossing lit as Troubling of a Star lights its bobs, as far as the
 * intruder's radius has gone past the opening ray.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

const GROUND = [6, 7, 12];
const BONE = [246, 244, 236];
const GOLD_EDGE = [252, 204, 116];
const STEEL_FACE = [104, 144, 204];
const STEEL_EDGE = [156, 192, 240];
const HEART_WHITE = [248, 250, 255];

/** The line hierarchy: the unit sides and the square radii heavy, every other radius a hair. */
const SIDE_WEIGHT = 2.0;
const SIDE_ALPHA = 225;
const SQUARE_WEIGHT = 2.0;
const SQUARE_ALPHA = 225;
const RADIUS_WEIGHT = 0.6;
const RADIUS_ALPHA = 60;
/** The fill is a whisper of gold that deepens from the first triangle to the sixteenth. */
const FILL_ALPHA_FIRST = 5;
const FILL_ALPHA_LAST = 16;
/** The intruder: its sector in steel, its radius and unit side in the steel edge. */
const INTRUDER_FILL_ALPHA = 64;
const INTRUDER_RADIUS_WEIGHT = 0.9;
const INTRUDER_RADIUS_ALPHA = 96;
/**
 * The crossing is lit as Troubling of a Star lights its bobs, at a level of six tenths: six
 * additive halo layers in gold, a gold core and a white heart, the whole scaled by how far
 * the intruder's radius stands past the opening ray.
 */
const STAR_LEVEL = 0.6;
const STAR_LAYERS = 6;
const STAR_HALO = (11 + 46 * STAR_LEVEL) / 2;
const STAR_HALO_ALPHA = 4 + 20 * STAR_LEVEL;
const STAR_CORE = 3 + 2 * STAR_LEVEL;
const STAR_CORE_ALPHA = 150 + 90 * STAR_LEVEL;
const STAR_HEART = 1.5 + STAR_LEVEL;
const STAR_HEART_ALPHA = 130 + 110 * STAR_LEVEL;

const P5 = window.p5;
const ORIGIN_ON_PAGE = onPage(ORIGIN);
const VERTICES_ON_PAGE = VERTICES.map(onPage);
const CROSSING_ON_PAGE = onPage(CROSSING);

new P5((p) => {
  /** Triangle `index` (1-based) with its new vertex `part` of the way along its unit side. */
  function outerOf(index, part) {
    return part >= 1 ? VERTICES_ON_PAGE[index] : onPage(arrivingVertex(index, part));
  }

  function sector(index, outer, alpha) {
    const inner = VERTICES_ON_PAGE[index - 1];
    p.noStroke();
    p.fill(GOLD_EDGE[0], GOLD_EDGE[1], GOLD_EDGE[2], alpha);
    p.triangle(ORIGIN_ON_PAGE[0], ORIGIN_ON_PAGE[1], inner[0], inner[1], outer[0], outer[1]);
  }

  /** The radius to vertex `index`: gold and heavy when it is a whole number of feet. */
  function radius(index, point, fade) {
    const square = COMMENSURABLE_RADII.includes(index);
    const tint = square ? GOLD_EDGE : BONE;
    p.stroke(tint[0], tint[1], tint[2], (square ? SQUARE_ALPHA : RADIUS_ALPHA) * fade);
    p.strokeWeight(square ? SQUARE_WEIGHT : RADIUS_WEIGHT);
    p.line(ORIGIN_ON_PAGE[0], ORIGIN_ON_PAGE[1], point[0], point[1]);
  }

  function side(from, to, tint, fade) {
    p.stroke(tint[0], tint[1], tint[2], SIDE_ALPHA * fade);
    p.strokeWeight(SIDE_WEIGHT);
    p.line(from[0], from[1], to[0], to[1]);
  }

  /** The crossing as a star: the halo's layers widening outwards, then the core, then the heart. */
  function star([x, y], alpha) {
    p.blendMode(p.ADD);
    p.noStroke();
    for (let layer = STAR_LAYERS; layer >= 1; layer -= 1) {
      p.fill(GOLD_EDGE[0], GOLD_EDGE[1], GOLD_EDGE[2], STAR_HALO_ALPHA * alpha);
      p.circle(x, y, 2 * STAR_HALO * layer / STAR_LAYERS);
    }
    p.fill(GOLD_EDGE[0], GOLD_EDGE[1], GOLD_EDGE[2], STAR_CORE_ALPHA * alpha);
    p.circle(x, y, 2 * STAR_CORE);
    p.fill(HEART_WHITE[0], HEART_WHITE[1], HEART_WHITE[2], STAR_HEART_ALPHA * alpha);
    p.circle(x, y, 2 * STAR_HEART);
    p.blendMode(p.BLEND);
  }

  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    p.background(...GROUND);
    if (scene.fade <= 0 || scene.reach <= 0) {
      return { scene, triangles: 0 };
    }
    p.push();
    p.scale(RENDER_SCALE);
    p.strokeCap(p.ROUND);

    const complete = Math.min(TRIANGLE_COUNT, Math.floor(scene.reach));
    const remainder = scene.reach - complete;
    const drawn = remainder > 0 ? complete + 1 : complete;

    // The sixteen: their sectors, then every radius, then the unit sides over them.
    const outline = [VERTICES_ON_PAGE[0]];
    for (let index = 1; index <= drawn; index += 1) {
      const outer = outerOf(index, index <= complete ? 1 : remainder);
      const whisper = FILL_ALPHA_FIRST + (FILL_ALPHA_LAST - FILL_ALPHA_FIRST) * Math.min(index - 1, 15) / 15;
      sector(index, outer, whisper * scene.fade);
      outline.push(outer);
    }
    radius(1, VERTICES_ON_PAGE[0], scene.fade);
    for (let index = 1; index <= drawn; index += 1) {
      radius(index + 1, outline[index], scene.fade);
    }
    p.noFill();
    for (let index = 1; index < outline.length; index += 1) {
      side(outline[index - 1], outline[index], BONE, scene.fade);
    }

    if (scene.extra > 0) {
      // The intruder: its sector, its radius and its unit side, as far as it has come.
      const outer = outerOf(INTRUDER, scene.extra);
      const inner = VERTICES_ON_PAGE[INTRUDER - 1];
      p.noStroke();
      p.fill(STEEL_FACE[0], STEEL_FACE[1], STEEL_FACE[2], INTRUDER_FILL_ALPHA * scene.fade);
      p.triangle(ORIGIN_ON_PAGE[0], ORIGIN_ON_PAGE[1], inner[0], inner[1], outer[0], outer[1]);
      p.stroke(STEEL_EDGE[0], STEEL_EDGE[1], STEEL_EDGE[2], INTRUDER_RADIUS_ALPHA * scene.fade);
      p.strokeWeight(INTRUDER_RADIUS_WEIGHT);
      p.line(ORIGIN_ON_PAGE[0], ORIGIN_ON_PAGE[1], outer[0], outer[1]);
      side(inner, outer, STEEL_EDGE, scene.fade);
    }
    if (scene.light > 0) {
      star(CROSSING_ON_PAGE, scene.light * scene.fade);
    }
    p.pop();
    return { scene, triangles: drawn };
  }

  function publishState({ scene, triangles }) {
    const state = {
      kind: "video",
      frameIndex: scene.frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      act: scene.act,
      reach: scene.reach,
      triangles,
      extra: scene.extra,
      light: scene.light,
      fade: scene.fade,
      triangleCount: TRIANGLE_COUNT,
      crossing: CROSSING_ON_PAGE,
      palette: "crystal",
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    }
    publishState(drawFrame(0));
  };

  p.draw = () => publishState(drawFrame(p.frameCount % TOTAL_FRAMES));
});
