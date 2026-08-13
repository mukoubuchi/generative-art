import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawPointerIndicator } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  angleArc,
  angleTone,
  centreLegs,
  needleAngle,
  needleGrid,
  orbitPoint
} from "./compass.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const SWEEP_SECONDS = 10;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
const HINT_LEGEND = [
  { cap: "move", text: "the pointer carries the point" }
];
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
/** The lattice: spacing wide enough for the needles to read as individuals. */
const NEEDLE_SPACING = BASE_DIMENSION * (40 / 680);
const GRID_MARGIN = BASE_DIMENSION * (34 / 680);
const NEEDLE_LENGTH = BASE_DIMENSION * (24 / 680);
const NEEDLE_WEIGHT = 1.8;
const HEAD_RADIUS = 2.6;
/** The centre needle keeps the original artwork's whole diagram around itself. */
const CENTRE_LENGTH = BASE_DIMENSION * (34 / 680);
const CENTRE_WEIGHT = 2.4;
const ARC_RADIUS = BASE_DIMENSION * (44 / 680);
const PROBE_RADIUS = 5;
const ORBIT_RADIUS = BASE_DIMENSION * 0.3;
const TEXT_SIZE = BASE_DIMENSION * (16 / 680);
const TOTAL_FRAMES = SWEEP_SECONDS * PLAYBACK_FPS;

/** The charcoal the field stands on. */
const GROUND = [16, 16, 18];
/** The two families the answer's sign divides the plane into, and their meeting tone. */
const NEUTRAL = [172, 170, 174];
const GOLD = [255, 196, 72];
const STEEL = [104, 156, 228];
/** The scaffolding of the centre's diagram: legs, arc, readouts. */
const SCAFFOLD = [160, 160, 166, 130];
const ARC_INK = [206, 204, 210, 210];
const READOUT_INK = [218, 216, 222];
const PROBE_INK = [242, 242, 246];

/**
 * The band the readouts occupy, in centred coordinates: the dark space across the top
 * of the canvas, centred, clear of the page's hub plate (top-left) and its legend
 * (bottom-left foot) in every context the readouts are printed into. No needle stands
 * under the type — the band is the readouts' ground the way the rest of the canvas is
 * the field's — so the line floats on the artwork's own dark with no plate at all.
 */
const READOUT_BLOCK = {
  left: -TEXT_SIZE * 11.5,
  top: -LOGICAL_HEIGHT / 2,
  right: TEXT_SIZE * 11.5,
  bottom: -LOGICAL_HEIGHT / 2 + TEXT_SIZE * 4
};

const GRID = needleGrid(LOGICAL_WIDTH, LOGICAL_HEIGHT, NEEDLE_SPACING, GRID_MARGIN)
  .filter((foot) => !(
    foot.x >= READOUT_BLOCK.left - NEEDLE_LENGTH && foot.x <= READOUT_BLOCK.right + NEEDLE_LENGTH
    && foot.y >= READOUT_BLOCK.top - NEEDLE_LENGTH && foot.y <= READOUT_BLOCK.bottom + NEEDLE_LENGTH
  ));

/** A pixel coordinate, sign always shown, three digits wide whatever it holds. */
function signedPixels(value) {
  const rounded = Math.round(value);
  return (rounded < 0 ? "-" : "+") + String(Math.abs(rounded)).padStart(3, " ");
}

/**
 * A measurement, sign always shown, integer part padded to a fixed width. The digits
 * are designed rather than defaulted: at the orbit's radius one pixel of probe motion
 * is about 0.005 radians, or three tenths of a degree, so radians carry three decimals
 * and degrees one — the last digit shown is the last digit the hand can mean.
 */
function signedFixed(value, decimals, integerWidth) {
  const magnitude = Math.abs(value).toFixed(decimals);
  return (value < 0 ? "-" : "+") + magnitude.padStart(integerWidth + 1 + decimals, " ");
}

function mix(from, to, amount) {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount
  ];
}

function toneColor(tone) {
  if (tone.family === "gold") {
    return mix(NEUTRAL, GOLD, tone.strength);
  }
  if (tone.family === "steel") {
    return mix(NEUTRAL, STEEL, tone.strength);
  }
  return NEUTRAL;
}

const live = { probe: orbitPoint(0, TOTAL_FRAMES, ORBIT_RADIUS), followPointer: false };

