import {
  DURATION_SECONDS,
  LOGICAL_SIZE,
  PLAYBACK_FPS,
  RIM_RADIUS,
  TOTAL_FRAMES,
  chords,
  sceneAt
} from "./all-on-one-circumference.js";

/**
 * One circle, every chord from its top and every chord to its bottom, and a body let go
 * on each. At every instant the falling family is one circle and the arriving family is
 * another, the two touch on the perpendicular, and the touching point is the one body
 * the odd-number rule speaks of. The marks left at equal times stand the odd numbers
 * apart.
 *
 * Night ground and bone hairlines for what stands; the gold family and the steel family
 * of the crystal artworks for the two circles of bodies, the gold falling from the top
 * and the steel arriving at the bottom; and the body they share in bone.
 */
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

const GROUND = [6, 7, 12];
const BONE = [246, 244, 236];
const GOLD_FACE = [222, 166, 96];
const GOLD_EDGE = [252, 204, 116];
const STEEL_FACE = [104, 144, 204];
const STEEL_EDGE = [156, 192, 240];

/** The standing figure: the rim and the chords, once. */
const CHORDS = chords();
const RIM_ALPHA = 110;
const CHORD_ALPHA = 46;
const HAIRLINE = 0.7;
/** The two circles of bodies, and the marks they leave at the ticks. */
const CIRCLE_ALPHA = 190;
const CIRCLE_WEIGHT = 1.3;
const STAMP_ALPHA = 96;
const STAMP_WEIGHT = 0.9;
/** A mark flares as it is laid and settles over about half a second. */
const STAMP_FLARE = 120;
const STAMP_FLARE_FRAMES = 12;
const MARK_SIZE = 5;
/**
 * The bodies are lit as Troubling of a Star lights its bobs: a halo of six additive layers
 * in the family's colour, a core of the same colour, and a white heart, all at one level,
 * a half, which is the brightness the reader chose over dots and over a stronger star. The
 * shared body -- the one on the perpendicular that both families run -- is the same star in
 * bone, drawn last over the two families.
 */
const STAR_LEVEL = 0.5;
const STAR_LAYERS = 6;
const STAR_HALO = (11 + 46 * STAR_LEVEL) / 2;
const STAR_HALO_ALPHA = 4 + 20 * STAR_LEVEL;
const STAR_CORE = 3 + 2 * STAR_LEVEL;
const STAR_CORE_ALPHA = 150 + 90 * STAR_LEVEL;
const STAR_HEART = 1.5 + STAR_LEVEL;
const STAR_HEART_ALPHA = 130 + 110 * STAR_LEVEL;
const HEART_WHITE = [248, 250, 255];

const P5 = window.p5;

new P5((p) => {
  function drawCircle(circle, colour, alpha, weight) {
    // A circle of no radius is a point, and the point is drawn as the body it is.
    if (circle.radius <= 0) return;
    p.noFill();
    p.stroke(...colour, alpha);
    p.strokeWeight(weight);
    p.circle(circle.center[0], circle.center[1], 2 * circle.radius);
  }

  /** One body as a star: the halo's layers widening outwards, then the core, then the heart. */
  function star([x, y], tint, alpha) {
    for (let layer = STAR_LAYERS; layer >= 1; layer -= 1) {
      p.fill(tint[0], tint[1], tint[2], STAR_HALO_ALPHA * alpha);
      p.circle(x, y, 2 * STAR_HALO * layer / STAR_LAYERS);
    }
    p.fill(tint[0], tint[1], tint[2], STAR_CORE_ALPHA * alpha);
    p.circle(x, y, 2 * STAR_CORE);
    p.fill(HEART_WHITE[0], HEART_WHITE[1], HEART_WHITE[2], STAR_HEART_ALPHA * alpha);
    p.circle(x, y, 2 * STAR_HEART);
  }

  function drawLayer({ alpha, state, stamps }) {
    for (const stamp of stamps) {
      const standing = (STAMP_ALPHA + STAMP_FLARE * Math.exp(-stamp.age / STAMP_FLARE_FRAMES)) * alpha;
      drawCircle(stamp.top, GOLD_FACE, standing, STAMP_WEIGHT);
      drawCircle(stamp.bottom, STEEL_FACE, standing, STAMP_WEIGHT);
      // Where the two touched: the mark on the perpendicular that the strides are read off.
      p.noStroke();
      p.fill(...BONE, standing);
      p.circle(stamp.kiss[0], stamp.kiss[1], MARK_SIZE);
    }
    drawCircle(state.top, GOLD_FACE, CIRCLE_ALPHA * alpha, CIRCLE_WEIGHT);
    drawCircle(state.bottom, STEEL_FACE, CIRCLE_ALPHA * alpha, CIRCLE_WEIGHT);

    p.noStroke();
    // Added rather than painted, so the stars pile up into light where the bodies crowd.
    p.blendMode(p.ADD);
    for (const [bodies, tint] of [[state.topBodies, GOLD_EDGE], [state.bottomBodies, STEEL_EDGE], [[state.kiss], BONE]]) {
      for (const body of bodies) star(body, tint, alpha);
    }
    p.blendMode(p.BLEND);
  }

  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    p.background(...GROUND);
    p.push();
    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_SIZE / 2, LOGICAL_SIZE / 2);

    p.noFill();
    p.stroke(...BONE, CHORD_ALPHA);
    p.strokeWeight(HAIRLINE);
    for (const chord of CHORDS) {
      p.line(chord.from[0], chord.from[1], chord.to[0], chord.to[1]);
    }
    p.stroke(...BONE, RIM_ALPHA);
    p.strokeWeight(1);
    p.circle(0, 0, 2 * RIM_RADIUS);

    for (const layer of scene.layers) drawLayer(layer);
    p.pop();
    return scene;
  }

  function publishState(scene) {
    const state = {
      kind: "video",
      frameIndex: scene.frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      act: scene.act,
      layers: scene.layers.map((layer) => ({
        alpha: layer.alpha,
        fraction: layer.state.fraction,
        kiss: layer.state.kiss,
        stamps: layer.stamps.map((stamp) => stamp.tick)
      })),
      chords: CHORDS.length,
      bodies: 2 * scene.layers[0].state.topBodies.length + 1,
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
