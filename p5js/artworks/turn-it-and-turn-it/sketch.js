import { asTurn, lengthsUpTo, ringAt } from "./gaps.js";

/**
 * Turn it and turn it.
 *
 * Every ring is one more turn. The innermost has been turned once and is cut into two arcs;
 * each ring outward has been turned once more than the one inside it and has one more arc.
 * The colour of an arc is its length, and nothing else — the shortest of the lengths at
 * that stage, the middle one, or the longest.
 *
 * Three colours is the whole of it. However far out you read, however many arcs a ring has
 * been cut into, only three lengths are ever present. That is the theorem, and it is not
 * arranged here: the lengths are measured off each ring as exact whole-number pairs and
 * however many distinct ones turn up is how many colours that ring gets. A ring needing a
 * fourth would simply be drawn in a fourth colour, and none ever is.
 *
 * Reading outward also shows why. Going from one ring to the next adds a single mark, so
 * exactly one arc is cut in two and every other arc is left exactly as it was. That is why
 * the boundaries run outward as unbroken walls, with a new one appearing here and there
 * rather than everything shifting: the longest arc is always what gets cut, and it is
 * always cut into the other two lengths, which is the same thing as the longest being their
 * sum. A few rings come out in two colours instead of three. Nothing marks them; they are
 * the stages where the turning has come round almost exactly, and they are where they are.
 */
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

const GROUND = [18, 17, 22];
/** Shortest, middle, longest. The longest is the other two put together. */
const LENGTH_COLOURS = [
  [238, 226, 202],
  [206, 118, 62],
  [72, 104, 158]
];
const UNEXPECTED = [220, 60, 90];

/** How many turns the drawing carries, and where the rings sit. */
const STAGES = 96;
const INNER_RADIUS = 46;
const OUTER_RADIUS = 322;
const RING_WIDTH = (OUTER_RADIUS - INNER_RADIUS) / STAGES;

const FULL_TURN = Math.PI * 2;
const RINGS = Array.from({ length: STAGES }, (unused, index) => ringAt(BigInt(index + 1)));

const P5 = window.p5;

new P5((p5Instance) => {
  const p = p5Instance;

  /**
   * One arc, as the band of paper between two radii and two bearings. Built as a filled
   * shape rather than a thick stroked arc, because a stroked arc is turned into a polygon
   * too coarse for a band this thin and comes out with a sawtooth edge that belongs to the
   * drawing rather than to the mathematics.
   */
  function drawArc(from, span, inner, outer, colour) {
    // Enough samples that no chord of the outer edge is longer than about a pixel.
    const steps = Math.max(2, Math.ceil(span * outer));
    // Run a touch past the end, under where the next arc will be drawn, so that two arcs
    // of the same colour do not show a hairline along the bearing they share.
    span += 0.7 / outer;
    p.noStroke();
    p.fill(...colour);
    p.beginShape();
    for (let step = 0; step <= steps; step += 1) {
      const bearing = from + (span * step) / steps;
      p.vertex(outer * Math.cos(bearing), outer * Math.sin(bearing));
    }
    for (let step = steps; step >= 0; step -= 1) {
      const bearing = from + (span * step) / steps;
      p.vertex(inner * Math.cos(bearing), inner * Math.sin(bearing));
    }
    p.endShape(p.CLOSE);
  }

  function drawRing(ring, index) {
    const inner = INNER_RADIUS + RING_WIDTH * index;
    // A third of a pixel of overlap outward, so that neighbouring rings of the same colour
    // do not show a hairline where their edges meet.
    const outer = inner + RING_WIDTH + 0.34;
    for (const arc of ring.arcs) {
      drawArc(
        FULL_TURN * asTurn(arc.from),
        FULL_TURN * asTurn(arc.gap),
        inner,
        outer,
        LENGTH_COLOURS[arc.role] ?? UNEXPECTED
      );
    }
  }

  function drawAll() {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    RINGS.forEach(drawRing);
    p.pop();
  }

  function publishState() {
    const state = {
      kind: "image",
      stages: RINGS.length,
      // How many distinct arc lengths each stage turned out to have, measured not assumed.
      lengthCounts: RINGS.map((ring) => ring.lengths.length),
      mostLengths: Math.max(...RINGS.map((ring) => ring.lengths.length)),
      twoLengthStages: RINGS
        .filter((ring) => ring.lengths.length === 2)
        .map((ring) => Number(ring.turns)),
      arcs: RINGS.reduce((total, ring) => total + ring.arcs.length, 0),
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
    // A still: every stage is on the paper at once, which is what makes "three at every
    // stage" something a reader can check rather than take on trust.
    p.noLoop();
    drawAll();
    publishState();
  };
});
