export const LOGICAL_SIZE = 720;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 28;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

// Parallel edges are distinct bridges, so a visited-edge mask is essential.
// A is the five-bridge island; B, C and D each have three bridges.
export const BRIDGES = Object.freeze([
  [0, 1], [0, 1], [0, 2], [0, 2], [0, 3], [1, 3], [2, 3]
].map(Object.freeze));
export const EXTENDED_BRIDGES = Object.freeze([...BRIDGES, Object.freeze([1, 2])]);

export function degrees(edges) {
  const result = [0, 0, 0, 0];
  for (const [a, b] of edges) { result[a] += 1; result[b] += 1; }
  return result;
}

/**
 * Every edge-simple walk from each region, continued until its end has no unused bridge.
 * Only the end is stuck: a walk may still have an unused bridge at its start, and then its
 * reverse is not in the set.
 */
export function enumerateTrails(edges) {
  const trails = [];
  function extend(vertex, used, vertices, edgeIds) {
    let extended = false;
    edges.forEach(([a, b], id) => {
      if ((used & (1 << id)) || (a !== vertex && b !== vertex)) return;
      extended = true;
      const next = a === vertex ? b : a;
      extend(next, used | (1 << id), [...vertices, next], [...edgeIds, id]);
    });
    if (!extended) trails.push({ vertices, edges: edgeIds, mask: used });
  }
  for (let vertex = 0; vertex < 4; vertex += 1) extend(vertex, 0, [vertex], []);
  return trails;
}

export function traceEdges(edges, start, edgeIds) {
  const vertices = [start];
  let used = 0;
  for (const id of edgeIds) {
    if (!Number.isInteger(id) || !edges[id] || (used & (1 << id))) {
      throw new Error("A walk must use existing, distinct bridges.");
    }
    const [a, b] = edges[id];
    const vertex = vertices.at(-1);
    if (vertex !== a && vertex !== b) throw new Error("A walk cannot jump between regions.");
    vertices.push(vertex === a ? b : a);
    used |= 1 << id;
  }
  return { vertices, edges: [...edgeIds], mask: used };
}

export const FAILED_TRAILS = Object.freeze(enumerateTrails(BRIDGES));
export const COMPLETE_TRAIL = traceEdges(EXTENDED_BRIDGES, 0, [0, 1, 2, 3, 4, 5, 7, 6]);

export const EYELETS = Object.freeze([
  { x: 231, y: 360, radius: 63 },
  { x: 374, y: 155, radius: 49 },
  { x: 374, y: 565, radius: 49 },
  { x: 573, y: 360, radius: 51 }
]);

// Endpoint angles identify separate ports even for parallel bridges. Connections
// between distinct bridges lie in a region's annulus, where changing bridges is legal.
const PORTS = [[-150, 180], [-55, 130], [150, 180], [55, -130], [0, 180], [10, -70], [-10, 70], [-85, 85]];
const REACH = [147, 67, 147, 67, 84, 119, 119];
const radians = (degreesValue) => degreesValue * Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

function port(edge, endpoint, lane) {
  const vertex = EXTENDED_BRIDGES[edge][endpoint];
  const node = EYELETS[vertex];
  const angle = radians(PORTS[edge][endpoint]) + lane * 0.2;
  const radius = node.radius + lane * 9;
  return { x: node.x + radius * Math.cos(angle), y: node.y + radius * Math.sin(angle), angle, radius };
}

function cubic(a, b, c, d, t) {
  const s = 1 - t;
  return { x: s ** 3 * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t ** 3 * d.x,
    y: s ** 3 * a.y + 3 * s * s * t * b.y + 3 * s * t * t * c.y + t ** 3 * d.y };
}

export function bridgePoints(edge, lane = 0) {
  const a = port(edge, 0, lane), d = port(edge, 1, lane);
  let b, c;
  if (edge === 7) {
    b = { x: -58 + lane * 13, y: 35 + lane * 4 };
    c = { x: -58 + lane * 13, y: 685 - lane * 4 };
  } else {
    const reach = REACH[edge];
    b = { x: a.x + reach * Math.cos(a.angle), y: a.y + reach * Math.sin(a.angle) };
    c = { x: d.x + reach * Math.cos(d.angle), y: d.y + reach * Math.sin(d.angle) };
  }
  return Array.from({ length: edge === 7 ? 101 : 49 }, (_, i) => cubic(a, b, c, d, i / (edge === 7 ? 100 : 48)));
}