const P5 = window.p5;

new P5((p) => {
  function drawNeedle(foot, probe, length, weight) {
    const angle = needleAngle(foot, probe);
    const color = toneColor(angleTone(angle));
    const tipX = foot.x + length * Math.cos(angle);
    const tipY = foot.y + length * Math.sin(angle);
    p.stroke(...color);
    p.strokeWeight(weight);
    p.line(foot.x, foot.y, tipX, tipY);
    p.noStroke();
    p.fill(...color);
    p.circle(tipX, tipY, HEAD_RADIUS * 2);
  }

  function render(probe) {
    const centreAngle = needleAngle({ x: 0, y: 0 }, probe);
    const arc = angleArc(centreAngle);
    const legs = centreLegs(probe);

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    // The field: every needle answers for itself.
    for (const foot of GRID) {
      if (foot.x === 0 && foot.y === 0) {
        continue;
      }
      drawNeedle(foot, probe, NEEDLE_LENGTH, NEEDLE_WEIGHT);
    }

    // The centre keeps the original diagram: the journey divided into its two legs,
    // the angle those legs are handed to atan2 as, and the answer read out plainly.
    p.stroke(...SCAFFOLD);
    p.strokeWeight(1.4);
    p.line(legs.horizontal.from.x, legs.horizontal.from.y, legs.horizontal.to.x, legs.horizontal.to.y);
    p.line(legs.vertical.from.x, legs.vertical.from.y, legs.vertical.to.x, legs.vertical.to.y);
    p.noFill();
    p.stroke(...ARC_INK);
    p.strokeWeight(1.8);
    p.arc(0, 0, ARC_RADIUS * 2, ARC_RADIUS * 2, arc.start, arc.end);
    drawNeedle({ x: 0, y: 0 }, probe, CENTRE_LENGTH, CENTRE_WEIGHT);

    // The probe: the one point the whole plane is asking about.
    p.noStroke();
    p.fill(...PROBE_INK);
    p.circle(probe.x, probe.y, PROBE_RADIUS * 2);
    p.pop();

    // The readouts, top and centre: the coordinates named as coordinates, then the
    // whole computation as the equation it is — atan2 taking y first, which is the
    // function's own signature and the thing every diagram forgets to teach. Monospace
    // type, every sign always printed, every field zero-jitter wide, so the line holds
    // still while its numbers run.
    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    p.fill(...READOUT_INK);
    p.textFont("monospace");
    p.textSize(TEXT_SIZE);
    p.textAlign(p.CENTER, p.BASELINE);
    p.text(
      `(x, y) = (${signedPixels(probe.x)}, ${signedPixels(probe.y)})`,
      LOGICAL_WIDTH / 2,
      TEXT_SIZE * 1.9
    );
    p.text(
      `atan2(y, x) = ${signedFixed(centreAngle, 3, 1)} rad = ${signedFixed(p.degrees(centreAngle), 1, 3)}°`,
      LOGICAL_WIDTH / 2,
      TEXT_SIZE * 3.5
    );
    p.pop();

    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }

    return { probe, angle: centreAngle };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      angle: drawn.angle,
      probe: drawn.probe,
      needles: GRID.length,
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
    p.noCursor();
    if (CAPTURE_MODE) {
      p.noLoop();
      // Every capture frame is a pure function of its index, so any one can stand alone.
      window.__renderFrame = (frameIndex) => {
        const probe = orbitPoint(frameIndex, TOTAL_FRAMES, ORBIT_RADIUS);
        const drawn = render(probe);
        if (INDICATOR) {
          // The probe is the pointer's position: what orbits in the clip is a hand.
          p.push();
          p.scale(RENDER_SCALE);
          p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
          drawPointerIndicator(p, probe.x, probe.y, LOGICAL_WIDTH, LOGICAL_HEIGHT);
          p.pop();
        }
        return Promise.resolve(publishState(frameIndex, drawn));
      };
    }
    publishState(0, render(live.probe));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    if (live.followPointer) {
      live.probe = {
        x: p.mouseX - LOGICAL_WIDTH / 2,
        y: p.mouseY - LOGICAL_HEIGHT / 2
      };
    }
    publishState(p.frameCount, render(live.probe));
  };

  p.mouseMoved = () => {
    live.followPointer = true;
    return true;
  };
});
