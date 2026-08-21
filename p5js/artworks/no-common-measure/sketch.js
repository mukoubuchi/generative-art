import {
  BEAD_CORE,
  BEAD_HALO,
  CANVAS,
  SLOPE,
  SPAN,
  SHORTFALL_LIMIT,
  curve,
  descends,
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

const CURVES = shortfalls();
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

  function drawAll() {
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
    p.pop();
  }

  function publishState() {
    const beaded = CURVES.filter((entry) => entry.pairs.length > 0).map((entry) => Number(entry.c));
    const bare = CURVES.filter((entry) => entry.pairs.length === 0).map((entry) => Number(entry.c));
    const state = {
      kind: "image",
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
    // A still: there is one drawing and it is the whole of it, so there is no frame for the
    // renderer to ask for. It waits for the ready flag and takes what is on the canvas.
    p.noLoop();
    drawAll();
    publishState();
  };
});
