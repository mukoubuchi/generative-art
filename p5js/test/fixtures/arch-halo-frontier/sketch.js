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
} from "../../../artworks/what-hangs-stands/funicular.js";

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
const STONE = [181, 196, 202];
const LOAD = [226, 96, 79];

const HANGING = hangingNodes();
const ARCH_NODES = reflectedNodes(HANGING);
const LOADS = jointLoads(HANGING);
const MAX_LOAD = Math.max(...LOADS.map(({ load }) => load));

const P5 = window.p5;

new P5((p) => {
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

  /**
   * The halo under the arch, added to what lies beneath. The run of the arch that already
   * stands is haloed as one path, so the two passes do not pile up into beads at its joints;
   * a segment still at the front, part chain and part arch, is added on its own below.
   */
  function drawArchHalo(frameIndex) {
    const lit = [];
    for (let index = 0; index < HANGING.length - 1; index += 1) {
      const middleX = (HANGING[index].x + HANGING[index + 1].x) / 2;
      if (archShareAt(middleX, frameIndex) >= 0.999) lit.push(index);
    }
    p.blendMode(p.ADD);
    p.noFill();
    for (const [alpha, weight] of [[26, 26], [52, 14]]) {
      p.stroke(...ARCH, alpha);
      p.strokeWeight(weight);
      let open = false;
      lit.forEach((index, at) => {
        if (!open) { p.beginShape(); const a = canvasPoint(ARCH_NODES[index]); p.vertex(a.x, a.y); open = true; }
        const b = canvasPoint(ARCH_NODES[index + 1]); p.vertex(b.x, b.y);
        if (at === lit.length - 1 || lit[at + 1] !== index + 1) { p.endShape(); open = false; }
      });
    }
    p.blendMode(p.BLEND);
  }

  function drawStructures(frameIndex) {
    drawArchHalo(frameIndex);
    for (let index = 0; index < HANGING.length - 1; index += 1) {
      const middleX = (HANGING[index].x + HANGING[index + 1].x) / 2;
      const archShare = archShareAt(middleX, frameIndex);
      const chainShare = 1 - archShare;
      drawMember(HANGING[index], HANGING[index + 1], CHAIN, 32 + 223 * chainShare, 2.8);
      if (archShare < 0.999) {
        p.blendMode(p.ADD);
        drawMember(ARCH_NODES[index], ARCH_NODES[index + 1], ARCH, 26 * archShare, 26);
        drawMember(ARCH_NODES[index], ARCH_NODES[index + 1], ARCH, 52 * archShare, 14);
        p.blendMode(p.BLEND);
      }
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

    // The arch's white heart line goes over its joints, so it reads as one line.
    for (let index = 0; index < HANGING.length - 1; index += 1) {
      const middleX = (HANGING[index].x + HANGING[index + 1].x) / 2;
      const archShare = archShareAt(middleX, frameIndex);
      drawMember(ARCH_NODES[index], ARCH_NODES[index + 1], HEART, 40 + 215 * archShare, 1.8);
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
