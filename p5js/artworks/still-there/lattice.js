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
    this.lastKey = null;
  }

  key(key) {
    if (key === "r" || key === "R") { this.reset(); return true; }
    if (key === " ") {
      this.running = !this.running;
      if (this.running && !this.active) this.begin(this.direction);
      this.lastKey = "space";
      return true;
    }
    if (key !== "ArrowLeft" && key !== "ArrowRight") return false;
    this.direction = key === "ArrowRight" ? 1 : -1;
    this.lastKey = this.direction === 1 ? "→" : "←";
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
