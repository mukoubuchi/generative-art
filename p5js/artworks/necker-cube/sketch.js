import {
  BREAK_SHARE,
  EDGES,
  STEPS_PER_SECOND,
  TOTAL_STEPS,
  VIEW_TURNS,
  declarationAt,
  hiddenEdges,
  shadowAt
} from "./cube.js";

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PLAYBACK_FPS = 30;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
const HALF_EDGE = BASE_DIMENSION * 0.23;
const STROKE_WEIGHT = BASE_DIMENSION * (2.6 / 600);
const STEPS_PER_FRAME = STEPS_PER_SECOND / PLAYBACK_FPS;
const TOTAL_FRAMES = TOTAL_STEPS / STEPS_PER_FRAME;

/** Paper and ink, as the gallery's other classical illusion is drawn. */
const PAPER = [226, 220, 206];
const INK = [22, 20, 26];

/** The corners of the figure, which never move: it is one drawing for the whole clip. */
const CORNERS = shadowAt(VIEW_TURNS, HALF_EDGE);

const P5 = window.p5;

new P5((p) => {
  /**
   * Twelve lines, one weight, one ink. Nothing here turns, nothing is shaded, and nothing
   * answers to the reader — a Necker cube reverses in the person looking at it, and any
   * of those would do the reversing for them.
   *
   * What happens instead is that three of the twelve are interrupted at one end and then
   * healed. They are the three that meet the corner a reading puts furthest away, which a
   * cube of wood would hide, and they are the only thing in the drawing the two readings
   * disagree about. So the figure is ambiguous, then it is not, then it is again, then it
   * is not the other way, and the only thing that ever changes is where the lines stop.
   */
  function drawStep(declaration) {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...PAPER);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.stroke(...INK);
    p.strokeWeight(STROKE_WEIGHT);
    p.strokeCap(p.ROUND);

    const broken = declaration.reading === 0
      ? []
      : hiddenEdges(declaration.reading, VIEW_TURNS, HALF_EDGE);
    const far = broken.length === 0
      ? -1
      : EDGES[broken[0]].find((corner) => EDGES[broken[1]].includes(corner));
    const share = BREAK_SHARE * declaration.amount;

    EDGES.forEach(([from, to], index) => {
      const start = CORNERS[from];
      const end = CORNERS[to];
      if (!broken.includes(index) || share <= 0) {
        p.line(start.x, start.y, end.x, end.y);
        return;
      }
      // Cut from the far end inwards, so the corner the reading pushes back is the one
      // left with nothing meeting it.
      const [near, hidden] = from === far ? [end, start] : [start, end];
      p.line(
        near.x,
        near.y,
        near.x + (hidden.x - near.x) * (1 - share),
        near.y + (hidden.y - near.y) * (1 - share)
      );
    });
    p.pop();

    return { broken, far };
  }

  function publishState(frameIndex, declaration, drawn) {
    const publishedState = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      turns: VIEW_TURNS,
      reading: declaration.reading,
      declared: declaration.amount,
      brokenEdges: drawn.broken,
      farCorner: drawn.far,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = publishedState;
    window.__ARTWORK_READY__ = true;
    return publishedState;
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
      // Every frame is a pure function of its index: the figure does not move, and the
      // declarations follow the plan, so any frame can be drawn on its own.
      window.__renderFrame = (frameIndex) => {
        const declaration = declarationAt(frameIndex * STEPS_PER_FRAME);
        return Promise.resolve(publishState(frameIndex, declaration, drawStep(declaration)));
      };
    }
    publishState(0, declarationAt(0), drawStep(declarationAt(0)));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    // The page runs the same plan the clip does. There is nothing to point at.
    const declaration = declarationAt(p.frameCount * STEPS_PER_FRAME);
    publishState(p.frameCount, declaration, drawStep(declaration));
  };
});
