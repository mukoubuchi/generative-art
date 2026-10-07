import {
  ACT_ONE_FRAMES, LOGICAL_SIZE, PLAYBACK_FPS, DURATION_SECONDS, TOTAL_FRAMES, NODE_COUNT, LINK_COUNT,
  WORLD, HISTORY, pageFrame, sceneAt
} from "./world.js";

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10)) : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;

/**
 * The palette of the dark, lit works -- All on One Circumference, The Love That Moves,
 * No Such Passage: their night, bone hairlines for the links, and the steel and gold
 * families as the two opinions, each node a light drawn as those works draw theirs.
 */
const GROUND = [6, 7, 12];
const BONE = [246, 244, 236];
const STEEL_FACE = [104, 144, 204];
const STEEL_EDGE = [156, 192, 240];
const GOLD_FACE = [222, 166, 96];
const GOLD_EDGE = [252, 204, 116];
const HEART_WHITE = [248, 250, 255];
/** Opinion 0 is steel, opinion 1 is gold. */
const INKS = [
  { face: STEEL_FACE, edge: STEEL_EDGE },
  { face: GOLD_FACE, edge: GOLD_EDGE }
];
const rgba = ([r, g, b], alpha) => `rgba(${r},${g},${b},${alpha})`;

/**
 * The light of a node that keeps its mind, and the brighter light of one that has just
 * changed it; radii in logical pixels, alphas per halo layer.
 */
const STEADY = { halo: 9, haloAlpha: 0.055, core: 2.1, coreAlpha: 0.9, heart: 1.0, heartAlpha: 0.65 };
const FLASH = { halo: 13, haloAlpha: 0.11, core: 3.0, coreAlpha: 1, heart: 1.6, heartAlpha: 0.95 };
/** How many frames a change of mind stays visible as a flash. */
const PULSE_FRAMES = 12;
/** A heard link stays lit for this many frames, fading, so the recent voices leave a web. */
const TRAIL_FRAMES = 8;
/** The alpha of the link a node heard on this very frame; the trail behind it is dimmer. */
const HEARD_ALPHA = 0.42;

new window.p5((p) => {
  let startedAt;
  let ctx;
  let sprites;
  let flashes;

  /**
   * One node's light, drawn once per ink into an offscreen canvas at the device's density and
   * stamped from there: six halo layers added to what lies beneath, a core in the family's
   * colour and a white heart, as Troubling of a Star lights its bobs and All on One
   * Circumference its bodies, at the small size a world of hundreds asks for.
   */
  function makeSprite(ink, light, density) {
    const half = Math.ceil(light.halo) + 1;
    const size = Math.ceil(2 * half * density);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const c = canvas.getContext("2d");
    c.scale(density, density);
    c.globalCompositeOperation = "lighter";
    for (let layer = 6; layer >= 1; layer -= 1) {
      c.fillStyle = rgba(ink.face, light.haloAlpha);
      c.beginPath(); c.arc(half, half, light.halo * layer / 6, 0, 2 * Math.PI); c.fill();
    }
    c.fillStyle = rgba(ink.edge, light.coreAlpha);
    c.beginPath(); c.arc(half, half, light.core, 0, 2 * Math.PI); c.fill();
    c.fillStyle = rgba(HEART_WHITE, light.heartAlpha);
    c.beginPath(); c.arc(half, half, light.heart, 0, 2 * Math.PI); c.fill();
    return { canvas, half };
  }

  /** Every link of the world in one stroke: the bed, or act one's lit net. */
  function strokeLinks(colour, alpha, width) {
    ctx.strokeStyle = rgba(colour, alpha);
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [a, b] of WORLD.links) {
      ctx.moveTo(WORLD.nodes[a].x, WORLD.nodes[a].y);
      ctx.lineTo(WORLD.nodes[b].x, WORLD.nodes[b].y);
    }
    ctx.stroke();
  }

  /**
   * The links heard at one frame, lit in the speaker's ink from speaker to listener; the
   * ink is the speaker's as it stood when it spoke, and the alpha is the caller's.
   */
  function strokeHeardAt(frame, alpha, width) {
    const state = HISTORY.states[frame];
    const heard = HISTORY.heard[frame];
    for (let ink = 0; ink < 2; ink += 1) {
      ctx.strokeStyle = rgba(INKS[ink].edge, alpha);
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i < NODE_COUNT; i += 1) {
        const speaker = heard[i];
        if (state[speaker] !== ink) continue;
        ctx.moveTo(WORLD.nodes[speaker].x, WORLD.nodes[speaker].y);
        ctx.lineTo(WORLD.nodes[i].x, WORLD.nodes[i].y);
      }
      ctx.stroke();
    }
  }

  /**
   * Act two: the one link each node heard, with the links heard over the frames before it
   * fading behind -- older first, so the newest voice lies on top.
   */
  function strokeHeard(scene) {
    for (let back = TRAIL_FRAMES - 1; back >= 1; back -= 1) {
      const frame = scene.frameIndex - back;
      if (frame < ACT_ONE_FRAMES) continue;
      strokeHeardAt(frame, HEARD_ALPHA * 0.55 * (1 - back / TRAIL_FRAMES), 0.7);
    }
    strokeHeardAt(scene.frameIndex, HEARD_ALPHA, 0.9);
  }

  function drawNodes(scene) {
    const { state, pulse } = scene;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const { x, y } = WORLD.nodes[i];
      const sprite = sprites[state[i]];
      ctx.drawImage(sprite.canvas, x - sprite.half, y - sprite.half, 2 * sprite.half, 2 * sprite.half);
    }
    // A change of mind flashes in the new ink and fades over PULSE_FRAMES frames.
    for (let i = 0; i < NODE_COUNT; i += 1) {
      const age = pulse[i];
      if (age >= PULSE_FRAMES) continue;
      const { x, y } = WORLD.nodes[i];
      ctx.globalAlpha = 1 - age / PULSE_FRAMES;
      const flash = flashes[state[i]];
      ctx.drawImage(flash.canvas, x - flash.half, y - flash.half, 2 * flash.half, 2 * flash.half);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    p.background(...GROUND);
    ctx.save();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.lineCap = "round";
    // The whole net, faint, so the links that are not heard are still there to be seen.
    strokeLinks(BONE, 0.07, 0.6);
    if (scene.act === 1) {
      // Exact hearing: every link carries a voice, so every link is lit.
      strokeLinks(BONE, 0.26, 0.8);
    } else {
      strokeHeard(scene);
    }
    drawNodes(scene);
    ctx.restore();
    return {
      kind: "video", frameIndex: scene.frameIndex, totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS, act: scene.act, step: scene.step, sweeps: scene.sweeps,
      unanimous: scene.unanimous, nodeCount: NODE_COUNT, linkCount: LINK_COUNT,
      consensusSweep: HISTORY.consensusSweep, landingFrame: HISTORY.landingFrame,
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
    const density = p.pixelDensity() * RENDER_SCALE;
    sprites = INKS.map((ink) => makeSprite(ink, STEADY, density));
    flashes = INKS.map((ink) => makeSprite(ink, FLASH, density));
    if (CAPTURE_MODE) window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    publishState(drawFrame(0));
    startedAt = performance.now();
  };
  p.draw = () => {
    if (CAPTURE_MODE) return;
    const frame = pageFrame((performance.now() - startedAt) / 1000);
    publishState(drawFrame(frame));
    // The performance ends on the agreement and holds it there.
    if (frame === TOTAL_FRAMES - 1) p.noLoop();
  };
});
