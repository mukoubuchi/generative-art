/** Type size and inset as fractions of the canvas's shorter side. */
export const HINT_SIZE_RATIO = 0.026;
export const HINT_INSET_RATIO = 0.032;
export const HINT_MINIMUM_SIZE = 12;

export function hintTextSize(width, height, scale = 1) {
  return Math.max(HINT_MINIMUM_SIZE, Math.min(width, height) * HINT_SIZE_RATIO) * scale;
}

/**
 * The default ink for a hint over a light artwork. Every artwork that answers to the reader
 * is light where the hint falls, so this is what all of them use; the fields are here so a
 * dark one could set its own rather than have the note vanish into it.
 */
export const HINT_TONE = {
  plate: [255, 255, 255, 208],
  ink: [0, 0, 0, 168],
  cap: [0, 0, 0, 120]
};

/**
 * Measured in units of the type size, so the token scales with the line. Exported because
 * the input indicator draws the same token on the captured clips: a key lighting up in a
 * clip and the same key named in the page's legend have to be one design, or the reader is
 * left to guess whether they are the same key.
 */
export const CAP_PADDING = 0.42;
export const CAP_RISE = 1.0;
export const CAP_DROP = 0.26;
export const CAP_RADIUS = 0.28;
const GAP = 0.42;
const SEPARATOR = "·";

export function capWidth(p, label, size) {
  return p.textWidth(label) + size * CAP_PADDING * 2;
}

/**
 * The room a legend has, which is the canvas less an inset at each end. The plate hangs
 * half a padding outside the inset on the left and wants the same on the right, and the
 * padding cancels from both sides, so the legend itself is what has to fit in this.
 */
export function legendRoom(width, inset) {
  return width - 2 * inset;
}

/**
 * The type size a legend can actually be set at. Text width is proportional to type
 * size, so a legend that overruns by some factor comes back inside by shrinking in the
 * same proportion; `measure` is asked again afterwards because a font's widths are not
 * exactly proportional at every size, and twice more in case it is stubborn.
 *
 * This is what keeps the note inside the canvas by construction rather than by the
 * wording happening to be short. A thumbnail sets the same legend 1.7 times larger on a
 * canvas of the same width, so a line that fits a page can overrun a card by half as
 * much again — which is exactly how this came to be missing.
 */
export function fitHintSize(size, room, measure, rounds = 3) {
  let fitted = size;
  for (let round = 0; round < rounds; round += 1) {
    const measured = measure(fitted);
    if (measured <= room) {
      return fitted;
    }
    fitted *= room / measured;
  }
  // A font whose widths have a fixed part to them — rounding to whole pixels, a stem
  // that will not get thinner — approaches the room from above and could sit a hair
  // outside it for any number of rounds. A last step of one per cent more than the
  // ratio asks settles it, and is only ever reached by a font that is not proportional.
  const measured = measure(fitted);
  return measured <= room ? fitted : fitted * (room / measured) * 0.99;
}

/**
 * The width the whole legend will occupy, which the plate behind it has to know before any
 * of it is drawn.
 */
function legendWidth(p, segments, size) {
  let width = 0;
  segments.forEach((segment, index) => {
    if (index > 0) {
      width += size * GAP + p.textWidth(SEPARATOR) + size * GAP;
    }
    width += capWidth(p, segment.cap, size) + size * GAP + p.textWidth(segment.text);
  });
  return width;
}

/** One control, drawn as a key is drawn on a keyboard: a token with an outline. */
function drawCap(p, label, x, baseline, size, tone) {
  const width = capWidth(p, label, size);
  p.push();
  p.noFill();
  p.stroke(...tone.cap);
  p.strokeWeight(Math.max(1, size * 0.06));
  p.rect(x, baseline - size * CAP_RISE, width, size * (CAP_RISE + CAP_DROP), size * CAP_RADIUS);
  p.pop();

  p.fill(...tone.ink);
  p.text(label, x + size * CAP_PADDING, baseline);
  return width;
}

/**
 * A one-line legend of what the reader can do, for the page and for the thumbnail that
 * stands in for it.
 *
 * Each control is set in a token of its own and its effect follows in plain type, which is
 * how a legend reads rather than how a sentence reads: the eye finds the key before the
 * clause. An arrow key needs no more than its own glyph; a letter and a mouse action are
 * named in the token.
 *
 * It sits at the foot of the canvas on the leading edge. The artwork pages do not scale
 * their canvas to the window — it is drawn at its own size and clipped — so on a narrow
 * screen the right of the canvas is the part that disappears, and a legend in that corner
 * would be the first thing lost. The left foot survives.
 *
 * Drawn in the caller's coordinate system, which is the logical canvas on the page. It is
 * deliberately not drawn into the captured export: a still or a clip posted elsewhere
 * cannot be typed at or pointed at, so the instruction would be an untruth printed on the
 * artwork. A gallery thumbnail is the other way about — it is a picture of a page that can
 * be — so it carries the legend, enlarged by `scale` because the card draws the canvas at
 * around two fifths of its own size and the page's type would arrive there unreadable.
 */
export function drawKeyHint(p, segments, width, height, scale = 1, tone = HINT_TONE) {
  const inset = Math.min(width, height) * HINT_INSET_RATIO;

  p.push();
  // Restores on pop, so this works whatever colour mode the artwork is drawing in.
  p.colorMode(p.RGB, 255);
  p.noStroke();
  p.textAlign(p.LEFT, p.BOTTOM);

  // Set at the size it wants, or at the largest size that fits, whichever is smaller.
  const size = fitHintSize(
    hintTextSize(width, height, scale),
    legendRoom(width, inset),
    (candidate) => {
      p.textSize(candidate);
      return legendWidth(p, segments, candidate);
    }
  );
  const padding = size * 0.5;
  p.textSize(size);

  const baseline = height - inset;
  const total = legendWidth(p, segments, size);

  // A plate behind the whole legend. Grey on white is legible, but these artworks are not
  // all white where the hint falls — Fibonacci Spiral opens on a saturated red rectangle
  // that reaches the foot of the canvas, and grey on that is unreadable. On a light artwork
  // the plate is barely visible; where the artwork is not light, it is what makes the line
  // readable at all.
  const plate = {
    left: inset - padding,
    top: baseline - size * CAP_RISE - padding * 0.6,
    width: total + padding * 2,
    height: size * (CAP_RISE + CAP_DROP) + padding * 1.2
  };
  p.fill(...tone.plate);
  p.rect(plate.left, plate.top, plate.width, plate.height, size * 0.34);

  let x = inset;
  segments.forEach((segment, index) => {
    if (index > 0) {
      x += size * GAP;
      p.fill(...tone.cap);
      p.text(SEPARATOR, x, baseline);
      x += p.textWidth(SEPARATOR) + size * GAP;
    }
    x += drawCap(p, segment.cap, x, baseline, size, tone) + size * GAP;
    p.fill(...tone.ink);
    p.text(segment.text, x, baseline);
    x += p.textWidth(segment.text);
  });
  p.pop();

  const bounds = {
    ...plate,
    right: plate.left + plate.width,
    bottom: plate.top + plate.height,
    size,
    canvas: { width, height }
  };
  // Recorded where the renderer can find it. Text is only as wide as a browser says it
  // is, so whether a legend fits cannot be settled anywhere but in the page — and this
  // is what lets the thumbnail run refuse to write a card with the note running off it.
  if (typeof window !== "undefined") {
    window.__KEY_HINT_BOUNDS__ = bounds;
  }
  return bounds;
}
