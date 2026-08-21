import { PAINTING_ORDER, UPPER_HALF_DISC } from "./taijitu.js";

/**
 * The figure itself, drawn from the list that defines it: six fills, laid down in order,
 * and no line anywhere.
 *
 * The two shades are the warm and the cool of One Yin, One Yang, which turns four discs of
 * the same two kinds around a ring. There the alternation is the subject and time carries
 * it; here the two are already in one another before anything moves, so nothing moves.
 *
 * What light there is comes from the centre outwards, which is the one lighting a half
 * turn leaves alone. A light falling from a corner would read as the picture's own, and
 * would say that the two halves are not after all exchangeable.
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

const GROUND = [13, 18, 27];
const SHADE_COLOUR = {
  light: [232, 221, 198],
  dark: [46, 64, 96]
};
const DISC_RADIUS = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT) * 0.335;

const P5 = window.p5;

new P5((p) => {
  /**
   * A light that a half turn cannot tell from itself: a glow about the centre the figure
   * turns around, falling off before it reaches the rim.
   */
  function drawCentreLight() {
    const context = p.drawingContext;
    context.save();
    context.scale(RENDER_SCALE, RENDER_SCALE);
    const centreX = LOGICAL_WIDTH / 2;
    const centreY = LOGICAL_HEIGHT / 2;
    const glow = context.createRadialGradient(
      centreX,
      centreY,
      DISC_RADIUS * 0.85,
      centreX,
      centreY,
      DISC_RADIUS * 1.5
    );
    glow.addColorStop(0, "rgba(126, 148, 194, 0.14)");
    glow.addColorStop(0.45, "rgba(74, 92, 136, 0.06)");
    glow.addColorStop(1, "rgba(13, 18, 27, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    context.restore();
  }

  /**
   * One painted step. Coordinates arrive in the module's units, where the disc has radius
   * one and the y axis points up; the canvas has y pointing down, so the module's upper
   * half is the half drawn above the centre here.
   */
  function paint(step) {
    p.fill(...SHADE_COLOUR[step.shade]);
    const x = step.centre.x * DISC_RADIUS;
    const y = -step.centre.y * DISC_RADIUS;
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
    drawCentreLight();
    p.translate(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    // Nothing here strokes anything. A rim would have to be drawn in some third colour,
    // and a third colour in a figure about two would be a claim the figure does not make;
    // the cool region stands off the ground on its own value, helped by the light behind
    // it, which is the same reason the ground is darker than either shade.
    p.noStroke();
    for (const step of PAINTING_ORDER) {
      paint(step);
    }
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
