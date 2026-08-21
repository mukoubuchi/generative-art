import {
  FINEST_IN_OUTER_RADII,
  buildPacking,
  radiusOf
} from "./apollonian-gasket.js";

/**
 * Every gap between three touching circles holds exactly one more, and where it goes was
 * settled by the three around it. The figure is drawn as the equation gives it: no circle
 * here was placed, fitted or chosen.
 */
const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const OUTER_RADIUS = 306;

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

/**
 * Paper and one ink. The hierarchy is carried by the width of the line alone: a circle is
 * drawn at a weight that falls with its bend, so the first four hold the page and the
 * three hundredth is a hairline, and no second colour is asked to say what the sizes
 * already say.
 */
const PAPER = [230, 224, 208];
const INK = [38, 34, 40];

const CIRCLES = buildPacking();
/** The packing is built in its own units; this puts its outer circle on the page. */
const OUTER = CIRCLES.find((circle) => circle.bend < 0);
const UNITS_TO_PAGE = OUTER_RADIUS / radiusOf(OUTER);

const P5 = window.p5;

new P5((p) => {
  /**
   * The line a circle is drawn with, from how large it is drawn. Weight falls as a low
   * power of the radius, which is slow enough that the largest circles are plainly
   * heavier and shallow enough that the smallest are still a line rather than a smudge.
   * Nothing here reads the bend: the pen answers to the picture, so the hierarchy on the
   * page is the hierarchy of sizes and not a second thing laid over it.
   */
  function penFor(radiusOnPage) {
    const share = radiusOnPage / OUTER_RADIUS;
    const weight = Math.max(0.45, 2.6 * Math.pow(share, 0.28));
    const alpha = 150 + 85 * Math.pow(share, 0.25);
    return { weight, alpha };
  }

  function drawAll() {
    p.background(...PAPER);
    p.push();
    p.scale(RENDER_SCALE);
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
    p.noFill();
    for (const circle of CIRCLES) {
      const radiusOnPage = radiusOf(circle) * UNITS_TO_PAGE;
      const { weight, alpha } = penFor(radiusOnPage);
      p.stroke(...INK, alpha);
      p.strokeWeight(weight);
      p.circle(circle.x * UNITS_TO_PAGE, circle.y * UNITS_TO_PAGE, 2 * radiusOnPage);
    }
    p.pop();
  }

  function publishState() {
    const state = {
      kind: "image",
      circles: CIRCLES.length,
      finestInOuterRadii: FINEST_IN_OUTER_RADII,
      smallestRadius: OUTER_RADIUS * FINEST_IN_OUTER_RADII,
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
    drawAll();
    publishState();
    p.noLoop();
  };
});
