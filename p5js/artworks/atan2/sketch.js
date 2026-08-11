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
 * The corner the readouts occupy, in centred coordinates. The bottom-right one: the
 * published page hangs its hub plates in both top corners and its legend at the
 * bottom-left foot, and the readouts are printed into the capture too, so this is the
 * corner that is quiet in every context. No needle stands under the type — a needle
 * half-hidden by the plate reads as a defect, and the corner is the readouts' ground
 * the way the rest of the canvas is the field's.
 */
const READOUT_BLOCK = {
  left: LOGICAL_WIDTH / 2 - TEXT_SIZE * 13,
  top: LOGICAL_HEIGHT / 2 - TEXT_SIZE * 4.6,
  right: LOGICAL_WIDTH / 2,
  bottom: LOGICAL_HEIGHT / 2
};

const GRID = needleGrid(LOGICAL_WIDTH, LOGICAL_HEIGHT, NEEDLE_SPACING, GRID_MARGIN)
  .filter((foot) => !(
    foot.x >= READOUT_BLOCK.left - NEEDLE_LENGTH && foot.x <= READOUT_BLOCK.right
    && foot.y >= READOUT_BLOCK.top - NEEDLE_LENGTH && foot.y <= READOUT_BLOCK.bottom
  ));

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

    // Readouts in the bottom-right corner, over a plate of the ground so any needle
    // tip reaching in stays a needle rather than noise behind type.
    p.push();
    p.scale(RENDER_SCALE);
    p.noStroke();
    const plateLeft = LOGICAL_WIDTH - TEXT_SIZE * 13;
    const plateTop = LOGICAL_HEIGHT - TEXT_SIZE * 4.6;
    p.fill(...GROUND, 216);
    p.rect(plateLeft, plateTop, TEXT_SIZE * 13, TEXT_SIZE * 4.6);
    p.fill(...READOUT_INK);
    p.textSize(TEXT_SIZE);
    p.text(`radian: ${centreAngle.toFixed(4)}`, plateLeft + TEXT_SIZE, plateTop + TEXT_SIZE * 1.6);
    p.text(`degree: ${p.degrees(centreAngle).toFixed(2)}`, plateLeft + TEXT_SIZE, plateTop + TEXT_SIZE * 3.0);
    p.text(`(${Math.trunc(probe.x)}, ${Math.trunc(probe.y)})`, plateLeft + TEXT_SIZE, plateTop + TEXT_SIZE * 4.4);
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
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
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
