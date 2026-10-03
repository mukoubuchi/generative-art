import {
  LOGICAL_SIZE, PLAYBACK_FPS, DURATION_SECONDS, TOTAL_FRAMES,
  BRIDGES, EXTENDED_BRIDGES, EYELETS, THREADS, SOLO_INDICES, BRIDGE_PATHS, GOLD_THREADS,
  clamp, pageFrame, pointAt, sceneAt, soloOpacity
} from "./network.js";

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10)) : 1;
const OUTPUT_SIZE = LOGICAL_SIZE * RENDER_SCALE;
const GROUND = "#081317";
const SILVER = [178, 205, 202];
const GOLD = [237, 154, 81];

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

  function light(position, colour, strength = 1, radius = 8) {
    const glow = ctx.createRadialGradient(position.x, position.y, 0, position.x, position.y, radius);
    glow.addColorStop(0, `rgba(255,246,219,${0.95 * strength})`);
    glow.addColorStop(0.13, `rgba(${colour},${0.75 * strength})`);
    glow.addColorStop(0.4, `rgba(${colour},${0.17 * strength})`);
    glow.addColorStop(1, `rgba(${colour},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(position.x - radius, position.y - radius, 2 * radius, 2 * radius);
  }

  function drawFrame(frameIndex) {
    const scene = sceneAt(frameIndex);
    p.background(GROUND);
    ctx.save();
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // The same seven bridges remain visible even when no traveller has used one.
    BRIDGE_PATHS.forEach((path, edge) => {
      const progress = edge === 7 ? scene.addedBridge : 1;
      strokePath(path, progress, [20, 38, 42], 1, edge === 7 ? 20 : 27);
      strokePath(path, progress, edge === 7 ? GOLD : [78, 106, 111], edge === 7 ? 0.25 : 0.21, 0.7);
    });
    for (const node of EYELETS) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(73,105,109,0.17)";
      ctx.lineWidth = 19;
      ctx.stroke();
      ctx.strokeStyle = "rgba(116,147,147,0.22)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    THREADS.forEach(({ path, lane }, index) => {
      const progress = scene.threadProgress[index];
      const strength = 0.16 + 0.28 * (lane + 1) / 2;
      strokePath(path, progress, SILVER, strength * scene.historyOpacity, 0.4);
      if (progress > 0 && progress < 1) light(pointAt(path, path.length * progress), SILVER, 0.48, 4);
    });
    SOLO_INDICES.forEach((index, solo) => {
      const progress = scene.threadProgress[index];
      const age = scene.seconds - (solo ? 6 : 0.5);
      const opacity = soloOpacity(scene.seconds);
      strokePath(THREADS[index].path, progress, SILVER, opacity * 0.82, 1.15);
      if (progress > 0) light(pointAt(THREADS[index].path, THREADS[index].path.length * progress), SILVER,
        opacity * Math.exp(-Math.max(0, age - 3.8) * 0.45), 13);
    });

    if (scene.crossing > 0) {
      for (let i = 0; i < GOLD_THREADS.length; i += 1) {
        const path = GOLD_THREADS[i];
        strokePath(path, scene.crossing, GOLD, 0.2 + 0.48 * Math.sin(Math.PI * i / (GOLD_THREADS.length - 1)), 0.48);
      }
      const heart = GOLD_THREADS[16];
      strokePath(heart, scene.crossing, [255, 221, 165], 0.8, 0.75);
      if (scene.crossing < 1) light(pointAt(heart, scene.crossing * heart.length), GOLD, 1, 19);
      else {
        light(heart.points[0], GOLD, 0.7, 12);
        light(heart.points.at(-1), GOLD, 0.85, 15);
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
