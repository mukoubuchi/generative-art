import { hintMode, indicatorShown } from "../shared/hint-mode.js";
import { drawPointerIndicator, ripplePhase } from "../shared/input-indicator.js";
import { drawKeyHint } from "../shared/key-hint.js";
import {
  STEPS_PER_SECOND,
  bobEnergies,
  createNetwork,
  grab,
  release,
  step,
  totalEnergy
} from "./network.js";
import {
  RELEASE_STEP,
  REST_STEPS,
  TOTAL_STEPS,
  networkAfter,
  scenarioEnergyPeak,
  scenarioPointer
} from "./scenario.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const HINT = hintMode(PARAMETERS, CAPTURE_MODE);
const HINT_LEGEND = [
  { cap: "drag", text: "pull a bob; the ring answers" }
];
const INDICATOR = indicatorShown(PARAMETERS, CAPTURE_MODE);
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
const RING_RADIUS = BASE_DIMENSION * (110 / 680);
const PULL_DISTANCE = BASE_DIMENSION * (150 / 680);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;
const NETWORK_OPTIONS = {
  centerX: LOGICAL_WIDTH / 2,
  centerY: LOGICAL_HEIGHT / 2,
  radius: RING_RADIUS,
  // Straight up the figure's own axis of symmetry, so the two sides of the ring
  // answer as mirror images — which the tests pin rather than assume.
  dragTarget: { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 - RING_RADIUS - PULL_DISTANCE }
};

/** Night, faint rigging, and the two families energy moves between. */
const NIGHT = [8, 9, 18];
const RIGGING = [110, 120, 145];
const STAKE = [96, 102, 120];
const STRAIN_AMBER = [255, 186, 104];
const MOTION_ICE = [172, 214, 255];
const CORE_WHITE = [248, 250, 255];
const HELD_ROSE = [255, 150, 175];
const STAKE_SIZE = 7;
const HALO_LAYERS = 6;

/**
 * The glow scale is the scenario's own physics: its top is the highest energy the
 * capture ever holds — the moment of release — and it runs logarithmically down to
 * a floor three decades below, because the energy falls geometrically and a linear
 * scale would go dark moments after the hand let go.
 *
 * The floor is where the artwork calls it rest, and it is placed deliberately: the
 * damping leaves the network holding rather less than a thousandth of the pull by
 * the end of the clip, so the last frame is as dark as the first and the loop
 * closes on the quiet it opened in. A settling this gentle never reaches zero in
 * finite time, so the closure has to be a threshold rather than an arrival.
 */
const PEAK_ENERGY = scenarioEnergyPeak(NETWORK_OPTIONS);
const FLOOR_ENERGY = PEAK_ENERGY * 1e-3;

function glowLevel(energy) {
  if (energy <= FLOOR_ENERGY) {
    return 0;
  }
  return Math.min(Math.log(energy / FLOOR_ENERGY) / Math.log(PEAK_ENERGY / FLOOR_ENERGY), 1);
}

const liveNetwork = createNetwork(NETWORK_OPTIONS);
// Where the scenario's hand starts: on the top bob, at its rest position.
const SCENARIO_START = { x: liveNetwork.bobs[0].x, y: liveNetwork.bobs[0].y };

const P5 = window.p5;

