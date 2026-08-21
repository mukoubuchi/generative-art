import {
  BEAD_CORE,
  BEAD_HALO,
  CANVAS,
  SLOPE,
  SPAN,
  SHORTFALL_LIMIT,
  curve,
  defect,
  descends,
  distanceToBareLine,
  fold,
  place,
  shortfalls
} from "./descent.js";

/**
 * No common measure.
 *
 * Take a right isosceles triangle and suppose some unit measured its leg a whole number of
 * times and its hypotenuse a whole number of times — q and p. Then p squared minus twice q
 * squared would be nought. Every pair of whole numbers falls somewhere short of that, and
 * the amount it falls short is what is drawn here: one curve for every whole shortfall from
 * minus seventeen to plus seventeen, warm where the hypotenuse count runs long and cool
 * where it runs short, with a bead at every pair of whole numbers that sits on it.
 *
 * Some curves are strung with beads and some are bare, and nothing marks which in advance.
 * Seventeen has pairs; fifteen has none; thirteen, twelve, eleven, ten, six, five and three
 * have none. The curves are all drawn the same way and the beads fall where they fall.
 *
 * The curves crowd towards one line, and that line is the curve of nought — the one a
 * common measure would sit on. It is drawn like the rest and it is bare, and it is bare all
 * the way out, which is what there being no such measure looks like. It is also the only
 * straight one, because it is the only shortfall a pair could have without the triangle
 * having any size at all.
 *
 * The threads running down to the bottom left are the descent. From any pair, folding the
 * triangle gives another pair, smaller, on the curve of the opposite shortfall; the threads
 * join each pair to the one its fold gives. They all run out — each at whatever small pair
 * its own fold can no longer descend from, because whole positive numbers cannot go down
 * for ever. A thread starting on the bare line would be the one that never ended, and
 * there is nothing on the bare line to start it.
 *
 * The clip runs the descent backwards. Motes rise along the threads — up from the small
 * pair a ladder ends at towards the pair it started from — and they ride the threads and
 * nothing else. The line of nought is crossed and never landed on: no mote rises from it,
 * none ends on it, none travels along it, because it carries no pair for any of that to
 * start from. The crossings are not incidental to that. A fold multiplies the shortfall by
 * minus one, so consecutive rungs sit on opposite sides of the line and every thread has to
 * cross it; the crossing is the step itself, the moment the shortfall changes sign.
 */
const LOGICAL_WIDTH = CANVAS;
const LOGICAL_HEIGHT = CANVAS;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

const GROUND = [16, 15, 20];
/** The hypotenuse count running long, and running short. */
const OVER = [226, 132, 58];
const UNDER = [92, 146, 206];
/** The curve of nought, and the beads that never appear on it. */
const BARE = [232, 228, 220];
const BEAD = [244, 238, 226];
const THREAD = [126, 118, 132];

const REACH = Number(SPAN);
const PLAYBACK_FPS = 30;
const TOTAL_FRAMES = 300;

const CURVES = shortfalls();

/**
 * The descent, run backwards. Every ladder is walked from the pair it ends at up to the
 * pair it started from, so a mote rides the same segments the threads are drawn from —
 * the path is built by the same descends/fold/place calls drawThreads uses, so a mote
 * cannot be anywhere a thread is not. Nothing starts on the line of nought because the
 * line of nought has no pairs to start from; that is the theorem, not a rule imposed here.
 */
