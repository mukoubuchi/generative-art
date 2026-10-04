import {
  LOGICAL_SIZE, PLAYBACK_FPS, DURATION_SECONDS, TOTAL_FRAMES,
  BRIDGES, EXTENDED_BRIDGES, EYELETS, THREADS, SOLO_INDICES, BRIDGE_PATHS, GOLD_THREADS,
  clamp, pageFrame, pointAt, sceneAt, soloOpacity
} from "./network.js";

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10)) : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;
/**
 * The palette of the dark, lit works -- All on One Circumference, Troubling of a Star, The
 * Love That Moves: their night, bone hairlines, the steel family for the walks that fail and
 * the gold family for the one that goes through.
 */
const GROUND = [6, 7, 12];
const BED = [16, 18, 28];
const BONE = [246, 244, 236];
const STEEL_FACE = [104, 144, 204];
const STEEL_EDGE = [156, 192, 240];
const GOLD_FACE = [222, 166, 96];
const GOLD_EDGE = [252, 204, 116];
const HEART_WHITE = [248, 250, 255];

new window.p5((p) => {
  let startedAt;
  let ctx;

  function strokePath(path, progress, colour, alpha, weight) {
    if (progress <= 0 || alpha <= 0) return;
    const end = pointAt(path, path.length * clamp(progress));
    ctx.strokeStyle = `rgba(${colour[0]},${colour[1]},${colour[2]},${alpha})`;
    ctx.lineWidth = weight;
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < end.index; i += 1) ctx.lineTo(path.points[i].x, path.points[i].y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  /**
   * A travelling light, drawn as Troubling of a Star lights its bobs: six halo layers added
   * to what lies beneath, a core in the family's colour, a white heart. Level 0.5 is the
   * brightness that work and All on One Circumference use for their bodies.
   */
  function star(position, tint, level, alpha = 1) {
    if (alpha <= 0) return;
    const halo = (11 + 46 * level) / 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let layer = 6; layer >= 1; layer -= 1) {
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(4 + 20 * level) * alpha / 255})`;
      ctx.beginPath(); ctx.arc(position.x, position.y, halo * layer / 6, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(150 + 90 * level) * alpha / 255})`;
    ctx.beginPath(); ctx.arc(position.x, position.y, 3 + 2 * level, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = `rgba(${HEART_WHITE[0]},${HEART_WHITE[1]},${HEART_WHITE[2]},${(130 + 110 * level) * alpha / 255})`;
    ctx.beginPath(); ctx.arc(position.x, position.y, 1.5 + level, 0, 2 * Math.PI); ctx.fill();
    ctx.restore();
  }

  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    p.background(...GROUND);
    ctx.save();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // The same seven bridges remain visible even when no traveller has used one.
    BRIDGE_PATHS.forEach((path, edge) => {
      const progress = edge === 7 ? scene.addedBridge : 1;
      strokePath(path, progress, BED, 1, edge === 7 ? 20 : 27);
      strokePath(path, progress, edge === 7 ? GOLD_EDGE : BONE, edge === 7 ? 0.5 : 0.3, 0.7);
    });
    for (const node of EYELETS) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(${BED[0]},${BED[1]},${BED[2]},1)`;
      ctx.lineWidth = 19;
      ctx.stroke();
      ctx.strokeStyle = `rgba(${BONE[0]},${BONE[1]},${BONE[2]},0.3)`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }

    // The failed walks are added rather than painted, so a bridge that more of them cross is
    // brighter: the light on a bridge is a count of the walks that used it. When the gold
    // crossing begins they dim with the scene's history, to 0.55 of their light where the
    // history goes to 0.29, so the cloth they make stays on the page under the passage.
    ctx.globalCompositeOperation = "lighter";
    THREADS.forEach(({ path }, index) => {
      const progress = scene.threadProgress[index];
      const history = 1 - 0.45 * (1 - scene.historyOpacity) / 0.71;
      strokePath(path, progress, STEEL_FACE, 0.22 * history, 0.7);
    });
    ctx.globalCompositeOperation = "source-over";
    THREADS.forEach(({ path }, index) => {
      const progress = scene.threadProgress[index];
      if (progress > 0 && progress < 1) star(pointAt(path, path.length * progress), STEEL_EDGE, 0.1, 0.8);
    });
    SOLO_INDICES.forEach((index, solo) => {
      const progress = scene.threadProgress[index];
      const age = scene.seconds - (solo ? 6 : 0.5);
      const opacity = soloOpacity(scene.seconds);
      strokePath(THREADS[index].path, progress, STEEL_FACE, opacity * 0.9, 1.3);
      if (progress > 0) star(pointAt(THREADS[index].path, THREADS[index].path.length * progress), STEEL_EDGE,
        0.5, opacity * Math.exp(-Math.max(0, age - 3.8) * 0.45));
    });

    if (scene.crossing > 0) {
      for (let i = 0; i < GOLD_THREADS.length; i += 1) {
        const path = GOLD_THREADS[i];
        strokePath(path, scene.crossing, GOLD_FACE, 0.25 + 0.5 * Math.sin(Math.PI * i / (GOLD_THREADS.length - 1)), 0.55);
      }
      const heart = GOLD_THREADS[16];
      strokePath(heart, scene.crossing, GOLD_EDGE, 0.95, 1.3);
      if (scene.crossing < 1) star(pointAt(heart, scene.crossing * heart.length), GOLD_EDGE, 0.5);
      else {
        star(heart.points[0], GOLD_EDGE, 0.5);
        star(heart.points.at(-1), GOLD_EDGE, 0.5);
      }
    }
    ctx.restore();
    return {
      kind: "video", frameIndex: scene.frameIndex, totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS, failedTrailCount: THREADS.length,
      activeBridgeCount: scene.addedBridge === 1 ? EXTENDED_BRIDGES.length : BRIDGES.length,
      addedBridge: scene.addedBridge, crossing: scene.crossing, completed: scene.completed,
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
    if (CAPTURE_MODE) window.__renderFrame = (frameIndex) => Promise.resolve(publishState(drawFrame(frameIndex)));
    publishState(drawFrame(0));
    startedAt = performance.now();
  };
  p.draw = () => {
    if (CAPTURE_MODE) return;
    const frame = pageFrame((performance.now() - startedAt) / 1000);
    publishState(drawFrame(frame));
    // The performance ends on the open passage and holds it there.
    if (frame === TOTAL_FRAMES - 1) p.noLoop();
  };
});
