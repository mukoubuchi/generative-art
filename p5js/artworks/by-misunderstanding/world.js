/**
 * By Misunderstanding: a world of nodes that hear one another, and the two ways of hearing.
 *
 * Every node holds one of two opinions. In act one each node hears every neighbour exactly
 * and takes the majority, all at once; a tie keeps the node's own opinion. That rule is a
 * threshold network with the symmetric weights A + I/2, and its parallel iteration falls
 * into a cycle of period one or two (Goles and Olivos, 1980): from the start registered
 * here the patches freeze or blink for ever and the world never agrees. In act two each node
 * hears one neighbour, chosen at random, and takes that single voice for the whole -- a
 * malentendu, a thing badly heard. On a finite connected graph this voter rule reaches
 * unanimity with probability one, and unanimity is absorbing. The clip is drawn from the
 * states below and from nothing else: a frame is a function of its index.
 *
 * Everything in the geometry is +, -, *, / and a square root on IEEE doubles, which every
 * engine rounds the same way; no trigonometric function is called on the path to a
 * registered number, so the counts and the states below are the same on every machine.
 */

export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 22;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/** Act one: a step every half second, so a blinking node changes at most twice a second. */
export const ACT_ONE_SECONDS = 6;
export const ACT_ONE_FRAMES = ACT_ONE_SECONDS * PLAYBACK_FPS;
export const ACT_ONE_STEP_FRAMES = 15;
/** The states act one shows: step 0 is the registered start. */
export const ACT_ONE_STEPS = ACT_ONE_FRAMES / ACT_ONE_STEP_FRAMES;

/** The world: nodes thrown by a Poisson disc inside a round field, linked by Delaunay. */
export const CENTRE = LOGICAL_SIZE / 2;
export const FIELD_RADIUS = 300;
export const SEED = 117;
export const SPACING = 15.5;
/** How many random-order sweeps of the voter rule pass between two frames of act two. */
export const SWEEPS_PER_FRAME = 1;

/** A 32-bit generator (mulberry32), seeded once; the whole clip is drawn from its stream. */
export function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bridson's Poisson-disc sampling inside a disc of `fieldRadius` about the centre: no two
 * nodes closer than `spacing`, none further than `2 * spacing` from the nearest. The
 * candidates around an active node are drawn by rejection from a square, not from an angle
 * and a radius, so that no sine or cosine enters the layout.
 */
export function poissonDisc(random, spacing, centre, fieldRadius, attempts = 30) {
  const cell = spacing / Math.SQRT2;
  const columns = Math.ceil((2 * fieldRadius) / cell) + 1;
  const origin = centre - fieldRadius;
  const grid = new Int32Array(columns * columns).fill(-1);
  const points = [];
  const active = [];
  const inField = (x, y) => (x - centre) * (x - centre) + (y - centre) * (y - centre) <= fieldRadius * fieldRadius;
  const cellOf = (value) => Math.floor((value - origin) / cell);
  const fits = (x, y) => {
    const column = cellOf(x);
    const row = cellOf(y);
    for (let r = Math.max(0, row - 2); r <= Math.min(columns - 1, row + 2); r += 1) {
      for (let c = Math.max(0, column - 2); c <= Math.min(columns - 1, column + 2); c += 1) {
        const other = grid[r * columns + c];
        if (other < 0) continue;
        const dx = points[other].x - x;
        const dy = points[other].y - y;
        if (dx * dx + dy * dy < spacing * spacing) return false;
      }
    }
    return true;
  };
  const insert = (x, y) => {
    grid[cellOf(y) * columns + cellOf(x)] = points.length;
    active.push(points.length);
    points.push({ x, y });
  };
  insert(centre, centre);
  while (active.length > 0) {
    const slot = Math.floor(random() * active.length);
    const around = points[active[slot]];
    let placed = false;
    for (let attempt = 0; attempt < attempts && !placed; attempt += 1) {
      let dx;
      let dy;
      let d2;
      do {
        dx = (random() * 2 - 1) * 2 * spacing;
        dy = (random() * 2 - 1) * 2 * spacing;
        d2 = dx * dx + dy * dy;
      } while (d2 < spacing * spacing || d2 > 4 * spacing * spacing);
      const x = around.x + dx;
      const y = around.y + dy;
      if (!inField(x, y) || !fits(x, y)) continue;
      insert(x, y);
      placed = true;
    }
    if (!placed) {
      active[slot] = active[active.length - 1];
      active.pop();
    }
  }
  return points;
}

function circumcircle(ax, ay, bx, by, cx, cy) {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (d === 0) throw new Error("three collinear nodes have no circumcircle");
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const x = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const y = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return { x, y, r2: (ax - x) * (ax - x) + (ay - y) * (ay - y) };
}