/** A legal graph walk embedded as bridge curves joined around empty eyelets. */
export function trailPoints(trail, lane = 0) {
  const points = [];
  trail.edges.forEach((edge, index) => {
    const from = trail.vertices[index];
    const side = EXTENDED_BRIDGES[edge][0] === from ? 0 : 1;
    if (index > 0) {
      const previousEdge = trail.edges[index - 1];
      const previousSide = EXTENDED_BRIDGES[previousEdge][0] === from ? 0 : 1;
      const arrival = port(previousEdge, previousSide, lane);
      const departure = port(edge, side, lane);
      const turn = (departure.angle - arrival.angle + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      const node = EYELETS[from];
      const count = Math.max(2, Math.ceil(Math.abs(turn) * 13));
      for (let k = 1; k < count; k += 1) {
        const angle = arrival.angle + turn * k / count;
        points.push({ x: node.x + arrival.radius * Math.cos(angle), y: node.y + arrival.radius * Math.sin(angle) });
      }
    }
    const bridge = bridgePoints(edge, lane);
    points.push(...(side === 0 ? bridge : bridge.reverse()));
  });
  return measurePath(points);
}

export function measurePath(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths.at(-1) + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { points, lengths, length: lengths.at(-1) };
}

export function pointAt(path, distance) {
  const target = clamp(distance, 0, path.length);
  let low = 1, high = path.points.length - 1;
  while (low < high) { const mid = (low + high) >> 1; if (path.lengths[mid] < target) low = mid + 1; else high = mid; }
  const span = path.lengths[low] - path.lengths[low - 1];
  const t = span ? (target - path.lengths[low - 1]) / span : 0;
  return { x: lerp(path.points[low - 1].x, path.points[low].x, t), y: lerp(path.points[low - 1].y, path.points[low].y, t), index: low };
}

// Permute the lanes with a coprime multiplier; enumeration neighbours otherwise
// trace nearly identical paths and collapse the woven body into a few thick lines.
export const THREADS = FAILED_TRAILS.map((trail, index) => {
  const lane = (((index * 137) % FAILED_TRAILS.length) + 0.5) / FAILED_TRAILS.length * 2 - 1;
  return { trail, lane, path: trailPoints(trail, lane), order: index };
});
const sixFromA = THREADS.findIndex(({ trail }) => trail.vertices[0] === 0 && trail.edges.length === 6);
const sixFromD = THREADS.findIndex(({ trail }) => trail.vertices[0] === 3 && trail.edges.length === 6);
export const SOLO_INDICES = [sixFromA, sixFromD];

/** The bridges as drawn, one bundle each; the eighth, index 7, is the added one. */
export const BRIDGE_PATHS = EXTENDED_BRIDGES.map((_, id) => measurePath(bridgePoints(id)));

/** The warm ribbon: 33 offset copies of the one open trail, the middle one (16) at lane 0. */
export const GOLD_THREADS = Array.from({ length: 33 }, (_, i) => trailPoints(COMPLETE_TRAIL, (i - 16) / 25));

export function sceneAt(frameIndex) {
  const frame = clamp(Math.floor(frameIndex), 0, TOTAL_FRAMES - 1);
  const seconds = frame / PLAYBACK_FPS;
  return {
    frameIndex: frame, totalFrames: TOTAL_FRAMES, seconds,
    addedBridge: smooth((seconds - 15.5) / 1.8),
    crossing: clamp((seconds - 17.5) / 9),
    historyOpacity: 1 - 0.71 * smooth((seconds - 15) / 2),
    completed: seconds >= 26.5,
    threadProgress: THREADS.map((thread, index) => {
      if (index === sixFromA) return clamp((seconds - 0.5) / 3.8);
      if (index === sixFromD) return clamp((seconds - 6) / 3.8);
      const delay = 11 + 1.25 * ((index * 73) % THREADS.length) / THREADS.length;
      return clamp((seconds - delay) / (thread.path.length / 1000));
    })
  };
}
