export const WIDTH = 900;
export const HEIGHT = 680;
export const FPS = 30;
export const DURATION = 24;
export const FRAMES = FPS * DURATION;
export const SEEDS = 3;
export const BIRTHS = 5;
export const COUNT = SEEDS + BIRTHS;
export const SAMPLES = 288;
export const CENTRE = [WIDTH / 2, HEIGHT / 2];
export const RADIUS = 127;
export const ARCHIVE_RADIUS = 38;
export const INTRO = 1.5;
export const PERIOD = 4;
export const DENOMINATOR = Array.from({ length: BIRTHS }, (_, i) => BigInt(SEEDS + i))
  .reduce((product, n) => product * n, 100n);
const TAU = 2 * Math.PI;
const clamp = (x) => Math.max(0, Math.min(1, x));
export const ease = (x) => { const t = clamp(x); return t * t * t * (10 + t * (-15 + 6 * t)); };
const PULSES = [[30, 0], [0, 30], [-24, 18], [18, 0], [0, -18], [-18, 0], [12, 9], [-9, 12]];
const empty = () => Array.from({ length: COUNT }, () => [0n, 0n]);

/** A common integer lattice makes every finite average exact. No tolerance is used. */
export function meanOf(events) {
  if (!events.length) return empty();
  const n = BigInt(events.length);
  return empty().map((_, mode) => [0, 1].map((axis) => {
    const sum = events.reduce((total, event) => total + event.coefficients[mode][axis], 0n);
    if (sum % n !== 0n) throw new Error("The coefficient lattice does not contain this mean.");
    return sum / n;
  }));
}

export function nextEvent(past) {
  const id = past.length;
  if (id >= COUNT) throw new Error("The finite chronicle is complete.");
  const inherited = id < SEEDS ? empty() : meanOf(past);
  const coefficients = inherited.map((pair) => [...pair]);
  coefficients[id] = PULSES[id].map((value) => BigInt(value) * (DENOMINATOR / 100n));
  return { id, inherited, coefficients, parents: id < SEEDS ? [] : past.map((event) => event.id) };
}

export function createChronicle() {
  const events = [];
  while (events.length < COUNT) events.push(nextEvent(events));
  return events;
}

/** z(theta) = exp(i theta) + sum c_m exp(i(m+2)theta). */
export function pointOf(coefficients, theta) {
  let x = Math.cos(theta), y = Math.sin(theta);
  for (let m = 0; m < coefficients.length; m++) {
    const a = Number(coefficients[m][0]) / Number(DENOMINATOR);
    const b = Number(coefficients[m][1]) / Number(DENOMINATOR);
    const c = Math.cos((m + 2) * theta), s = Math.sin((m + 2) * theta);
    x += a * c - b * s;
    y += a * s + b * c;
  }
  return [x, y];
}

export function sample(coefficients) {
  return Array.from({ length: SAMPLES }, (_, i) => pointOf(coefficients, TAU * i / SAMPLES));
}

export function archivePosition(id) {
  const slot = [0, 2, 4, 1, 3, 5, 6][id];
  if (slot === undefined) return [...CENTRE];
  const angle = -Math.PI / 2 + TAU * slot / (COUNT - 1);
  return [CENTRE[0] + 321 * Math.cos(angle), CENTRE[1] + 239 * Math.sin(angle)];
}

/** These copies leave their originals intact; every section meets the same mean. */
export function sectionPoint(source, target, id, t, i) {
  const origin = archivePosition(id), u = ease(t);
  const dx = CENTRE[0] - origin[0], dy = CENTRE[1] - origin[1];
  const length = Math.hypot(dx, dy), bow = 66 * Math.sin(Math.PI * t);
  const radius = ARCHIVE_RADIUS + (RADIUS - ARCHIVE_RADIUS) * u;
  return [origin[0] + dx * u - dy / length * bow + radius * (source[i][0] * (1 - u) + target[i][0] * u),
    origin[1] + dy * u + dx / length * bow + radius * (source[i][1] * (1 - u) + target[i][1] * u)];
}

export function stateAt(frame) {
  const time = Math.max(0, Math.min(FRAMES - 1, frame)) / FPS;
  const elapsed = Math.max(0, time - INTRO);
  const birth = Math.min(BIRTHS - 1, Math.floor(elapsed / PERIOD));
  const local = elapsed - birth * PERIOD;
  const event = SEEDS + birth;
  const gather = time < INTRO ? 0 : ease(local / 1.6);
  const novelty = ease((local - 1.6) / 1.05);
  const transfer = event === COUNT - 1 ? 0 : ease((local - 3.1) / 0.9);
  const complete = local >= 2.65 && time >= INTRO;
  return { time, event, local, gather, novelty, transfer,
    complete, count: event + Number(complete), contributors: event,
    active: time >= INTRO, finished: time >= INTRO + BIRTHS * PERIOD };
}

export const frameAt = (seconds) => Math.min(FRAMES - 1, Math.floor(Math.max(0, seconds) * FPS));