new P5((p) => {
  function mix(from, to, amount) {
    return [
      from[0] + (to[0] - from[0]) * amount,
      from[1] + (to[1] - from[1]) * amount,
      from[2] + (to[2] - from[2]) * amount
    ];
  }

  function drawRigging(network) {
    p.stroke(RIGGING[0], RIGGING[1], RIGGING[2], 58);
    p.strokeWeight(1.4);
    network.anchors.forEach((anchor, index) => {
      p.line(network.bobs[index].x, network.bobs[index].y, anchor.x, anchor.y);
    });
    network.bobs.forEach((bob, index) => {
      const next = network.bobs[(index + 1) % network.bobs.length];
      p.line(bob.x, bob.y, next.x, next.y);
    });
    p.noStroke();
    p.rectMode(p.CENTER);
    p.fill(STAKE[0], STAKE[1], STAKE[2], 180);
    for (const anchor of network.anchors) {
      p.rect(anchor.x, anchor.y, STAKE_SIZE, STAKE_SIZE);
    }
  }

  /**
   * A bob is a star lit by its own share of the system's energy: halo and core grow
   * with the level, and the colour says which form the energy is in — amber while it
   * is strain in the springs, ice-blue while it is motion.
   */
  function drawStars(network) {
    const shares = bobEnergies(network);
    p.blendMode(p.ADD);
    p.noStroke();
    network.bobs.forEach((bob, index) => {
      const share = shares[index];
      const level = glowLevel(share.total);
      const motionShare = share.total > 0 ? share.kinetic / share.total : 0;
      let tint = mix(STRAIN_AMBER, MOTION_ICE, motionShare);
      if (bob.dragging) {
        tint = mix(tint, HELD_ROSE, 0.65);
      }
      const haloRadius = 11 + 46 * level;
      for (let layer = HALO_LAYERS; layer >= 1; layer -= 1) {
        const reach = haloRadius * layer / HALO_LAYERS;
        p.fill(tint[0], tint[1], tint[2], 4 + 20 * level);
        p.circle(bob.x, bob.y, 2 * reach);
      }
      p.fill(tint[0], tint[1], tint[2], 150 + 90 * level);
      p.circle(bob.x, bob.y, 2 * (4.5 + 3 * level));
      p.fill(CORE_WHITE[0], CORE_WHITE[1], CORE_WHITE[2], 130 + 110 * level);
      p.circle(bob.x, bob.y, 2 * (2 + 1.5 * level));
    });
    p.blendMode(p.BLEND);
  }

  function render(network) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...NIGHT);
    drawRigging(network);
    drawStars(network);
    p.pop();

    if (HINT.shown) {
      drawKeyHint(p, HINT_LEGEND, LOGICAL_WIDTH, LOGICAL_HEIGHT, HINT.scale);
    }

    return network;
  }

  function publishState(frameIndex, network) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      bobCount: network.bobs.length,
      totalEnergy: totalEnergy(network),
      dragging: network.bobs.some((bob) => bob.dragging),
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
      // The scenario is replayed from rest for every frame, so any index stands alone.
      window.__renderFrame = (frameIndex) => {
        const steps = frameIndex * STEPS_PER_FRAME;
        const network = render(networkAfter(steps, NETWORK_OPTIONS));
        if (INDICATOR) {
          // The scenario already says where the hand is on every step — resting on
          // the bob, easing it out, gone after the release — so the indicator simply
          // draws that, with the ripple on the grab.
          const pointer = scenarioPointer(steps, SCENARIO_START, NETWORK_OPTIONS.dragTarget);
          if (pointer) {
            p.push();
            p.scale(RENDER_SCALE);
            drawPointerIndicator(p, pointer.x, pointer.y, LOGICAL_WIDTH, LOGICAL_HEIGHT, {
              pressed: steps > REST_STEPS && steps <= RELEASE_STEP + 1,
              ripple: ripplePhase((steps - REST_STEPS) / STEPS_PER_FRAME)
            });
            p.pop();
          }
        }
        return Promise.resolve(publishState(frameIndex, network));
      };
    }
    publishState(0, render(liveNetwork));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const pointer = { x: p.mouseX, y: p.mouseY };
    for (let index = 0; index < STEPS_PER_FRAME; index += 1) {
      step(liveNetwork, pointer);
    }
    publishState(p.frameCount, render(liveNetwork));
  };

  p.mousePressed = () => {
    grab(liveNetwork, { x: p.mouseX, y: p.mouseY });
    return true;
  };

  p.mouseReleased = () => {
    release(liveNetwork);
    return true;
  };
});