function ascents() {
  const drawn = [];
  for (const { pairs } of CURVES) {
    for (const pair of pairs) {
      if (descends(pair.p, pair.q)) {
        drawn.push(pair);
      }
    }
  }
  const key = (pair) => `${pair.p},${pair.q}`;
  const arrivedAt = new Set(drawn.map((pair) => key(fold(pair.p, pair.q))));
  const paths = [];
  for (const top of drawn) {
    // A top is a pair no thread arrives at: the highest rung of its own ladder.
    if (arrivedAt.has(key(top))) {
      continue;
    }
    const rungs = [top];
    while (descends(rungs.at(-1).p, rungs.at(-1).q)) {
      rungs.push(fold(rungs.at(-1).p, rungs.at(-1).q));
    }
    // Downwards as the fold gives it; reversed here, which is the direction a mote goes.
    const points = rungs
      .map((rung) => ({ ...place(Number(rung.q), Number(rung.p)), q: Number(rung.q), p: Number(rung.p) }))
      .reverse();
    const lengths = [0];
    for (let index = 1; index < points.length; index += 1) {
      lengths.push(lengths[index - 1] + Math.hypot(
        points[index].x - points[index - 1].x,
        points[index].y - points[index - 1].y
      ));
    }
    // The shortfall of every rung this ladder rides: nought would be a pair on the bare
    // line, and the search never finds one, so this list can never contain it.
    const defects = rungs.map((rung) => Number(defect(rung.p, rung.q)));
    paths.push({ points, lengths, total: lengths.at(-1), defects });
  }
  return paths;
}

const ASCENTS = ascents();
/** Motes per ladder, and how many times each ladder is travelled in one clip. */
const MOTES_PER_ASCENT = 3;
/** Whole turns per clip, so the last frame hands over to the first with nothing to patch. */
const TURNS = ASCENTS.map((_, index) => 1 + (index % 3));
/**
 * A mote is a small light rather than a white dot: a stack of faint veils added together
 * with a core at the middle. Flat dots on the threads would read as marks laid over the
 * drawing; these read as something lit on the thread each one rides.
 */
const MOTE_CORE = 1.3;
const MOTE_CORE_ALPHA = 190;
const MOTE_HALO = 7.5;
const MOTE_HALO_ALPHA = 14;
const MOTE_LAYERS = 10;

/** Where a mote sits along its ladder at a given phase, measured in paper units. */
function moteAt(ascent, phase) {
  const distance = phase * ascent.total;
  let index = 1;
  while (index < ascent.lengths.length - 1 && ascent.lengths[index] < distance) {
    index += 1;
  }
  const from = ascent.points[index - 1];
  const to = ascent.points[index];
  const span = ascent.lengths[index] - ascent.lengths[index - 1];
  const within = span > 0 ? (distance - ascent.lengths[index - 1]) / span : 0;
  return {
    x: from.x + (to.x - from.x) * within,
    y: from.y + (to.y - from.y) * within,
    q: from.q + (to.q - from.q) * within,
    p: from.p + (to.p - from.p) * within
  };
}

/** Every mote of a frame, as position and brightness. Nothing here draws. */
function motesAt(frameIndex) {
  const time = frameIndex / TOTAL_FRAMES;
  const motes = [];
  ASCENTS.forEach((ascent, index) => {
    for (let mote = 0; mote < MOTES_PER_ASCENT; mote += 1) {
      const phase = (time * TURNS[index] + mote / MOTES_PER_ASCENT) % 1;
      // Lit on the way in and out, so a mote arrives and leaves rather than blinking.
      const fade = Math.min(1, phase / 0.12, (1 - phase) / 0.12);
      const at = moteAt(ascent, phase);
      motes.push({ ...at, fade, ascent: index, defects: ascent.defects });
    }
  });
  return motes;
}
const P5 = window.p5;

