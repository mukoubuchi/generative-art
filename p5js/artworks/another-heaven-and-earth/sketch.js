import {
  CENTRE, DISC_RADIUS, DURATION_SECONDS, LOGICAL_SIZE, PLAYBACK_FPS, STROKES, TOTAL_FRAMES,
  pageFrame, sceneAt
} from "./world.js";

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10)) : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

/**
 * Truchet Tides' paper and its one ink: the petals in it shaded from full strength to pale,
 * the water in it thinned, the bank a shade darker than the streamlines. Nothing here glows.
 */
const PAPER = [230, 224, 208];
const INK = [38, 52, 74];
const PETAL_ALPHA = 1;
const WATER_ALPHA = 0.42;
const BANK_ALPHA = 0.7;
/** The rim, the edge of the disc, in the thinned ink at this width in logical pixels. */
const RIM_ALPHA = 0.7;
const RIM_WIDTH = 1.2;

/**
 * A petal is shaded across its width, from the full ink at its darker side's widest point to
 * PETAL_PALE at the other side's, as a brush laid on its side leaves a stroke. The shading is
 * the drawing's alone: the outline and its place are the arcs' own. A petal drawn shorter than
 * SHADED pixels is filled flat, halfway between the two, where the shading could not be seen.
 */
const PETAL_PALE = 0.3;
const SHADED = 4;

/**
 * A petal or a stroke drawn shorter than this many pixels is not filled: near the rim it is a
 * speck that would change a few pixels of the frame, and filling the specks would double the
 * time a frame takes. Its place and shape are still worked out like any other's.
 */
const SMALLEST = 0.1;
/**
 * A stroke drawn narrower than this many pixels at its widest is not filled either: near the
 * rim, from far off, it is a hairline that changes a few dozen pixels of the frame, and filling
 * the hairlines doubles the time a frame takes.
 */
const THINNEST = 0.05;

const rgba = ([r, g, b], alpha) => `rgba(${r},${g},${b},${alpha})`;

/**
 * A petal that has just fallen comes up in this many steps of opacity, so that a frame's
 * petals are filled in at most this many paths a layer. Filling each one that is still coming
 * up on its own, two dozen small fills a frame, made the page drop frames.
 */
const FADE_STEPS = 4;

