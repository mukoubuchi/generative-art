import {
  CAP_DROP,
  CAP_PADDING,
  CAP_RADIUS,
  CAP_RISE,
  HINT_INSET_RATIO,
  capWidth,
  hintTextSize
} from "./key-hint.js";

/**
 * The hand in the captured clip.
 *
 * Six artworks answer to the reader, and their clips replay a recorded gesture — a key
 * held, a bob dragged, a pointer swept. Until now the clips showed only the consequence:
 * the wheel starts turning on its own, the bob leaps unprompted. These marks put the cause
 * in the picture. They are a depiction of the artwork being operated, which is always true
 * of the clip; they are not the page's legend, which is an instruction to the viewer and
 * would be false in a clip that cannot be operated.
 *
 * Drawn only into captured clips: the page leaves the operating to the reader, and the
 * thumbnail already carries the legend. Everything is a pure function of the frame index
 * the sketches already compute from, so the clips stay deterministic.
 *
 * One design for all six, in two voices. A pointer is an abstract dot — dark core, light
 * rim, so it reads on the white artworks and the black ones alike — with a ripple on press.
 * A key is the same token the page's legend sets it in, lit while it is down.
 */
export const POINTER_RADIUS_RATIO = 0.011;
export const RIPPLE_FRAMES = 12;

/** Where a press's ripple is, from how many frames ago the press happened; null when over. */
export function ripplePhase(framesSincePress, rippleFrames = RIPPLE_FRAMES) {
  if (framesSincePress === null || framesSincePress < 0 || framesSincePress >= rippleFrames) {
    return null;
  }
  return framesSincePress / rippleFrames;
}

/**
 * The pointer, at the position the clip's scenario is driving. `pressed` thickens the core
 * while something is held; `ripple` is a phase from `ripplePhase` and draws the expanding
 * ring of the press itself.
 */
export function drawPointerIndicator(p, x, y, width, height, { pressed = false, ripple = null } = {}) {
  const base = Math.min(width, height);
  const radius = base * POINTER_RADIUS_RATIO * (pressed ? 1.3 : 1);
  const rim = base * 0.004;

  p.push();
  p.colorMode(p.RGB, 255);
  if (ripple !== null) {
    // Two rings a stroke apart, dark outside light, for the same reason the dot has a rim:
    // one of them survives whatever ground it lands on.
    const reach = radius * (1.6 + ripple * 4.4);
    const fade = 1 - ripple;
    p.noFill();
    p.stroke(0, 0, 0, 150 * fade);
    p.strokeWeight(rim);
    p.circle(x, y, reach * 2);
    p.stroke(255, 255, 255, 220 * fade);
    p.strokeWeight(rim * 0.6);
    p.circle(x, y, reach * 2 - rim * 2);
  }
  p.stroke(255, 255, 255, 235);
  p.strokeWeight(rim);
  p.fill(0, 0, 0, 220);
  p.circle(x, y, radius * 2);
  p.pop();
}

/**
 * The keys, as the legend's key-caps, at the legend's own corner — the page names the
 * control there, so the clip shows it working there. Each entry is `{ label, active }`;
 * an active cap fills with ink and its label goes light, which is a key seen pressed.
 */
export function drawKeyIndicator(p, keys, width, height) {
  const size = hintTextSize(width, height);
  const inset = Math.min(width, height) * HINT_INSET_RATIO;
  const baseline = height - inset;
  const padding = size * 0.5;
  const capHeight = size * (CAP_RISE + CAP_DROP);

  p.push();
  p.colorMode(p.RGB, 255);
  p.textSize(size);
  p.textAlign(p.LEFT, p.BOTTOM);

  let x = inset;
  for (const key of keys) {
    const width_ = capWidth(p, key.label, size);

    // The plate under each cap, as under the legend: these tokens land on saturated and
    // dark grounds as well as white ones.
    p.noStroke();
    p.fill(255, 255, 255, 208);
    p.rect(
      x - padding * 0.4,
      baseline - size * CAP_RISE - padding * 0.6,
      width_ + padding * 0.8,
      capHeight + padding * 1.2,
      size * 0.34
    );

    if (key.active) {
      p.noStroke();
      p.fill(0, 0, 0, 205);
    } else {
      p.noFill();
      p.stroke(0, 0, 0, 120);
      p.strokeWeight(Math.max(1, size * 0.06));
    }
    p.rect(x, baseline - size * CAP_RISE, width_, capHeight, size * CAP_RADIUS);

    p.noStroke();
    p.fill(...(key.active ? [255, 255, 255, 235] : [0, 0, 0, 168]));
    p.text(key.label, x + size * CAP_PADDING, baseline);
    x += width_ + size * 0.5;
  }
  p.pop();
}