/**
 * The Delaunay triangulation of the nodes (Bowyer and Watson), returned as triangles and as
 * the sorted list of its links, each once, with the smaller index first. Links are sets of
 * two nodes, so the relation is symmetric by construction; a test counts the one-way links
 * all the same, and finds none.
 */
export function delaunay(points) {
  const count = points.length;
  const far = 100 * LOGICAL_SIZE;
  const vertices = points.map((point) => [point.x, point.y]);
  vertices.push([CENTRE - 2 * far, CENTRE - far], [CENTRE + 2 * far, CENTRE - far], [CENTRE, CENTRE + 2 * far]);
  const make = (a, b, c) => ({ a, b, c, ...circumcircle(...vertices[a], ...vertices[b], ...vertices[c]) });
  const span = count + 3;
  let triangles = [make(count, count + 1, count + 2)];
  for (let index = 0; index < count; index += 1) {
    const [px, py] = vertices[index];
    const kept = [];
    const edges = new Map();
    for (const triangle of triangles) {
      const dx = px - triangle.x;
      const dy = py - triangle.y;
      if (dx * dx + dy * dy >= triangle.r2) {
        kept.push(triangle);
        continue;
      }
      for (const [u, v] of [[triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]]) {
        const key = u < v ? u * span + v : v * span + u;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    for (const [key, seen] of edges) {
      if (seen !== 1) continue;
      kept.push(make(Math.floor(key / span), key % span, index));
    }
    triangles = kept;
  }
  const inner = triangles.filter((triangle) => triangle.a < count && triangle.b < count && triangle.c < count);
  const linkKeys = new Set();
  for (const { a, b, c } of inner) {
    for (const [u, v] of [[a, b], [b, c], [c, a]]) linkKeys.add(u < v ? u * span + v : v * span + u);
  }
  const links = [...linkKeys].map((key) => [Math.floor(key / span), key % span])
    .sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return { triangles: inner.map(({ a, b, c }) => [a, b, c]), links };
}

/** Each node's neighbours, ascending, from the links. */
export function neighbourLists(count, links) {
  const lists = Array.from({ length: count }, () => []);
  for (const [a, b] of links) {
    lists[a].push(b);
    lists[b].push(a);
  }
  return lists.map((list) => Int32Array.from(list.sort((p, q) => p - q)));
}

/**
 * Exact hearing: every node reads all of its neighbours' states and takes the majority, all
 * nodes at once; a tie keeps the node's own state. The vote is 2 * (neighbours for minus
 * neighbours against) + (the node's own, counted as 1 or -1): an odd integer, never zero,
 * so the rule is a threshold function with the symmetric weights A + I/2 and no tie-break
 * outside the weights.
 */
export function exactStep(state, neighbours) {
  const next = new Uint8Array(state.length);
  for (let i = 0; i < state.length; i += 1) {
    const list = neighbours[i];
    let ones = 0;
    for (let k = 0; k < list.length; k += 1) ones += state[list[k]];
    const vote = 2 * (2 * ones - list.length) + (state[i] === 1 ? 1 : -1);
    next[i] = vote > 0 ? 1 : 0;
  }
  return next;
}

/**
 * Faulty hearing, one sweep: the nodes in a random order, each taking the current state of
 * one neighbour chosen uniformly at random -- the state as it stands when the node's turn
 * comes, so a voice already changed in this sweep is what is heard. `heard[i]` records the
 * neighbour node i heard. The state is changed in place.
 */
export function voterSweep(state, neighbours, random, heard) {
  const count = state.length;
  const order = new Int32Array(count);
  for (let i = 0; i < count; i += 1) order[i] = i;
  for (let i = count - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  for (let k = 0; k < count; k += 1) {
    const i = order[k];
    const list = neighbours[i];
    const speaker = list[Math.floor(random() * list.length)];
    heard[i] = speaker;
    state[i] = state[speaker];
  }
  return state;
}

export function isUnanimous(state) {
  for (let i = 1; i < state.length; i += 1) if (state[i] !== state[0]) return false;
  return true;
}

export function sameState(p, q) {
  if (p.length !== q.length) return false;
  for (let i = 0; i < p.length; i += 1) if (p[i] !== q[i]) return false;
  return true;
}

/** FNV-1a over the states, a 32-bit integer: the same state is the same number everywhere. */
export function hashState(state) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < state.length; i += 1) {
    hash ^= state[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The first step t0 from which exact hearing repeats with period one or two: s(t0 + 2)
 * equals s(t0). The rule is a deterministic function F of the state, so this one equality
 * settles every later step: s(t0 + 3) = F(s(t0 + 2)) = F(s(t0)) = s(t0 + 1), and so on.
 */
export function periodStart(initial, neighbours, limit = 100000) {
  let s0 = initial;
  let s1 = exactStep(s0, neighbours);
  let s2 = exactStep(s1, neighbours);
  let t = 0;
  while (!sameState(s2, s0)) {
    if (t >= limit) throw new Error(`exact hearing has not settled within ${limit} steps`);
    s0 = s1;
    s1 = s2;
    s2 = exactStep(s1, neighbours);
    t += 1;
  }
  return { t0: t, cycle: [s0, s1] };
}

/** The nodes, the links, the start, and the generator left where the layout left it. */
export function buildWorld({ seed = SEED, spacing = SPACING } = {}) {
  const random = createRandom(seed);
  const nodes = poissonDisc(random, spacing, CENTRE, FIELD_RADIUS);
  const { triangles, links } = delaunay(nodes);
  const neighbours = neighbourLists(nodes.length, links);
  const initial = new Uint8Array(nodes.length);
  for (let i = 0; i < nodes.length; i += 1) initial[i] = random() < 0.5 ? 1 : 0;
  return { seed, spacing, nodes, triangles, links, neighbours, initial, random };
}

/**
 * Every frame of the clip, from the world: the state shown, the neighbour each node heard
 * (act two only), and for each node the frames since it last changed its mind. Act one
 * shows one exact step every ACT_ONE_STEP_FRAMES frames; act two runs SWEEPS_PER_FRAME
 * sweeps of faulty hearing between frames, and goes on sweeping after unanimity, which
 * changes nothing.
 */
export function buildHistory(world, { sweepsPerFrame = SWEEPS_PER_FRAME, totalFrames = TOTAL_FRAMES } = {}) {
  const count = world.nodes.length;
  const actOne = [world.initial];
  for (let step = 1; step < ACT_ONE_STEPS; step += 1) actOne.push(exactStep(actOne[step - 1], world.neighbours));
  const states = new Array(totalFrames);
  const heard = new Array(totalFrames);
  const pulse = new Array(totalFrames);
  const lastChange = new Int32Array(count).fill(-1000);
  let state = actOne[0];
  let previous = null;
  let sweeps = 0;
  let consensusSweep = null;
  let landingFrame = null;
  for (let frame = 0; frame < totalFrames; frame += 1) {
    let heardNow = null;
    if (frame < ACT_ONE_FRAMES) {
      state = actOne[Math.floor(frame / ACT_ONE_STEP_FRAMES)];
    } else {
      state = Uint8Array.from(state);
      heardNow = new Uint16Array(count);
      for (let k = 0; k < sweepsPerFrame; k += 1) {
        voterSweep(state, world.neighbours, world.random, heardNow);
        sweeps += 1;
        if (consensusSweep === null && isUnanimous(state)) consensusSweep = sweeps;
      }
      if (landingFrame === null && consensusSweep !== null) landingFrame = frame;
    }
    const ages = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) {
      if (previous !== null && state[i] !== previous[i]) lastChange[i] = frame;
      ages[i] = Math.min(255, frame - lastChange[i]);
    }
    states[frame] = state;
    heard[frame] = heardNow;
    pulse[frame] = ages;
    previous = state;
  }
  return { actOne, states, heard, pulse, sweeps, consensusSweep, landingFrame };
}

export const WORLD = buildWorld();
export const HISTORY = buildHistory(WORLD);
export const NODE_COUNT = WORLD.nodes.length;
export const LINK_COUNT = WORLD.links.length;

export const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));

/** The frame the page shows `elapsedSeconds` after it began: the clock's frame, then the last. */
export function pageFrame(elapsedSeconds) {
  return clamp(Math.floor(elapsedSeconds * PLAYBACK_FPS), 0, TOTAL_FRAMES - 1);
}

/** What frame `frameIndex` shows, read from the history: nothing here depends on the frames read before it. */
export function sceneAt(frameIndex) {
  const frame = clamp(Math.floor(frameIndex), 0, TOTAL_FRAMES - 1);
  const actOne = frame < ACT_ONE_FRAMES;
  const state = HISTORY.states[frame];
  return {
    frameIndex: frame,
    totalFrames: TOTAL_FRAMES,
    seconds: frame / PLAYBACK_FPS,
    act: actOne ? 1 : 2,
    step: actOne ? Math.floor(frame / ACT_ONE_STEP_FRAMES) : null,
    sweeps: actOne ? 0 : (frame - ACT_ONE_FRAMES + 1) * SWEEPS_PER_FRAME,
    state,
    heard: HISTORY.heard[frame],
    pulse: HISTORY.pulse[frame],
    unanimous: HISTORY.landingFrame !== null && frame >= HISTORY.landingFrame,
    held: HISTORY.landingFrame !== null && frame >= HISTORY.landingFrame
  };
}
