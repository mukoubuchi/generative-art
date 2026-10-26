import {
  WIDTH,
  HEIGHT,
  FPS,
  DURATION,
  FRAMES,
  eyeAt,
  frameAt,
  visibilityAt,
  partitionFieldRings,
  stateAt
} from "./field.js";

const parameters = new URLSearchParams(window.location.search);
const CAPTURE_MODE = parameters.get("capture") === "1";
const scale = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(parameters.get("renderScale") ?? "1", 10))
  : 1;
const outputWidth = WIDTH * scale;
const outputHeight = HEIGHT * scale;

// The established night, steel and gold palette of the geometric light works,
// paired with Troubling of a Star's six-layer orb halo at visibility nodes.
const GROUND = "rgb(6,7,12)";
const STEEL = [104, 144, 204];
const SHEEN = [172, 214, 255];
const GOLD = [252, 204, 116];
const HEART = [248, 250, 255];
const HALO_LAYERS = 6;
const NODE_DEDUP_DIST = 1.5;

function pathFromArcs(arcs) {
  const path = new Path2D();
  for (const arc of arcs) {
    const pts = arc.points;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
  }
  return path;
}

function pathFromSegments(segments, aKey = "a", bKey = "b") {
  const path = new Path2D();
  let lastX = NaN;
  let lastY = NaN;
  for (const seg of segments) {
    const [ax, ay] = seg[aKey];
    const [bx, by] = seg[bKey];
    if (!Number.isFinite(lastX) || Math.hypot(ax - lastX, ay - lastY) > 1e-5) {
      path.moveTo(ax, ay);
    }
    path.lineTo(bx, by);
    lastX = bx;
    lastY = by;
  }
  return path;
}

/**
 * Collect the actual geometric junctions of the visibility field:
 * - nearNodes: grazing obstacle vertices V_j where a lit obstacle arc detaches into an occlusion ray.
 * - farNodes: non-viewport landing points Q_j where an occlusion ray hits a farther obstacle and
 *   splits it into lit and shadowed sub-segments (viewport-edge clipping points are excluded).
 */
function collectVisibilityNodes(visibility) {
  const nearNodes = [];
  const farNodes = [];
  const isNearExisting = (list, pt) =>
    list.some((q) => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < NODE_DEDUP_DIST);

  for (const b of visibility.occlusionBoundaries) {
    if (!isNearExisting(nearNodes, b.nearPoint)) {
      nearNodes.push(b.nearPoint);
    }
  }
  for (const b of visibility.occlusionBoundaries) {
    if (b.farIsViewport) continue;
    if (!isNearExisting(nearNodes, b.farPoint) && !isNearExisting(farNodes, b.farPoint)) {
      farNodes.push(b.farPoint);
    }
  }
  return { nearNodes, farNodes };
}

function fillCircle(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawOrbs(ctx, nodes, haloRadius, veilAlpha, bodyRadius, bodyAlpha, coreRadius, coreAlpha) {
  ctx.fillStyle = `rgba(${GOLD.join(",")},${veilAlpha})`;
  for (let layer = HALO_LAYERS; layer >= 1; layer -= 1) {
    const reach = (haloRadius * layer) / HALO_LAYERS;
    for (const [x, y] of nodes) {
      fillCircle(ctx, x, y, reach);
    }
  }
  ctx.fillStyle = `rgba(${GOLD.join(",")},${bodyAlpha})`;
  for (const [x, y] of nodes) {
    fillCircle(ctx, x, y, bodyRadius);
  }
  ctx.fillStyle = `rgba(${HEART.join(",")},${coreAlpha})`;
  for (const [x, y] of nodes) {
    fillCircle(ctx, x, y, coreRadius);
  }
}

new window.p5((p) => {
  let started;

  function drawFrame(frame) {
    const wrapped = ((frame % FRAMES) + FRAMES) % FRAMES;
    const eye = eyeAt(wrapped);
    const visibility = visibilityAt(eye);
    const { litArcs, shadowArcs } = partitionFieldRings(visibility);
    const { nearNodes, farNodes } = collectVisibilityNodes(visibility);
    const state = stateAt(wrapped, visibility);

    const ctx = p.drawingContext;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    function ink(path, colour, alpha, width) {
      ctx.strokeStyle = `rgba(${colour.join(",")},${alpha})`;
      ctx.lineWidth = width;
      ctx.stroke(path);
    }

    // 1. Fixed background field contours partitioned into shadowed and visible arcs (fine guide lines).
    const shadowRingPath = pathFromArcs(shadowArcs);
    ink(shadowRingPath, STEEL, 0.028, 1.65);
    ink(shadowRingPath, STEEL, 0.16, 0.68);
    ink(shadowRingPath, SHEEN, 0.16, 0.38);
    ink(shadowRingPath, HEART, 0.06, 0.20);

    const litRingPath = pathFromArcs(litArcs);
    ink(litRingPath, STEEL, 0.030, 2.0);
    ink(litRingPath, GOLD, 0.055, 1.35);
    ink(litRingPath, GOLD, 0.32, 0.58);
    ink(litRingPath, HEART, 0.18, 0.26);

    // 2. Occluded obstacle sub-segments in slender steel-blue with a crisp icy sheen.
    const occludedObstaclePath = pathFromSegments(visibility.occludedSegments);
    ink(occludedObstaclePath, STEEL, 0.042, 2.4);
    ink(occludedObstaclePath, STEEL, 0.22, 1.15);
    ink(occludedObstaclePath, SHEEN, 0.46, 0.62);
    ink(occludedObstaclePath, HEART, 0.28, 0.28);

    // 3. Active occlusion boundary rays kept slender so light concentrates at the node orbs.
    const boundaryPath = pathFromSegments(
      visibility.occlusionBoundaries,
      "nearPoint",
      "farPoint"
    );
    ink(boundaryPath, STEEL, 0.026, 3.2);
    ink(boundaryPath, GOLD, 0.050, 1.9);
    ink(boundaryPath, GOLD, 0.16, 1.05);
    ink(boundaryPath, GOLD, 0.50, 0.64);
    ink(boundaryPath, HEART, 0.34, 0.28);

    // 4. Directly visible obstacle sub-segments kept slender to match the smooth blue arcs.
    const litObstaclePath = pathFromSegments(visibility.litSegments);
    ink(litObstaclePath, GOLD, 0.040, 3.6);
    ink(litObstaclePath, GOLD, 0.16, 1.55);
    ink(litObstaclePath, GOLD, 0.54, 0.78);
    ink(litObstaclePath, HEART, 0.44, 0.34);

    // 5. Glowing orbs at actual visibility junctions (modeled on Troubling of a Star's 6-veil stars).
    drawOrbs(ctx, farNodes, 18, 0.048, 4.0, 0.72, 1.9, 0.90);
    drawOrbs(ctx, nearNodes, 24, 0.062, 5.2, 0.82, 2.5, 0.96);

    ctx.restore();

    return {
      kind: "video",
      frameIndex: wrapped,
      totalFrames: FRAMES,
      durationSeconds: DURATION,
      ...state,
      logicalSize: { width: WIDTH, height: HEIGHT },
      outputSize: { width: outputWidth, height: outputHeight }
    };
  }

  function publishState(state) {
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(outputWidth, outputHeight).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(drawFrame(frameIndex)));
    }
    publishState(drawFrame(0));
    started = performance.now();
  };

  p.draw = () => {
    if (!CAPTURE_MODE) {
      publishState(drawFrame(frameAt((performance.now() - started) / 1000)));
    }
  };
});
