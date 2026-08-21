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

const GROUND = [230, 224, 208];
/**
 * Shortest, middle, longest, and the longest is the other two put together. Three
 * weights of one ink rather than three hues, because what they stand for is an ordered
 * quantity: a longer arc is a heavier mark, and the eye reads that without being told.
 * Three colours of its own would have said the lengths were three unrelated kinds.
 */
const LENGTH_COLOURS = [
  [190, 182, 166],
  [110, 116, 126],
  [38, 42, 52]
];
const UNEXPECTED = [220, 60, 90];

/**
 * How many turns the drawing carries, and where the rings sit. Thirty, where there were
 * ninety-six: at ninety-six each ring was under three pixels wide and the figure read as
 * a wheel of confetti, which is no way to be shown that there are only ever three
 * lengths. Wide enough to count is the whole of the choice.
 */
const STAGES = 30;
const INNER_RADIUS = 52;
const OUTER_RADIUS = 320;
const RING_WIDTH = (OUTER_RADIUS - INNER_RADIUS) / STAGES;

/**
 * How far each band is drawn under the band already beside it, in pixels. One whole pixel,
 * because anything less leaves a seam: it is the shape drawn second that has to cover the
 * shared pixel outright, and it can only do that by starting a pixel inside its neighbour.
 */
const OVERLAP = 1;

const FULL_TURN = Math.PI * 2;
const RINGS = Array.from({ length: STAGES }, (unused, index) => ringAt(BigInt(index + 1)));

/**
 * Turning it, when a reader asks.
 *
 * The saying the work is named for is an instruction, so the page takes it: a click sets
 * the rings going. What it must not do is tell a lie about the drawing while they go, and
 * the drawing's claim is about arc lengths -- which a rotation cannot touch. Every ring
 * still shows the same three lengths in the same order all the way round, however far it
 * has been turned; what a turn moves is where the walls between the arcs happen to line
 * up. They break apart as the rings come out of step, and re-form as the rings seat.
 *
 * Each ring is given a whole number of turns, so wherever it stops is where it started.
 * The rings do not start together and they do not stop together: the machine takes hold
 * from the middle outward, and lets go from the middle outward too, an outer ring being
 * both later to start and longer about it. Nothing here is drawn from chance -- speed,
 * bearing, and the moment of letting go are all read off the ring's own index.
 */
const TURN_STAGGER = 0.06;
const TURN_BASE_SECONDS = 6;
const TURN_GROWTH = 0.12;
/** The catch as a ring seats, in radians: about a fifth of a degree, and gone by the end. */
const SEAT_AMPLITUDE = 0.006;
const SEAT_CYCLES = 2;

const TURN_PLANS = RINGS.map((unused, index) => ({
  turns: 1 + (index % 3),
  // Neighbouring rings run opposite ways, the way meshed wheels have to.
  direction: index % 2 === 0 ? 1 : -1,
  from: TURN_STAGGER * index,
  to: TURN_STAGGER * index + TURN_BASE_SECONDS + TURN_GROWTH * index
}));
const TURN_SECONDS = Math.max(...TURN_PLANS.map((plan) => plan.to));

/** Slow into it and slow out of it: no part of a mechanism arrives at speed. */
function ease(turned) {
  return turned * turned * turned * (turned * (6 * turned - 15) + 10);
}

/**
 * The catch as a ring seats. It is largest just before the end and exactly nothing at it,
 * because the last factor is (1 - turned) -- so the ring cannot be left a hair off home by
 * the very thing that is supposed to settle it.
 */
function seat(turned) {
  return Math.sin(SEAT_CYCLES * FULL_TURN * turned) * turned ** 6 * (1 - turned);
}

/**
 * Where a ring stands at a moment of the turning, in radians from home.
 *
 * Nought before it starts and nought once it has stopped -- the second nought written out
 * rather than left to arithmetic, because a whole number of turns comes back to a bearing
 * whose sine is not quite zero in floating point, and the still this page must return to
 * has to be the same picture down to the pixel.
 */
function angleAt(index, seconds) {
  const plan = TURN_PLANS[index];
  if (seconds <= plan.from || seconds >= plan.to) {
    return 0;
  }
  const turned = (seconds - plan.from) / (plan.to - plan.from);
  return plan.direction * (FULL_TURN * plan.turns * ease(turned) + SEAT_AMPLITUDE * seat(turned));
}

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
    // Start a pixel early, under the arc already drawn there, so that two arcs of the same
    // colour do not show a hairline along the bearing they share.
    //
    // The overlap goes backwards and not forwards, which is the whole of the repair. Two
    // antialiased edges meeting on a pixel do not add up to covering it: the first shape
    // leaves the pixel part ground, and the second is itself part transparent there, so a
    // tenth of the ground survives both and the seam shows as a lighter thread. Only the
    // shape drawn second can close it, and only by covering the pixel outright.
    from -= OVERLAP / outer;
    span += OVERLAP / outer;
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
    const edge = INNER_RADIUS + RING_WIDTH * index;
    // Inward, under the ring already drawn there, for the same reason and by the same
    // pixel. The innermost ring keeps its true edge, so the hole at the centre stays where
    // the construction puts it.
    const inner = index === 0 ? edge : edge - OVERLAP;
    const outer = edge + RING_WIDTH;
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

  function drawAll(seconds = 0) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    RINGS.forEach((ring, index) => {
      const angle = angleAt(index, seconds);
      if (angle === 0) {
        // Not rotated by nothing: rotated by nothing is a matrix multiplication, and the
        // still is the picture this has to come back to exactly.
        drawRing(ring, index);
        return;
      }
      p.push();
      p.rotate(angle);
      drawRing(ring, index);
      p.pop();
    });
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

  /** When the reader last set the rings going, in seconds; null while everything is home. */
  let turningSince = null;

  p.setup = () => {
    const canvas = p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
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
    // The turning is the page's own, and no part of it exists for the renderer: an export
    // is the still, and it is taken from a sketch that never had a click to answer.
    if (!CAPTURE_MODE) {
      canvas.mousePressed(() => {
        if (turningSince === null) {
          turningSince = p.millis() / 1000;
          p.loop();
        }
      });
    }
  };

  p.draw = () => {
    if (turningSince === null) {
      p.noLoop();
      return;
    }
    const seconds = p.millis() / 1000 - turningSince;
    if (seconds >= TURN_SECONDS) {
      // Home, and nothing left to draw until somebody asks again.
      turningSince = null;
      drawAll();
      p.noLoop();
      return;
    }
    drawAll(seconds);
  };
});
