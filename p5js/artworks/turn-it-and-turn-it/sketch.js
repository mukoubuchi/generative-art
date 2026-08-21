import { hintMode } from "../shared/hint-mode.js";
import { drawKeyHint } from "../shared/key-hint.js";
import { asTurn, lengthsUpTo, ringAt } from "./gaps.js";
import { FULL_TURN, angleAt, turnPlans, turnSeconds } from "./turning.js";

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
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
/**
 * The work is named for an instruction, so the instruction is what the legend prints.
 * Nothing here has to be worded: the saying already is the thing to do.
 */
const HINT_LEGEND = [{ cap: "click", text: "turn it and turn it" }];

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

const RINGS = Array.from({ length: STAGES }, (unused, index) => ringAt(BigInt(index + 1)));

// How each ring turns when a reader asks, and when the last of them is home. The plans
// are arithmetic and are held to it next door, in turning.js.
const TURN_PLANS = turnPlans(STAGES);
const TURN_SECONDS = turnSeconds(TURN_PLANS);

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
      const angle = angleAt(TURN_PLANS[index], seconds);
      if (angle === 0) {
        // Not rotated by nothing. Rotating a finished ring by its whole number of turns
        // was measured against this and gives a byte-identical canvas, so nothing in the
        // picture is riding on the skip; what the skip buys is that the return is exact
        // in the arithmetic rather than fourteen decimal places below a pixel.
        drawRing(ring, index);
        return;
      }
      p.push();
      p.rotate(angle);
      drawRing(ring, index);
      p.pop();
    });
    p.pop();
    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }
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