new P5((p5Instance) => {
  const p = p5Instance;

  /** Closer to the line means a smaller shortfall, and a stronger line to draw it with. */
  function weightFor(shortfall) {
    const nearness = 1 - Math.abs(shortfall) / (Number(SHORTFALL_LIMIT) + 3);
    return { alpha: 70 + 150 * nearness ** 2, weight: 0.7 + 1.0 * nearness ** 2 };
  }

  function drawCurve(shortfall) {
    const { alpha, weight } = weightFor(shortfall);
    const colour = shortfall >= 0 ? OVER : UNDER;
    p.noFill();
    p.stroke(...colour, alpha);
    p.strokeWeight(weight);
    p.beginShape();
    for (const point of curve(shortfall, REACH)) {
      const at = place(point.q, point.p);
      p.vertex(at.x, at.y);
    }
    p.endShape();
  }

  function drawBareLine() {
    // The curve of nought. Drawn on the same rule as the others; it comes out straight
    // because a pair with no shortfall is a triangle with no size.
    p.noFill();
    p.stroke(...BARE, 240);
    p.strokeWeight(1.9);
    const from = place(0, 0);
    const to = place(REACH, REACH * SLOPE);
    p.line(from.x, from.y, to.x, to.y);
  }

  function drawThreads() {
    // Each pair joined to the pair its fold gives. Where the fold no longer descends, the
    // thread simply is not there, which is where that descent ran out.
    p.stroke(...THREAD, 150);
    p.strokeWeight(0.9);
    for (const { pairs } of CURVES) {
      for (const pair of pairs) {
        if (!descends(pair.p, pair.q)) {
          continue;
        }
        const next = fold(pair.p, pair.q);
        const from = place(Number(pair.q), Number(pair.p));
        const to = place(Number(next.q), Number(next.p));
        p.line(from.x, from.y, to.x, to.y);
      }
    }
  }

  function drawBeads() {
    p.noStroke();
    for (const { c, pairs } of CURVES) {
      // The beads are the same size everywhere: a pair either is a pair or is not.
      const tint = Number(c) >= 0 ? OVER : UNDER;
      for (const pair of pairs) {
        const at = place(Number(pair.q), Number(pair.p));
        p.fill(...tint, 96);
        p.circle(at.x, at.y, BEAD_HALO);
        p.fill(...BEAD, 245);
        p.circle(at.x, at.y, BEAD_CORE);
      }
    }
  }

  /**
   * The motes: the descent run backwards, as light. Small, added rather than painted over,
   * so a mote reads as something lit on the thread rather than a white dot laid on it.
   */
  function drawMotes(frameIndex) {
    const motes = motesAt(frameIndex);
    p.noStroke();
    p.blendMode(p.ADD);
    for (const mote of motes) {
      for (let layer = MOTE_LAYERS; layer >= 1; layer -= 1) {
        const reach = MOTE_HALO * layer / MOTE_LAYERS;
        p.fill(...BEAD, MOTE_HALO_ALPHA * mote.fade);
        p.circle(mote.x, mote.y, 2 * reach);
      }
      p.fill(...BEAD, MOTE_CORE_ALPHA * mote.fade);
      p.circle(mote.x, mote.y, 2 * MOTE_CORE);
    }
    p.blendMode(p.BLEND);
    return motes;
  }

  function drawAll(frameIndex) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    for (const { c } of CURVES) {
      if (c !== 0n) {
        drawCurve(Number(c));
      }
    }
    drawThreads();
    drawBeads();
    // Last, and over everything, so that it reads as one straight thing among the curves
    // and so that it can be seen passing between the beads rather than through any of them.
    drawBareLine();
    const motes = drawMotes(frameIndex);
    p.pop();
    return motes;
  }

  function publishState(frameIndex = 0, motes = []) {
    const beaded = CURVES.filter((entry) => entry.pairs.length > 0).map((entry) => Number(entry.c));
    const bare = CURVES.filter((entry) => entry.pairs.length === 0).map((entry) => Number(entry.c));
    // The mote check, at the state rather than the pixels: how near the line of nought any
    // mote comes, and how many sit on it. A mote on that line would be a descent that never
    // ended, so nought is the only answer the drawing can give.
    const nearest = motes.reduce(
      (least, mote) => Math.min(least, distanceToBareLine(mote.q, mote.p)),
      Infinity
    );
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: TOTAL_FRAMES / PLAYBACK_FPS,
      motes: motes.length,
      // A mote of the bare line would be one whose ladder had a rung of shortfall nought.
      motesFromBareCurve: motes.filter((mote) => mote.defects.some((value) => value === 0)).length,
      // And, separately, how near the drawn line a mote passes as it crosses it.
      motesWithinHalfPixel: motes.filter((mote) => distanceToBareLine(mote.q, mote.p) < 0.5).length,
      nearestMoteToBareLine: Number.isFinite(nearest) ? nearest : null,
      curves: CURVES.length,
      beaded,
      bare,
      beads: CURVES.reduce((total, entry) => total + entry.pairs.length, 0),
      pairsOnNought: CURVES.find((entry) => entry.c === 0n).pairs.length,
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
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawAll(frameIndex)));
    }
    publishState(0, drawAll(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawAll(frameIndex));
  };
});
