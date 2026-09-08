import { FLOOR_HEIGHTS, STAGE_SCALE, rimAt, verticals } from "./the-same-tower.js";

/** The pentagram's starlight and the Mobius band's sea glass on its dark water. */
export const GROUND = [8, 22, 24];
export const STARLIGHT = [202, 192, 232];
export const SEA_GLASS = [168, 206, 198];
export const CORE_WEIGHT = 0.65;
export const CORE_ALPHA = 168;
export const FLOOR_BUNDLE_RADIUS = 1.8;
export const CORNER_BUNDLE_RADIUS = 1.1;
export const WALL_HATCHES = 48;

const KEY_LIGHT = [-0.42, 0.52, -0.74];
const FILL_LIGHT = [0.66, -0.3, 0.69];
const SHADE_STEPS = 8;

function dot(a, b) {
  return a.reduce((sum, part, axis) => sum + part * b[axis], 0);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function unit(v) {
  const length = Math.hypot(...v);
  return v.map((part) => part / length);
}

export function onStage([x, y, z]) {
  return [x * STAGE_SCALE, z === 0 ? 0 : -z * STAGE_SCALE, y === 0 ? 0 : -y * STAGE_SCALE];
}

/**
 * A closed floor's local frame. The central hairline stays on the exact rim; four
 * companions stand on a small tube around it, as the rods in Innumerable Straight
 * Lines are described by their generators. Tangents use both neighbouring samples,
 * including at the seam, so a companion does not acquire a gap at the closing vertex.
 */
function rimFrames(rim) {
  const count = rim.length - 1;
  return rim.map((point, index) => {
    const previous = rim[(index + count - 1) % count];
    const next = rim[(index + 1) % count];
    const tangent = unit(next.map((part, axis) => part - previous[axis]));
    const across = unit(cross(tangent, [0, 1, 0]));
    return { point, across, up: unit(cross(across, tangent)) };
  });
}

function companion(frame, angle, radius) {
  const normal = frame.across.map((part, axis) => part * Math.cos(angle) + frame.up[axis] * Math.sin(angle));
  return { point: frame.point.map((part, axis) => part + radius * normal[axis]), normal };
}

/**
 * Quantized normal shading groups fixed segments into reusable models. The grouping
 * keeps the light across a bundle while avoiding thousands of individual draw calls.
 * No face is filled: the apparent thickness belongs to the spacing of the hairlines.
 */
export function towerEtching() {
  const rims = FLOOR_HEIGHTS.map((height) => rimAt(height).map(onStage));
  const layers = new Map();
  function layer(key, role, colour, alpha, weight) {
    if (!layers.has(key)) layers.set(key, { role, colour, alpha, weight, segments: [] });
    return layers.get(key);
  }
  function shaded(role, colour, alpha, weight, from, to, normal) {
    const brightness = 0.36 + 0.46 * Math.abs(dot(normal, KEY_LIGHT)) + 0.18 * Math.abs(dot(normal, FILL_LIGHT));
    const shade = Math.min(SHADE_STEPS, Math.round(brightness * SHADE_STEPS));
    const ink = colour.map((part) => part * shade / SHADE_STEPS);
    const key = `${role}:${colour === SEA_GLASS ? "glass" : "starlight"}:${shade}`;
    layer(key, role, ink, alpha, weight).segments.push([from, to]);
  }

  // Even spacing along the footprint, not along the original circle's angle: otherwise
  // too many hatches collect at the corners. Each generator joins matching floor points.
  const bottom = rims[0];
  const top = rims.at(-1);
  const lengths = bottom.slice(1).map((point, index) => Math.hypot(point[0] - bottom[index][0], point[2] - bottom[index][2]));
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  let edge = 0;
  let start = 0;
  for (let index = 0; index < WALL_HATCHES; index += 1) {
    const distance = (index + 0.5) * perimeter / WALL_HATCHES;
    while (start + lengths[edge] < distance) start += lengths[edge++];
    const t = (distance - start) / lengths[edge];
    const interpolate = (rim) => rim[edge].map((part, axis) => part + t * (rim[edge + 1][axis] - part));
    const normal = unit([bottom[edge + 1][2] - bottom[edge][2], 0, bottom[edge][0] - bottom[edge + 1][0]]);
    shaded("wall-hatch", SEA_GLASS, 56, 0.5, interpolate(bottom), interpolate(top), normal);
  }

  for (const ends of verticals()) {
    const [from, to] = ends.map(onStage);
    for (let strand = 0; strand < 4; strand += 1) {
      const angle = 2 * Math.PI * strand / 4;
      const normal = [Math.cos(angle), 0, Math.sin(angle)];
      const offset = (point) => point.map((part, axis) => part + CORNER_BUNDLE_RADIUS * normal[axis]);
      shaded("corner-hatch", SEA_GLASS, 152, 0.55, offset(from), offset(to), normal);
    }
  }

  for (const rim of rims) {
    const frames = rimFrames(rim);
    for (let strand = 0; strand < 4; strand += 1) {
      const angle = 2 * Math.PI * strand / 4;
      const points = frames.map((frame) => companion(frame, angle, FLOOR_BUNDLE_RADIUS));
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1];
        const to = points[index];
        const normal = unit(from.normal.map((part, axis) => part + to.normal[axis]));
        shaded("floor-hatch", strand % 2 ? STARLIGHT : SEA_GLASS, 164, 0.6, from.point, to.point, normal);
      }
    }
  }

  // The exact mathematical floors remain the brightest, finest reading of the figure.
  const core = layer("floor-core", "floor-core", STARLIGHT, CORE_ALPHA, CORE_WEIGHT);
  for (const rim of rims) {
    for (let index = 1; index < rim.length; index += 1) core.segments.push([rim[index - 1], rim[index]]);
  }
  return [...layers.values()];
}
