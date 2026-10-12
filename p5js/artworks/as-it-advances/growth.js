export const SIZE = 680;
export const FPS = 30;
export const DURATION = 24;
export const FRAMES = FPS * DURATION;
export const GROWTH_FRAMES = 630;
export const POINTS = 640;
export const GRID = 137;
export const CELL = 5;
export const GROUND = [6, 7, 12];
export const STEEL = [104, 144, 204];
export const GOLD = [252, 204, 116];

const TAU = 2 * Math.PI;
const KERNEL = [];
for (let y = -3; y <= 3; y += 1) {
  for (let x = -3; x <= 3; x += 1) {
    KERNEL.push([x, y, Math.exp(-(x * x + y * y) / 3.2) * 0.012]);
  }
}

/** A material boundary and a separate, non-decaying record of where it has been. */
export function makeWorld() {
  const points = new Float64Array(2 * POINTS);
  for (let i = 0; i < POINTS; i += 1) {
    const a = TAU * i / POINTS;
    const r = 44 + 9 * Math.cos(3 * a + 0.4) + 4 * Math.sin(5 * a + 1.1);
    points[2 * i] = SIZE / 2 + r * Math.cos(a);
    points[2 * i + 1] = SIZE / 2 + r * Math.sin(a);
  }
  return { points, memory: new Float64Array(GRID * GRID), step: 0 };
}

export function cloneWorld(world, { eraseMemory = false } = {}) {
  return {
    points: world.points.slice(),
    memory: eraseMemory ? new Float64Array(GRID * GRID) : world.memory.slice(),
    step: world.step
  };
}

export function sampleMemory(memory, x, y) {
  const gx = Math.max(0, Math.min(GRID - 1.001, x / CELL));
  const gy = Math.max(0, Math.min(GRID - 1.001, y / CELL));
  const ix = Math.floor(gx), iy = Math.floor(gy);
  const fx = gx - ix, fy = gy - iy, at = iy * GRID + ix;
  return (memory[at] * (1 - fx) + memory[at + 1] * fx) * (1 - fy)
    + (memory[at + GRID] * (1 - fx) + memory[at + GRID + 1] * fx) * fy;
}

function deposit(world) {
  const { points, memory } = world;
  for (let i = 0; i < POINTS; i += 1) {
    const x = Math.round(points[2 * i] / CELL), y = Math.round(points[2 * i + 1] / CELL);
    for (const [dx, dy, weight] of KERNEL) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= GRID || y + dy >= GRID) continue;
      memory[(y + dy) * GRID + x + dx] += weight;
    }
  }
}

/**
 * Autonomous growth: no clock-driven deformation and no prescribed final contour.
 * A pressure carries the front outward; the gradient of its accumulated deposit
 * diverts it. Its sideways component shears the growing material around its own
 * history. Log compression bounds sensitivity without erasing any deposit.
 */
export function advance(world, { memoryStrength = 1 } = {}) {
  const { points, memory } = world;
  const next = new Float64Array(points.length);
  for (let i = 0; i < POINTS; i += 1) {
    const a = (i + POINTS - 1) % POINTS, b = (i + 1) % POINTS;
    const x = points[2 * i], y = points[2 * i + 1];
    const tx = points[2 * b] - points[2 * a], ty = points[2 * b + 1] - points[2 * a + 1];
    const length = Math.hypot(tx, ty) || 1;
    const nx = ty / length, ny = -tx / length;
    const gx = (Math.log1p(sampleMemory(memory, x + 5, y)) - Math.log1p(sampleMemory(memory, x - 5, y))) / 10;
    const gy = (Math.log1p(sampleMemory(memory, x, y + 5)) - Math.log1p(sampleMemory(memory, x, y - 5))) / 10;
    const rx = x - SIZE / 2, ry = y - SIZE / 2;
    // Fixed material heterogeneity, sampled in space, is not a periodic animation.
    const drive = 0.24 + 0.075 * Math.sin(x * 0.031 + y * 0.019)
      + 0.055 * Math.cos(y * 0.041 - x * 0.014);
    const confinement = Math.max(0, Math.hypot(rx / 274, ry / 274) - 0.92);
    let vx = drive * nx + 0.18 * (points[2 * a] + points[2 * b] - 2 * x)
      + memoryStrength * (-4.8 * gx - 3.4 * gy) - rx * confinement * 0.015;
    let vy = drive * ny + 0.18 * (points[2 * a + 1] + points[2 * b + 1] - 2 * y)
      + memoryStrength * (-4.8 * gy + 3.4 * gx) - ry * confinement * 0.015;
    const speed = Math.hypot(vx, vy);
    if (speed > 0.75) { vx *= 0.75 / speed; vy *= 0.75 / speed; }
    next[2 * i] = x + vx;
    next[2 * i + 1] = y + vy;
  }
  // Deposit the actual old boundary, after calculating all simultaneous forces.
  deposit(world);
  world.points = next;
  world.step += 1;
  return world;
}

export function makeHistory() {
  const world = makeWorld();
  const contours = [world.points.slice()];
  for (let frame = 1; frame <= GROWTH_FRAMES; frame += 1) {
    advance(world);
    contours.push(world.points.slice());
  }
  return { contours, world };
}

export function pageFrame(seconds) {
  return Math.max(0, Math.min(FRAMES - 1, Math.floor(seconds * FPS)));
}

export function growthFrame(frame) {
  return Math.max(0, Math.min(GROWTH_FRAMES, Math.floor(frame)));
}
