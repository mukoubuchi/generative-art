import {
  DISSOLVE_FRAMES,
  HOLD_FRAMES,
  LAY_FRAMES,
  TOTAL_FRAMES,
  arcPoint,
  buildSections,
  sectionCut,
  travelAt
} from "./geometry.js";

const LOGICAL_WIDTH = 1010;
const LOGICAL_HEIGHT = 640;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
const MARGIN = BASE_DIMENSION * 0.03125;
const QUARTER_TURN = Math.PI / 2;

/**
 * Night, the lines that divide, and the gold that travels.
 *
 * Three voices, where there were five. The night is Bounding Spots', because this is the
 * other artwork in the collection made of one small light on a dark ground and they should
 * be standing on the same dark. The dividing lines take that artwork's baseline — the rail
 * its arcs are struck from — since these are the frame these arcs are struck in. The gold
 * is this artwork's own, the colour its rectangles used to gild towards; of the five it is
 * the one left, and now it is the whole subject rather than the end of a gradient.
 */
const GROUND = [6, 7, 12];
const DIVIDE = [70, 82, 110];
const GOLD = [246, 198, 98];

// The tiling is integers -- 987 by 610 units -- scaled to the canvas in one transform.
const sections = buildSections();
const ROOT = sections[0];
const UNIT_SCALE = Math.min(
  (LOGICAL_WIDTH - 2 * MARGIN) / ROOT.width,
  (LOGICAL_HEIGHT - 2 * MARGIN) / ROOT.height
);
const TILING_LEFT = (LOGICAL_WIDTH - ROOT.width * UNIT_SCALE) / 2;
const TILING_TOP = (LOGICAL_HEIGHT - ROOT.height * UNIT_SCALE) / 2;
const LINE_WEIGHT = 1.2 / UNIT_SCALE;
const TRACK_WEIGHT = 1.8 / UNIT_SCALE;

/**
 * How large the travelling mark is drawn, as a share of the arc it is riding, and how
 * small it is allowed to get. Keyed to the arc rather than fixed, so the mark and its arc
 * are the same picture at all fifteen scales — which is the self-similarity, made visible
 * on a canvas that does not move. The floor matters only for the last five arcs, and the
 * mark spends a twentieth of a second on all five of them together.
 */
const MARK_RATIO = 0.022;
const MARK_FLOOR = 2.5;
const HALO_REACH = 2.8;
const HALO_LAYERS = 5;

const P5 = window.p5;

new P5((p) => {
  /**
   * A golden mark drawing the spiral, on a field of the lines that divide it.
   *
   * The rectangles used to be filled, each in a shade of how far its own ratio still stood
   * from phi, and the arcs drawn over them in ivory. Nothing is filled now: a region is
   * shown by what cuts it off from the next one, so the picture is the root's outline and
   * the fourteen cuts inside it, and every cut arrives at the moment the mark finishes
   * going round the square it closes. The mark itself is Bounding Spots' light — an added
   * halo with a core inside it — and what it leaves behind is the spiral.
   *
   * The exact golden rectangle used to be stroked underneath as a skeleton, to stand
   * against the integer tiling's own root. At this size the two are 0.02 of a pixel apart,
   * which is not a comparison but a second copy of the same line, so it is gone. That the
   * root's aspect misses phi by about one part in a million is still true, still measured,
   * and now said in the tests and the readme rather than drawn twice.
   */
  function drawFrame(frameIndex) {
    const laying = Math.min(frameIndex / LAY_FRAMES, 1);
    const travel = travelAt(laying);
    const fade = 1 - Math.max(0, frameIndex - LAY_FRAMES - HOLD_FRAMES) / DISSOLVE_FRAMES;

    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    p.translate(TILING_LEFT, TILING_TOP);
    p.scale(UNIT_SCALE);
    p.noFill();

    // What is being divided, and then the cuts that have been made so far.
    p.stroke(...DIVIDE, 150);
    p.strokeWeight(LINE_WEIGHT);
    p.rect(0, 0, ROOT.width, ROOT.height);
    for (let index = 0; index < travel.index; index += 1) {
      const cut = sectionCut(sections[index]);
      if (cut !== null) {
        p.line(cut.from.x, cut.from.y, cut.to.x, cut.to.y);
      }
    }

    // The track: every arc the mark has finished, and the part of the one it is on.
    p.stroke(...GOLD, 210);
    p.strokeWeight(TRACK_WEIGHT);
    for (let index = 0; index <= travel.index; index += 1) {
      const section = sections[index];
      const along = index < travel.index ? 1 : travel.along;
      if (along <= 0) {
        continue;
      }
      p.push();
      p.translate(section.x, section.y);
      p.rotate(section.rotation);
      p.arc(
        section.height,
        section.height,
        2 * section.height,
        2 * section.height,
        Math.PI,
        Math.PI + QUARTER_TURN * along,
        p.OPEN
      );
      p.pop();
    }

    // The mark, in the units the canvas is measured in rather than the tiling's, so its
    // size follows the arc and not the transform.
    p.pop();
    p.push();
    p.scale(RENDER_SCALE);
    const head = {
      x: TILING_LEFT + travel.point.x * UNIT_SCALE,
      y: TILING_TOP + travel.point.y * UNIT_SCALE
    };
    const size = Math.max(travel.radius * UNIT_SCALE * MARK_RATIO, MARK_FLOOR);
    p.noStroke();
    // The halo is stacked rather than laid on in one go. A single added circle has an edge,
    // and an edge is a disc rather than a glow; several of them, each smaller than the
    // last, add up to something that falls off instead of stopping.
    p.blendMode(p.ADD);
    for (let layer = HALO_LAYERS; layer >= 1; layer -= 1) {
      p.fill(GOLD[0], GOLD[1], GOLD[2], 16);
      p.circle(head.x, head.y, size * HALO_REACH * 2 * (layer / HALO_LAYERS));
    }
    p.blendMode(p.BLEND);
    p.fill(GOLD[0], GOLD[1], GOLD[2], 246);
    p.circle(head.x, head.y, size);

    // Letting go, so the loop returns to the night it opened in.
    if (fade < 1) {
      p.fill(GROUND[0], GROUND[1], GROUND[2], 255 * (1 - fade));
      p.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    p.pop();

    return travel;
  }

  function publishState(frameIndex, travel) {
    window.__ARTWORK_STATE__ = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      sectionCount: sections.length,
      arcsDrawn: travel.index + 1,
      travel: travel.along,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
    return window.__ARTWORK_STATE__;
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
      // Every frame is a pure function of its index, so any one can be drawn on its own.
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
    }
    publishState(0, drawFrame(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawFrame(frameIndex));
  };
});
