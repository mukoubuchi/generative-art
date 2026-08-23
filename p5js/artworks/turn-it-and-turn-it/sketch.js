import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { RIPPLE_FRAMES, drawPointerIndicator, ripplePhase } from "../shared/input-indicator.js";
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
 *
 * The clip is one click, recorded. It opens on the drawing at rest, a pointer comes down
 * on the wheel, and the machine takes hold from the middle outward and lets go the same
 * way; every ring is given a whole number of turns, so the picture it comes back to is the
 * picture it left. The first frame and the last are both that picture, and both are the
 * picture the catalogue has always carried. What the turning is for is the claim: the three
 * lengths are still three, and still in the same order round each ring, however far the
 * rings have been carried out of step with one another.
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
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
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
// Both radii taken down by a twentieth, which leaves the figure's own proportions where
// they were and moves its rim off the legend. At 320 the outer ring passed 1.27 pixels
// from the plate the note sits on -- clear of it, but not visibly clear of it, and a
// line a reader is meant to read wants air around it. At 304 the nearest ink stands
// 17.31 pixels off. Both numbers are measured, on the drawn pixels rather than on the
// figure's bounding box: the figure is a disc and the note sits under one corner of
// that box, where there has never been any ink at all.
const INNER_RADIUS = 49.4;
const OUTER_RADIUS = 304;
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

const PLAYBACK_FPS = 30;
/**
 * The clip's plan, in frames. The turning is not the clip's to shorten -- it is the page's
 * mechanism, and it takes as long as the outermost ring takes -- so the clip is built round
 * it: a rest at the start for the pointer to come down on, the whole of the turning, and a
 * rest at the end on the drawing it comes back to. Twelve seconds, because 11.22 of them
 * are already spoken for -- the outermost ring starts latest and takes longest, and
 * `turnSeconds` reads that off the plans rather than being told it.
 */
const REST_FRAMES = 12;
const CLIP_SECONDS = 12;
const TOTAL_FRAMES = CLIP_SECONDS * PLAYBACK_FPS;
/** Where the recorded hand comes down: out on the wide bands, clear of the middle. */
const PRESS_BEARING = Math.PI * 0.28;
const PRESS_RADIUS = OUTER_RADIUS * 0.62;
/** How long the pointer's core stays thickened after the press, in frames. */
const PRESS_HOLD_FRAMES = 4;
/**
 * The hand is in the picture for the gesture and for nothing else: it comes down six
 * frames before the press and lifts when the ripple has gone. Both ends of the clip are
 * the drawing at rest and nothing else, which is what lets them be the same picture the
 * catalogue registers -- a pointer resting on the wheel would be a mark the still has not
 * got, and the clip would no longer begin and end on it.
 */
const HAND_LEAD_FRAMES = 6;

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

  /**
   * The recorded hand, drawn into the clip and nowhere else. The page has the reader's own
   * pointer on it and the thumbnail carries the legend; a phantom hand would be a lie in
   * one direction and an instruction that cannot be followed in the other.
   */
  /** Whether the recorded hand is in the picture at `frameIndex`. */
  function handShown(frameIndex) {
    const since = frameIndex - REST_FRAMES;
    return since >= -HAND_LEAD_FRAMES && since < RIPPLE_FRAMES;
  }

  function drawHand(frameIndex) {
    const since = frameIndex - REST_FRAMES;
    p.push();
    p.scale(RENDER_SCALE);
    drawPointerIndicator(
      p,
      LOGICAL_WIDTH / 2 + PRESS_RADIUS * Math.cos(PRESS_BEARING),
      LOGICAL_HEIGHT / 2 + PRESS_RADIUS * Math.sin(PRESS_BEARING),
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      {
        pressed: since >= 0 && since <= PRESS_HOLD_FRAMES,
        ripple: ripplePhase(since < 0 ? null : since)
      }
    );
    p.pop();
  }

  /**
   * Where the turning has got to at `frameIndex`, in seconds, and nought while the drawing
   * is still at rest. A pure function of the index: a frame asked for twice is the same
   * frame, and every ring is home at both ends of the clip because `angleAt` returns
   * exactly nought outside a ring's plan rather than arriving near it.
   */
  function turningAt(frameIndex) {
    return Math.max(0, (frameIndex - REST_FRAMES) / PLAYBACK_FPS);
  }

  function publishState(frameIndex, seconds) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      turningSeconds: seconds,
      turnSeconds: TURN_SECONDS,
      atRest: TURN_PLANS.every((plan) => angleAt(plan, seconds) === 0),
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
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      // The clip replays a click rather than answering one: every frame is a function of
      // its index, so the capture is deterministic and both ends are the drawing at rest.
      p.noLoop();
      window.__renderFrame = (frameIndex) => {
        const seconds = turningAt(frameIndex);
        drawAll(seconds);
        if (INDICATOR && handShown(frameIndex)) {
          drawHand(frameIndex);
        }
        return Promise.resolve(publishState(frameIndex, seconds));
      };
    }
    drawAll();
    publishState(0, 0);
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
    if (CAPTURE_MODE) {
      return;
    }
    if (turningSince === null) {
      p.noLoop();
      return;
    }
    const seconds = p.millis() / 1000 - turningSince;
    if (seconds >= TURN_SECONDS) {
      // Home, and nothing left to draw until somebody asks again.
      turningSince = null;
      drawAll();
      publishState(p.frameCount, 0);
      p.noLoop();
      return;
    }
    drawAll(seconds);
    publishState(p.frameCount, seconds);
  };
});