new window.p5((p) => {
  let startedAt;
  let ctx;

  /**
   * A closed outline of arcs as a subpath, each arc drawn about its own centre. The arcs are
   * points of the unit disc; `scale` takes them to logical pixels about the centre. The angles
   * are taken before scaling, so a petal near the rim, a few millionths of the disc across,
   * keeps its digits.
   */
  function traceArcs(arcs, scale) {
    const first = arcs[0].from;
    ctx.moveTo(CENTRE + scale * first.x, CENTRE + scale * first.y);
    for (const arc of arcs) {
      const a0 = Math.atan2(arc.from.y - arc.centre.y, arc.from.x - arc.centre.x);
      const a1 = Math.atan2(arc.to.y - arc.centre.y, arc.to.x - arc.centre.x);
      ctx.arc(CENTRE + scale * arc.centre.x, CENTRE + scale * arc.centre.y, scale * arc.radius, a0, a1, arc.anticlockwise);
    }
    ctx.closePath();
  }

  /** Whether any of an outline's arcs reaches the canvas, from their centres and radii. */
  function inView(arcs, scale) {
    for (const arc of arcs) {
      const x = CENTRE + scale * arc.centre.x;
      const y = CENTRE + scale * arc.centre.y;
      const r = scale * arc.radius;
      if (x + r > 0 && x - r < LOGICAL_SIZE && y + r > 0 && y - r < LOGICAL_SIZE) return true;
    }
    return false;
  }

  const span = (from, to) => Math.hypot(to.x - from.x, to.y - from.y);
  /** A stroke's drawn length, end to end; a petal's, base to the middle of its rounded tip. */
  const strokeLength = (stroke) => span(stroke.arcs[0].from, stroke.arcs[0].to);
  /** A stroke's drawn width at its widest, across from one arc's middle to the other's. */
  const strokeWidth = (stroke) => span(stroke.arcs[0].mid, stroke.arcs[1].mid);
  const petalLength = (petal) => span(petal.arcs[0].from, petal.arcs[2].mid);

  /** The strokes of some lines that are long and wide enough to see and reach the canvas, as one path in one ink. */
  function drawStrokes(lines, alpha, scale) {
    let drawn = 0;
    ctx.fillStyle = rgba(INK, alpha);
    ctx.beginPath();
    for (const { strokes } of lines) {
      for (const stroke of strokes) {
        if (scale * strokeLength(stroke) < SMALLEST || scale * strokeWidth(stroke) < THINNEST || !inView(stroke.arcs, scale)) continue;
        traceArcs(stroke.arcs, scale);
        drawn += 1;
      }
    }
    ctx.fill();
    return drawn;
  }

  /** The water: every streamline's strokes in thinned ink, then the bank's, darker, then the rim. */
  function drawWater(scale) {
    const [bank, ...streams] = STROKES;
    const drawn = drawStrokes(streams, WATER_ALPHA, scale) + drawStrokes([bank], BANK_ALPHA, scale);
    ctx.strokeStyle = rgba(INK, RIM_ALPHA);
    ctx.lineWidth = RIM_WIDTH;
    ctx.beginPath();
    ctx.arc(CENTRE, CENTRE, scale, 0, 2 * Math.PI);
    ctx.stroke();
    return drawn;
  }

  /** Petals in steps of coming up, one path a step, flat. */
  function fillInSteps(petals, alpha, scale) {
    const steps = Array.from({ length: FADE_STEPS }, () => []);
    for (const petal of petals) steps[Math.max(1, Math.ceil(petal.fade * FADE_STEPS)) - 1].push(petal);
    steps.forEach((list, k) => {
      if (list.length === 0) return;
      ctx.fillStyle = rgba(INK, (alpha * (k + 1)) / FADE_STEPS);
      ctx.beginPath();
      for (const petal of list) traceArcs(petal.arcs, scale);
      ctx.fill();
    });
  }

  /** One petal shaded across its width, from its darker side's widest point to the other's. */
  function fillShaded(petal, scale) {
    const [top, bottom] = [petal.arcs[0].to, petal.arcs[3].to];
    const [from, to] = petal.shape.dark > 0 ? [top, bottom] : [bottom, top];
    const shade = ctx.createLinearGradient(CENTRE + scale * from.x, CENTRE + scale * from.y, CENTRE + scale * to.x, CENTRE + scale * to.y);
    const strength = Math.max(1, Math.ceil(petal.fade * FADE_STEPS)) / FADE_STEPS;
    shade.addColorStop(0, rgba(INK, PETAL_ALPHA * strength));
    shade.addColorStop(1, rgba(INK, PETAL_PALE * strength));
    ctx.fillStyle = shade;
    ctx.beginPath();
    traceArcs(petal.arcs, scale);
    ctx.fill();
  }

  /** Every petal long enough to see and in view: the small ones flat in steps, the rest each shaded. */
  function drawPetals(scene, scale) {
    const shown = scene.petals.filter((petal) => scale * petalLength(petal) >= SMALLEST && inView(petal.arcs, scale));
    const small = shown.filter((petal) => scale * petalLength(petal) < SHADED);
    fillInSteps(small, (PETAL_ALPHA + PETAL_PALE) / 2, scale);
    for (const petal of shown) if (scale * petalLength(petal) >= SHADED) fillShaded(petal, scale);
    return shown.length;
  }

  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    const scale = DISC_RADIUS * scene.scale;
    p.background(...PAPER);
    ctx.save();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    const strokes = drawWater(scale);
    const shown = drawPetals(scene, scale);
    ctx.restore();
    return {
      kind: "video", frameIndex: scene.frameIndex, totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS, seconds: scene.seconds, scale: scene.scale,
      fallen: scene.petals.length, shown, strokes,
      logicalSize: { width: LOGICAL_SIZE, height: LOGICAL_SIZE },
      outputSize: { width: OUTPUT_SIZE, height: OUTPUT_SIZE }
    };
  }

  function publishState(state) {
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_SIZE, OUTPUT_SIZE).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    if (CAPTURE_MODE) p.noLoop();
    p.frameRate(PLAYBACK_FPS);
    ctx = p.drawingContext;
    if (CAPTURE_MODE) window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    publishState(drawFrame(0));
    startedAt = performance.now();
  };
  p.draw = () => {
    if (CAPTURE_MODE) return;
    const frame = pageFrame((performance.now() - startedAt) / 1000);
    publishState(drawFrame(frame));
    if (frame === TOTAL_FRAMES - 1) p.noLoop();
  };
});
