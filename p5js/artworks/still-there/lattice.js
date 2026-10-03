export const SIZE = 127;
export const HALF = (SIZE - 1) / 2;
export const COUNT = SIZE * SIZE;
export const STEP_SECONDS = 1.2;
export const FPS = 30;
export const CLIP_SECONDS = 20;
export const TOTAL_FRAMES = FPS * CLIP_SECONDS;

export const wrap = (value) => ((value + HALF) % SIZE + SIZE) % SIZE - HALF;
export const ease = (t) => t * t * (3 - 2 * t);

export function initialPositions() {
  const result = new Int16Array(COUNT * 2);
  for (let i = 0; i < COUNT; i += 1) {
    result[2 * i] = i % SIZE - HALF;
    result[2 * i + 1] = Math.floor(i / SIZE) - HALF;
  }
  return result;
}

/** Two bijective integer shears; reversing their order and signs is the inverse. */
export function permute(positions, direction) {
  const result = new Int16Array(positions.length);
  for (let i = 0; i < positions.length; i += 2) {
    let x = positions[i];
    let y = positions[i + 1];
    if (direction === 1) {
      x = wrap(x + y);
      y = wrap(y + x);
    } else {
      y = wrap(y - x);
      x = wrap(x - y);
    }
    result[i] = x;
    result[i + 1] = y;
  }
  return result;
}

/** Fractional positions are display-only. The completed state stays integer-valued. */
export function movingPoint(x, y, direction, progress) {
  const first = ease(Math.min(1, Math.max(0, progress * 2)));
  const second = ease(Math.min(1, Math.max(0, progress * 2 - 1)));
  if (direction === 1) {
    const nextX = wrap(x + y);
    return [wrap(x + y * first), wrap(y + nextX * second)];
  }
  const nextY = wrap(y - x);
  return [wrap(x - nextY * second), wrap(y - x * first)];
}

export const PALETTE = [[224, 119, 66], [241, 184, 108], [208, 218, 196], [79, 164, 171], [48, 102, 137]];

/** Colour belongs to the original tessera. A permutation never recolours a cell. */
export function tessera(index) {
  const x = (index % SIZE - HALF) / HALF;
  const y = (Math.floor(index / SIZE) - HALF) / HALF;
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  const petal = r + 0.054 * Math.cos(12 * a) * Math.min(1, r * 5);
  const ring = Math.abs(Math.sin(petal * Math.PI * 13));
  const spoke = Math.abs(Math.sin(12 * a + r * 5));
  const lace = Math.abs(Math.sin(24 * a - r * 13));
  const envelope = r < 0.94 ? Math.min(1, (0.94 - r) * 30) : 0;
  const line = Math.pow(1 - ring, 1.4) * 0.8 + Math.pow(1 - spoke, 5) * 0.5;
  const brightness = envelope * Math.min(1, 0.065 + line + 0.13 * (1 - lace));
  const stripe = Math.floor(petal * 13 + 0.25 * Math.cos(6 * a));
  const colour = PALETTE[((stripe % PALETTE.length) + PALETTE.length) % PALETTE.length];
  const rgb = colour.map((c, i) => Math.round([9, 18, 28][i] + c * brightness * 0.87));
  return { rgb, bright: brightness, colour: `rgb(${rgb})` };
}

export function positionDigest(positions) {
  let hash = 2166136261;
  for (const value of positions) hash = Math.imul(hash ^ (value + HALF), 16777619) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

/** One state machine serves real keys and the capture's scripted key sequence. */
export class Loom {
  constructor() { this.reset(); }

  reset() {
    this.positions = initialPositions();
    this.steps = 0;
    this.direction = 1;
    this.active = false;
    this.running = false;
    this.elapsed = 0;
    this.queue = [];
  }

  key(key) {
    if (key === "r" || key === "R") { this.reset(); return true; }
    if (key === " ") {
      this.running = !this.running;
      if (this.running && !this.active) this.begin(this.direction);
      return true;
    }
    if (key !== "ArrowLeft" && key !== "ArrowRight") return false;
    this.direction = key === "ArrowRight" ? 1 : -1;
    if (this.active) {
      this.queue.push(this.direction);
    } else this.begin(this.direction);
    return true;
  }

  begin(direction) {
    this.active = true;
    this.activeDirection = direction;
    this.elapsed = 0;
  }

  advance(seconds) {
    let remaining = Math.max(0, seconds);
    while (this.active && remaining > 0) {
      const consumed = Math.min(remaining, STEP_SECONDS - this.elapsed);
      this.elapsed += consumed;
      remaining -= consumed;
      if (this.elapsed < STEP_SECONDS - 1e-10) break;
      this.positions = permute(this.positions, this.activeDirection);
      this.steps += this.activeDirection;
      this.active = false;
      this.elapsed = 0;
      if (this.queue.length) this.begin(this.queue.shift());
      else if (this.running) this.begin(this.direction);
    }
  }

  get progress() { return this.active ? this.elapsed / STEP_SECONDS : 0; }
}

/** The cap each key the loom answers to is set in, the same as in the page's legend. */
export const KEY_CAPS = Object.freeze({ ArrowLeft: "←", ArrowRight: "→", " ": "space", r: "R", R: "R" });

/**
 * What the page does with a keydown. A shortcut with Control, Command or Alt, or a key the
 * loom does not answer to, is left to the browser ("ignore"). A held key's repeats are
 * cancelled so the page does not scroll, but move nothing ("swallow"). Anything else is a
 * press for the loom ("press").
 */
export function keydownAction({ key, repeat = false, ctrlKey = false, metaKey = false, altKey = false }) {
  if (ctrlKey || metaKey || altKey || !Object.hasOwn(KEY_CAPS, key)) return "ignore";
  return repeat ? "swallow" : "press";
}

// The film presses the same keys as the page: four steps out, four back, then reset.
export const DEMO_KEYS = [
  [1, "ArrowRight"], [3, "ArrowRight"], [5, "ArrowRight"], [7, "ArrowRight"],
  [10, "ArrowLeft"], [12, "ArrowLeft"], [14, "ArrowLeft"], [16, "ArrowLeft"],
  [19, "r"]
];

export function demoAt(frameIndex) {
  const frame = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.floor(frameIndex)));
  const seconds = frame / FPS;
  const loom = new Loom();
  let time = 0;
  let pressTime = -Infinity;
  let pressedKey = null;
  for (const [at, key] of DEMO_KEYS) {
    if (at > seconds) break;
    loom.advance(at - time);
    loom.key(key);
    pressTime = at;
    pressedKey = key;
    time = at;
  }
  loom.advance(seconds - time);
  return { loom, frame, pressedKey: seconds - pressTime < 0.8 ? pressedKey : null };
}
