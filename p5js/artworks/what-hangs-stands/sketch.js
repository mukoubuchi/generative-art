import {
  DURATION_SECONDS,
  HALF_SPAN,
  PLAYBACK_FPS,
  SPAN,
  TOTAL_FRAMES,
  archShareAt,
  hangingNodes,
  jointLoads,
  reflectedNodes,
  reflectionProgressAt
} from "./funicular.js";

/**
 * A hanging chain and its reflected arch carry the same loads by opposite internal forces.
 *
 * The animation never interpolates through shapes that would make a false equilibrium
 * claim. Both exact funicular polygons remain fixed while a travelling frontier changes
 * which one is brought into the light: tension below the springing line, compression above.
 */
const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 640;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const CENTRE_X = LOGICAL_WIDTH / 2;
const SPRINGING_Y = LOGICAL_HEIGHT / 2;

const BACKGROUND = [10, 15, 24];
const AXIS = [83, 96, 112];
const CHAIN = [238, 173, 79];
/**
 * The arch in the steel of the dark, lit works (All on One Circumference's STEEL_EDGE), with
 * the white heart their stars carry drawn along it and a halo added under the part of it
 * that already stands.
 */
const ARCH = [156, 192, 240];
const HEART = [248, 250, 255];
/**
 * The chain lit the same way while it hangs: its own gold under the same halo, and a heart
 * line in the gold edge the dark works' stars carry (All on One Circumference's GOLD_EDGE).
 */
const CHAIN_HEART = [252, 204, 116];
const STONE = [181, 196, 202];
const LOAD = [226, 96, 79];

const HANGING = hangingNodes();
const ARCH_NODES = reflectedNodes(HANGING);
const LOADS = jointLoads(HANGING);
const MAX_LOAD = Math.max(...LOADS.map(({ load }) => load));

const P5 = window.p5;

