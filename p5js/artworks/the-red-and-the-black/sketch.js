import {
  GROUND,
  HAZE_INNER_IN_DISCS,
  HAZE_OUTER_IN_WIDTHS,
  HAZE_STOPS,
  PAINTING_ORDER,
  ROAD_COLOUR,
  UPPER_HALF_DISC
} from "./the-red-and-the-black.js";

/**
 * The figure itself, drawn from the list that defines it: six fills, laid down in order,
 * and no line anywhere. The two roads are a glossy crimson and a lacquer black, and the
 * disc holds nothing else: a third colour inside it would be a third road, and the figure
 * says there is none. The two arcs touch directly, with no band between them.
 *
 * Every light in the picture that falls on the disc is a function of the distance from
 * the centre alone. That is the only lighting a half turn cannot tell from itself, so the
 * exchange of the two roads stays exact in the pixels and not merely in the rule. A
 * highlight thrown from one side would say that one of the two roads is the lit one.
 *
 * Outside the disc is the world: a haze of no colour in particular, gathered about the
 * figure and thinning to nothing before the corners. The disc is the only saturated thing
 * on the page, and there is not one mark in the haze worth looking at on its own.
 *
 * Nothing here is random. The picture is the same picture every time it is drawn, which
 * is what a figure about a state rather than a process ought to be.
 */

const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

const DISC_RADIUS = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) * 0.335;

const P5 = window.p5;

new P5((p) => {
  const centreX = LOGICAL_WIDTH / 2;
  const centreY = LOGICAL_HEIGHT / 2;

  /**
   * The haze, drawn from the stops that define it. Its two circles are about the centre
   * of the disc, so the ground is as radial as the light on the figure is; the world
   * neither favours a side nor gives the picture a direction to be read from.
   */
  function drawHaze() {
    const context = p.drawingContext;
    const haze = context.createRadialGradient(
      centreX,
      centreY,
      DISC_RADIUS * HAZE_INNER_IN_DISCS,
      centreX,
      centreY,
      LOGICAL_WIDTH * HAZE_OUTER_IN_WIDTHS
    );
    for (const { at, colour, alpha } of HAZE_STOPS) {
      haze.addColorStop(at, `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, ${alpha})`);
    }
    context.fillStyle = haze;
    context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  /**
   * The gloss: a ring of sheen and a darkening at the rim, both of them functions of the
   * distance from the centre and of nothing else, and both clipped to the disc so the
   * haze around it stays matte.
   */
  function drawGloss() {
    const context = p.drawingContext;
    context.save();
    context.beginPath();
    context.arc(centreX, centreY, DISC_RADIUS, 0, 2 * Math.PI);
    context.clip();

    // A gentle lift about the centre, so the disc is not a flat cut-out.
    const lift = context.createRadialGradient(
      centreX,
      centreY,
      0,
      centreX,
      centreY,
      DISC_RADIUS * 0.85
    );
    lift.addColorStop(0, "rgba(255, 126, 96, 0.055)");
    lift.addColorStop(1, "rgba(255, 126, 96, 0)");
    context.globalCompositeOperation = "lighter";
    context.fillStyle = lift;
    context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // The rim of a lacquered thing: a shadow gathering just inside the edge, and the
    // edge itself catching the light. Both depend on the radius alone.
    const edge = context.createRadialGradient(
      centreX,
      centreY,
      DISC_RADIUS * 0.7,
      centreX,
      centreY,
      DISC_RADIUS
    );
    edge.addColorStop(0, "rgba(0, 0, 0, 0)");
    edge.addColorStop(0.86, "rgba(0, 0, 0, 0.24)");
    edge.addColorStop(1, "rgba(0, 0, 0, 0.28)");
    context.globalCompositeOperation = "source-over";
    context.fillStyle = edge;
    context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const rimLight = context.createRadialGradient(
      centreX,
      centreY,
      DISC_RADIUS * 0.93,
      centreX,
      centreY,
      DISC_RADIUS
    );
    rimLight.addColorStop(0, "rgba(255, 132, 100, 0)");
    rimLight.addColorStop(0.65, "rgba(255, 138, 106, 0.20)");
    rimLight.addColorStop(1, "rgba(255, 132, 100, 0.05)");
    context.globalCompositeOperation = "lighter";
    context.fillStyle = rimLight;
    context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    context.globalCompositeOperation = "source-over";
    context.restore();
  }

  /**
   * One painted step. Coordinates arrive in the module's units, where the disc has radius
   * one and the y axis points up; the canvas has y pointing down, so the module's upper
   * half is the half drawn above the centre here.
   */
  function paint(step) {
    p.fill(...ROAD_COLOUR[step.road]);
    const x = centreX + step.centre.x * DISC_RADIUS;
    const y = centreY - step.centre.y * DISC_RADIUS;
    const diameter = 2 * step.radius * DISC_RADIUS;
    if (step.shape === UPPER_HALF_DISC) {
      p.arc(x, y, diameter, diameter, Math.PI, 2 * Math.PI, p.PIE);
      return;
    }
    p.circle(x, y, diameter);
  }

  function drawAll() {
    p.push();
    p.scale(RENDER_SCALE);
    p.background(...GROUND);
    drawHaze();

    // Nothing here strokes anything. A rim would have to be drawn in some third colour,
    // and inside this disc a third colour is a third road.
    p.noStroke();
    for (const step of PAINTING_ORDER) {
      paint(step);
    }
    drawGloss();
    p.pop();
  }

  function publishState() {
    const state = {
      kind: "image",
      paintedSteps: PAINTING_ORDER.length,
      discRadius: DISC_RADIUS,
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
    // A still: the figure is whole before anything could move, which is its whole claim.
    p.noLoop();
    drawAll();
    publishState();
  };
});