new P5((p) => {
  let frontLayer;

  function canvasPoint(node) {
    return { x: CENTRE_X + node.x, y: SPRINGING_Y + node.y };
  }

  function drawBackdrop() {
    p.background(...BACKGROUND);
    p.noFill();
    p.stroke(...AXIS, 85);
    p.strokeWeight(1);
    p.line(CENTRE_X - HALF_SPAN - 30, SPRINGING_Y, CENTRE_X + HALF_SPAN + 30, SPRINGING_Y);

    for (const side of [-1, 1]) {
      const x = CENTRE_X + side * HALF_SPAN;
      p.stroke(...STONE, 155);
      p.strokeWeight(2);
      p.line(x, SPRINGING_Y, x + side * 34, SPRINGING_Y + 38);
      p.line(x + side * 34, SPRINGING_Y + 38, x - side * 8, SPRINGING_Y + 38);
      p.line(x - side * 8, SPRINGING_Y + 38, x, SPRINGING_Y);
      p.stroke(...STONE, 75);
      for (let offset = -12; offset <= 36; offset += 12) {
        p.line(x + side * 40, SPRINGING_Y + offset, x + side * 62, SPRINGING_Y + offset);
      }
    }
  }

  function drawMember(from, to, colour, alpha, weight) {
    const a = canvasPoint(from);
    const b = canvasPoint(to);
    p.stroke(...colour, alpha);
    p.strokeWeight(weight);
    p.line(a.x, a.y, b.x, b.y);
  }

  /** The halo's two passes, alpha and width: a wide faint one and a nearer one. */
  const HALO_PASSES = [[26, 26], [52, 14]];

  /** The standing run of a structure as polylines, one per unbroken stretch of segments. */
  function runPaths(target, nodes, run) {
    let open = false;
    run.forEach((index, at) => {
      if (!open) { target.beginShape(); const a = canvasPoint(nodes[index]); target.vertex(a.x, a.y); open = true; }
      const b = canvasPoint(nodes[index + 1]); target.vertex(b.x, b.y);
      if (at === run.length - 1 || run[at + 1] !== index + 1) { target.endShape(); open = false; }
    });
  }

  /**
   * The halo along a structure, added to what lies beneath. The run that stands fully lit
   * is haloed as one path, so its passes do not pile up into beads at its joints. The
   * segments at the frontier, each lit by its share, are drawn into a layer of their own
   * where overlapping strokes keep the brighter and do not add, the standing run's halo is
   * cut out of that layer, and the layer is added once: so nothing at the frontier can be
   * brighter than the standing halo beside it.
   */
  function drawHalo(nodes, colour, shareOf) {
    const run = [];
    const front = [];
    for (let index = 0; index < nodes.length - 1; index += 1) {
      const share = shareOf(index);
      if (share >= 0.999) run.push(index);
      else if (share > 0) front.push([index, share]);
    }
    for (const [alpha, weight] of HALO_PASSES) {
      p.blendMode(p.ADD);
      p.noFill();
      p.stroke(...colour, alpha);
      p.strokeWeight(weight);
      runPaths(p, nodes, run);
      p.blendMode(p.BLEND);
      if (front.length === 0) continue;
      frontLayer.push();
      frontLayer.background(0);
      frontLayer.scale(RENDER_SCALE);
      frontLayer.noFill();
      frontLayer.strokeWeight(weight);
      frontLayer.blendMode(frontLayer.LIGHTEST);
      for (const [index, share] of front) {
        // What the stroke would have added, as an opaque colour, so that keeping the
        // brighter of two is the same as adding the larger of them.
        frontLayer.stroke(...colour.map((part) => part * alpha * share / 255));
        const a = canvasPoint(nodes[index]);
        const b = canvasPoint(nodes[index + 1]);
        frontLayer.line(a.x, a.y, b.x, b.y);
      }
      frontLayer.blendMode(frontLayer.BLEND);
      frontLayer.stroke(0);
      runPaths(frontLayer, nodes, run);
      frontLayer.pop();
      p.blendMode(p.ADD);
      p.image(frontLayer, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      p.blendMode(p.BLEND);
    }
  }

  function drawStructures(frameIndex) {
    const archShareOf = (index) => archShareAt((HANGING[index].x + HANGING[index + 1].x) / 2, frameIndex);
    drawHalo(HANGING, CHAIN, (index) => 1 - archShareOf(index));
    drawHalo(ARCH_NODES, ARCH, archShareOf);
    for (let index = 0; index < HANGING.length - 1; index += 1) {
      const middleX = (HANGING[index].x + HANGING[index + 1].x) / 2;
      const archShare = archShareAt(middleX, frameIndex);
      const chainShare = 1 - archShare;
      drawMember(HANGING[index], HANGING[index + 1], CHAIN, 32 + 223 * chainShare, 2.8);
      drawMember(ARCH_NODES[index], ARCH_NODES[index + 1], ARCH, 32 + 223 * archShare, 7.5);
    }

    for (let index = 1; index < HANGING.length - 1; index += 1) {
      const archShare = archShareAt(HANGING[index].x, frameIndex);
      const chainShare = 1 - archShare;
      const lower = canvasPoint(HANGING[index]);
      const upper = canvasPoint(ARCH_NODES[index]);

      if (index % 3 === 0) {
        p.stroke(...AXIS, 18 + 58 * Math.min(archShare, chainShare) * 2);
        p.strokeWeight(1);
        p.line(lower.x, lower.y, upper.x, upper.y);
      }

      p.noStroke();
      p.fill(...CHAIN, 45 + 210 * chainShare);
      p.circle(lower.x, lower.y, 7);
      p.fill(...ARCH, 45 + 210 * archShare);
      p.circle(upper.x, upper.y, 5.5);
    }

    // The heart lines go over the joints, so each reads as one line.
    for (let index = 0; index < HANGING.length - 1; index += 1) {
      const middleX = (HANGING[index].x + HANGING[index + 1].x) / 2;
      const archShare = archShareAt(middleX, frameIndex);
      drawMember(ARCH_NODES[index], ARCH_NODES[index + 1], HEART, 40 + 215 * archShare, 1.8);
      drawMember(HANGING[index], HANGING[index + 1], CHAIN_HEART, 40 + 215 * (1 - archShare), 1.8);
    }
  }

  function drawArrow(x, y, length, alpha) {
    p.stroke(...LOAD, alpha);
    p.strokeWeight(1.5);
    p.line(x, y, x, y + length);
    p.line(x, y + length, x - 4, y + length - 7);
    p.line(x, y + length, x + 4, y + length - 7);
  }

  function drawLoads(frameIndex) {
    for (const { index, load } of LOADS) {
      if (index % 2 === 0) {
        continue;
      }
      const archShare = archShareAt(HANGING[index].x, frameIndex);
      const length = 14 + 22 * (load / MAX_LOAD);
      const chain = canvasPoint(HANGING[index]);
      const arch = canvasPoint(ARCH_NODES[index]);
      drawArrow(chain.x, chain.y + 7, length, 35 + 180 * (1 - archShare));
      drawArrow(arch.x, arch.y + 7, length, 35 + 180 * archShare);
    }
  }

  function drawFrontier(frameIndex) {
    const progress = reflectionProgressAt(frameIndex);
    if (progress <= 0 || progress >= 1) {
      return;
    }
    const x = CENTRE_X - HALF_SPAN + SPAN * progress;
    const pulse = 0.5 + 0.5 * Math.cos((frameIndex / TOTAL_FRAMES) * Math.PI * 12);
    p.stroke(224, 235, 232, 70 + 70 * pulse);
    p.strokeWeight(1);
    p.line(x, SPRINGING_Y - 204, x, SPRINGING_Y + 204);
    p.noFill();
    p.strokeWeight(2);
    p.circle(x, SPRINGING_Y, 10 + 8 * pulse);
  }

  function drawFrame(frameIndex) {
    p.push();
    p.scale(RENDER_SCALE);
    drawBackdrop();
    drawStructures(frameIndex);
    drawLoads(frameIndex);
    drawFrontier(frameIndex);
    p.pop();
  }

  function publishState(frameIndex) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      reflectionProgress: reflectionProgressAt(frameIndex),
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    // The frontier's halo layer, at the canvas's own size and density. It is drawn from,
    // never shown, so it is taken out of the page: the page holds the artwork's one canvas.
    frontLayer = p.createGraphics(OUTPUT_WIDTH, OUTPUT_HEIGHT);
    frontLayer.pixelDensity(p.pixelDensity());
    frontLayer.elt.remove();
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) => {
        drawFrame(frameIndex);
        return Promise.resolve(publishState(frameIndex));
      };
    }
    drawFrame(0);
    publishState(0);
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    drawFrame(frameIndex);
    publishState(frameIndex);
  };
});
