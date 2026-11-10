import { mulberry32 } from "../shared/random.js";

export const SIZE = 680;
export const FPS = 30;
export const DURATION = 24;
export const FRAMES = FPS * DURATION;
// Truchet Tides' paper and ink, laid flat.
export const PAPER = [230, 224, 208];
export const INK = [38, 52, 74];

/** The sheet is a lattice of cells; a cell is bare or holds one speck of ink. */
export const PITCH = 2;
export const COLUMNS = SIZE / PITCH;
export const ROWS = SIZE / PITCH;
export const CELLS = COLUMNS * ROWS;
/** Radius of the speck a cell value stands for; zero is bare paper. */
export const DOT_RADII = [0, 0.8, 1.15, 1.6];
const DOT_SHARES = [0.07, 0.035, 0.015];
export const PAPER_SEED = 20261110;

/**
 * The sheet before anything moves: one draw of a seeded generator for each cell, every
 * cell from the same distribution. Nothing here knows where a flower will be, and nothing
 * may look at a neighbouring cell: a sheet with spacing in it would show a seam wherever
 * its cells were later rearranged.
 */
export function makePaper(seed = PAPER_SEED) {
  const random = mulberry32(seed);
  const paper = new Uint8Array(CELLS);
  const small = DOT_SHARES[0], medium = small + DOT_SHARES[1], large = medium + DOT_SHARES[2];
  for (let cell = 0; cell < CELLS; cell++) {
    const draw = random();
    paper[cell] = draw < small ? 1 : draw < medium ? 2 : draw < large ? 3 : 0;
  }
  return paper;
}

/**
 * The recorded hold: the clip stops its own clock here, as a held key stops the page's.
 *
 * It begins on frame 250 because that is where the encoder next starts a picture from
 * nothing. Between such pictures a clip is stored as changes, and the cells that have been
 * moving come out of it measurably unlike the cells that have not; a hold begun at frame
 * 180 kept that difference for as long as it lasted.
 */
export const HOLD = { from: 250, to: 310 };
export const CLOCK_FRAMES = FRAMES - (HOLD.to - HOLD.from);

/** The artwork's clock at a frame of the clip. It stands still through the recorded hold. */
export function clockFrame(frame) {
  const wrapped = ((frame % FRAMES) + FRAMES) % FRAMES;
  if (wrapped < HOLD.from) return wrapped;
  return wrapped < HOLD.to ? HOLD.from : wrapped - (HOLD.to - HOLD.from);
}

export const pageFrame = (seconds) => Math.floor(Math.max(0, seconds) * FPS) % FRAMES;

export function frameState(frame, held = false) {
  const wrapped = ((frame % FRAMES) + FRAMES) % FRAMES;
  const recorded = wrapped >= HOLD.from && wrapped < HOLD.to;
  return { clock: clockFrame(wrapped), recorded, stopped: recorded || held };
}

/** Frames a petal takes to reach its full speed from rest, and to come to rest again. */
export const RAMP = 24;

/**
 * Unit vectors at equal turns, the first pointing up the canvas. They are written out
 * rather than computed so that every machine places every petal on the same cells: from
 * here on the geometry uses only sums, products, quotients and square roots, which round
 * the same way everywhere.
 */
const FIFTHS = [
  [0, -1],
  [0.9510565162951535, -0.3090169943749474],
  [0.5877852522924731, 0.8090169943749475],
  [-0.5877852522924731, 0.8090169943749475],
  [-0.9510565162951535, -0.3090169943749474]
];
const THIRTEENTHS = [
  [0, -1],
  [0.4647231720437686, -0.8854560256532098],
  [0.8229838658936564, -0.5680647467311558],
  [0.992708874098054, -0.12053668025532295],
  [0.9350162426854148, 0.3546048870425355],
  [0.6631226582407951, 0.7485107481711012],
  [0.23931566428755763, 0.970941817426052],
  [-0.23931566428755763, 0.970941817426052],
  [-0.6631226582407951, 0.7485107481711012],
  [-0.9350162426854148, 0.3546048870425355],
  [-0.992708874098054, -0.12053668025532295],
  [-0.8229838658936564, -0.5680647467311558],
  [-0.4647231720437686, -0.8854560256532098]
];

/**
 * Two flowers for one sheet. Lengths are fractions of the flower's radius.
 *
 * `stride` is the phyllotactic step in which the petals set off: two fifths of a turn for
 * the five petals of the cherry, five thirteenths for the thirteen rays of the
 * chrysanthemum. `steps` is how many cells a speck travels in an axis-parallel line while
 * its petal is open, and `focus` is the point on the petal's axis the flow fans out from,
 * measured from the flower's centre (negative: behind it).
 */
export const FLOWERS = [
  {
    name: "cherry", centre: [322, 318], radius: 226, axes: FIFTHS, stride: 2, twist: -0.1,
    begins: 30, lag: 12, steps: 264,
    base: 0.085, halfWidth: 0.36, claw: 0.75, norm: 2.3192980697614507, focus: -0.45,
    notch: { depth: 0.085, half: 0.062 }, jitter: 0.045
  },
  {
    name: "chrysanthemum", centre: [368, 352], radius: 232, axes: THIRTEENTHS, stride: 5,
    twist: 0.07, begins: 396, lag: 4, steps: 168,
    base: 0.17, halfWidth: 0.14, claw: 1, norm: 2.598076211353316, focus: -2,
    notch: null, jitter: 0.04
  }
];
export const GEOMETRY_SEED = 1418;

/**
 * Half the petal's width at a fraction t of its length, as a share of its greatest: a claw
 * that widens as a power of t, and a round far end. The power is one or three quarters,
 * the two that square roots alone can give; `norm` is one over the curve's own maximum.
 */
function outline(flower, t) {
  const rise = flower.claw === 1 ? t : Math.sqrt(t * Math.sqrt(t));
  return flower.norm * rise * Math.sqrt(1 - t);
}

/**
 * The petals of one flower, each with its own axis, reach and width. No two living petals
 * are alike, so each is turned and scaled a little from the regular figure; the turn is
 * applied as a rational rotation to stay within exactly rounded arithmetic.
 */
function makePetals(flower, random) {
  const [cx, cy] = flower.centre;
  const count = flower.axes.length;
  const rank = new Array(count);
  for (let n = 0; n < count; n++) rank[(n * flower.stride) % count] = n;
  return flower.axes.map(([ax, ay], index) => {
    const half = (flower.twist + (random() - 0.5) * flower.jitter) / 2;
    const cos = (1 - half * half) / (1 + half * half), sin = 2 * half / (1 + half * half);
    const ux = ax * cos - ay * sin, uy = ay * cos + ax * sin;
    const reach = flower.radius * (1 + (random() - 0.6) * 2 * flower.jitter);
    const width = flower.radius * flower.halfWidth * (1 + (random() - 0.5) * 2 * flower.jitter);
    const root = flower.radius * flower.base;
    return {
      index, ux, uy, reach, width, root,
      focus: [cx + ux * flower.focus * flower.radius, cy + uy * flower.focus * flower.radius],
      begins: flower.begins + flower.lag * rank[index],
      contains(x, y) {
        const qx = x - cx, qy = y - cy;
        const along = qx * ux + qy * uy, across = Math.abs(qy * ux - qx * uy);
        if (along <= root || along >= reach) return false;
        if (across >= width * outline(flower, (along - root) / (reach - root))) return false;
        if (flower.notch) {
          const half = flower.notch.half * reach, depth = flower.notch.depth * reach;
          if (across < half && along > reach - depth * (1 - across / half)) return false;
        }
        return true;
      }
    };
  });
}

/** Cells of bare paper kept between a petal and any other petal's cells, on each side. */
export const SEAM = 2;

/**
 * Which petal, if any, each cell belongs to. Where two petals would touch or lie close,
 * the cells of both along the seam are returned to the paper, so neighbouring petals never
 * share an edge: what separates them is a strip that does not move.
 */
function assignCells(petals) {
  const raw = new Int16Array(CELLS).fill(-1);
  for (let row = 0; row < ROWS; row++) for (let column = 0; column < COLUMNS; column++) {
    const x = (column + 0.5) * PITCH, y = (row + 0.5) * PITCH;
    for (const petal of petals) if (petal.contains(x, y)) { raw[row * COLUMNS + column] = petal.index; break; }
  }
  const owner = raw.slice();
  for (let row = 0; row < ROWS; row++) for (let column = 0; column < COLUMNS; column++) {
    const own = raw[row * COLUMNS + column];
    if (own < 0) continue;
    for (let dy = -SEAM; dy <= SEAM; dy++) for (let dx = -SEAM; dx <= SEAM; dx++) {
      const r = row + dy, c = column + dx;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLUMNS) continue;
      const other = raw[r * COLUMNS + c];
      if (other >= 0 && other !== own) owner[row * COLUMNS + column] = -1;
    }
  }
  return owner;
}

/**
 * Covers one petal with lines running away from its focus. Each line is a chain of cells,
 * one in each lattice row it crosses (or column, for a petal that lies nearer the
 * horizontal); every cell of the petal lies on exactly one line.
 *
 * A row is carried onto the next by the central projection from the focus, rounded with
 * one offset for the whole row. The projection spreads neighbouring cells more than one
 * cell apart, so no two cells of a row round to the same cell of the next: the step is
 * one-to-one without any bookkeeping. The offset changes from row to row by the golden
 * section, which makes every line take its sideways steps as evenly as a line of its
 * slope can, instead of never taking the ones smaller than half a cell.
 */
function traceLines(petal, owner) {
  const upright = Math.abs(petal.uy) >= Math.abs(petal.ux);
  const sense = (upright ? petal.uy : petal.ux) > 0 ? 1 : -1;
  const focusAlong = (upright ? petal.focus[1] : petal.focus[0]) / PITCH;
  const focusAcross = (upright ? petal.focus[0] : petal.focus[1]) / PITCH;
  const spanAcross = upright ? COLUMNS : ROWS, spanAlong = upright ? ROWS : COLUMNS;
  const cellAt = (across, along) => upright ? along * COLUMNS + across : across * COLUMNS + along;
  const next = new Int32Array(CELLS).fill(-1);
  const entered = new Uint8Array(CELLS);
  const mine = [];
  for (let cell = 0; cell < CELLS; cell++) if (owner[cell] === petal.index) {
    mine.push(cell);
    const column = cell % COLUMNS, row = Math.floor(cell / COLUMNS);
    const across = upright ? column : row, along = upright ? row : column;
    const distance = sense * (along + 0.5 - focusAlong);
    if (distance <= 0) throw new Error("a petal reaches behind its own focus");
    const onward = along + sense;
    if (onward < 0 || onward >= spanAlong) continue;
    const dither = onward * 0.6180339887498949;
    const landed = Math.floor(focusAcross + (across + 0.5 - focusAcross) * (distance + 1) / distance
      + dither - Math.floor(dither) - 0.5);
    if (landed < 0 || landed >= spanAcross) continue;
    const target = cellAt(landed, onward);
    if (owner[target] !== petal.index) continue;
    if (entered[target]) throw new Error("two cells of one row were carried onto one cell");
    next[cell] = target;
    entered[target] = 1;
  }
  const lines = [];
  for (const cell of mine) {
    if (entered[cell]) continue;
    const line = [];
    for (let at = cell; at !== -1; at = next[at]) line.push(at);
    lines.push(line);
  }
  return lines;
}

function divisors(total) {
  const found = [];
  for (let d = total; d >= 1; d--) if (total % d === 0) found.push(d);
  return found;
}

/** Whole numbers of steps a line may take in all: those with at least twelve divisors. */
function totalsFor(steps) {
  const totals = [];
  for (let total = Math.ceil(0.4 * steps); total <= steps; total++) {
    if (divisors(total).length >= 12) totals.push(total);
  }
  return totals;
}

/**
 * How a line of `length` cells is cut into loops whose lengths all divide `total`, with as
 * few short loops as can be managed, and what the cut costs. A loop that has gone round a
 * whole number of times has every speck back where it started, which is what returns the
 * sheet to itself.
 */
const cuts = new Map();
function cutLengths(total, length) {
  if (!cuts.has(total)) cuts.set(total, { parts: divisors(total), cost: [0], choice: [0] });
  const { parts, cost, choice } = cuts.get(total);
  for (let n = cost.length; n <= length; n++) {
    let best = Infinity, pick = 1;
    for (const part of parts) {
      if (part > n) continue;
      const price = cost[n - part] + 1 + (part < 12 ? 1000 : 0) + (part < 4 ? 100000 : 0);
      if (price < best) { best = price; pick = part; }
    }
    cost[n] = best; choice[n] = pick;
  }
  const lengths = [];
  for (let n = length; n > 0; n -= choice[n]) lengths.push(choice[n]);
  return { lengths, cost: cost[length] };
}

/**
 * Everything that moves, worked out once: for each flower the cells of each petal, and the
 * loops its specks travel. None of it is given the sheet.
 *
 * A lattice step that also moves sideways is longer than one that does not, so a line is
 * given fewer steps the more it slants, and the specks cross the canvas at one speed
 * whichever way their petal points.
 */
export function makeBloom(seed = GEOMETRY_SEED) {
  const flowers = FLOWERS.map((flower, index) => {
    // One generator for the petals' shapes and one for where the lines are cut, per
    // flower, so that neither flower's figure depends on the other's bookkeeping.
    const petals = makePetals(flower, mulberry32(seed + 2 * index));
    const random = mulberry32(seed + 2 * index + 1);
    const owner = assignCells(petals);
    const totals = totalsFor(flower.steps);
    const loops = [];
    for (const petal of petals) for (const line of traceLines(petal, owner)) {
      let travelled = 0;
      for (let i = 1; i < line.length; i++) {
        const dc = (line[i] % COLUMNS) - (line[i - 1] % COLUMNS);
        const dr = Math.floor(line[i] / COLUMNS) - Math.floor(line[i - 1] / COLUMNS);
        travelled += Math.sqrt(dc * dc + dr * dr);
      }
      const wanted = line.length > 1 ? flower.steps * (line.length - 1) / travelled : flower.steps;
      // Among the totals within a thirtieth of the wanted speed, the one that cuts best.
      let total = totals[0];
      for (const candidate of totals) {
        if (Math.abs(candidate - wanted) <= Math.abs(total - wanted)) total = candidate;
      }
      for (const candidate of totals) {
        if (Math.abs(candidate - wanted) * 30 > flower.steps) continue;
        if (cutLengths(candidate, line.length).cost < cutLengths(total, line.length).cost) total = candidate;
      }
      // The cuts fall at different places along neighbouring lines.
      const { lengths } = cutLengths(total, line.length);
      for (let i = lengths.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [lengths[i], lengths[j]] = [lengths[j], lengths[i]];
      }
      let from = 0;
      for (const length of lengths) {
        if (length > 1) {
          // A phase of its own for every loop: loops slower than a step a frame must stand
          // still now and then, and with one phase they would all stand still together.
          const phase = Math.floor(random() * 4 * RAMP * flower.steps);
          loops.push({ cells: Int32Array.from(line.slice(from, from + length)), total, phase, petal: petal.index });
        }
        from += length;
      }
    }
    return { ...flower, petals, owner, loops };
  });
  return { flowers };
}

/**
 * How many steps a loop has taken by a moment of the clock, in whole numbers throughout.
 *
 * A petal gathers speed evenly over RAMP frames, holds it, and loses it as evenly, so the
 * distance covered is a square, then a line, then a square again; the loop's `total`
 * scales it and the loop's `phase` settles in which frames the whole steps fall. The
 * division is integer division, never more than one step is taken in a frame, and the
 * last value is `total` exactly.
 */
export function stepsTaken(flower, petal, loop, clock) {
  const cruise = flower.steps - RAMP, span = 2 * RAMP + cruise;
  const elapsed = Math.max(0, Math.min(span, clock - petal.begins));
  const whole = 2 * RAMP * flower.steps;
  const covered = elapsed <= RAMP ? elapsed * elapsed
    : elapsed <= RAMP + cruise ? RAMP * RAMP + 2 * RAMP * (elapsed - RAMP)
      : whole - (span - elapsed) * (span - elapsed);
  return Math.floor((2 * loop.total * covered + loop.phase) / (2 * whole));
}

/**
 * Where each cell's speck comes from at a frame: `source[cell]` is the cell of the first
 * sheet whose value is shown there. The sheet itself is not an argument.
 */
export function sourceMap(bloom, frame, source = new Int32Array(CELLS)) {
  const clock = clockFrame(frame);
  for (let cell = 0; cell < CELLS; cell++) source[cell] = cell;
  for (const flower of bloom.flowers) for (const loop of flower.loops) {
    const length = loop.cells.length;
    const shift = stepsTaken(flower, flower.petals[loop.petal], loop, clock) % length;
    if (shift === 0) continue;
    for (let i = 0; i < length; i++) {
      source[loop.cells[i]] = loop.cells[(i - shift + length) % length];
    }
  }
  return source;
}

/** The sheet as it stands at a frame: the first sheet, read through the frame's map. */
export function frameSheet(bloom, paper, frame, sheet = new Uint8Array(CELLS), source) {
  const map = sourceMap(bloom, frame, source);
  for (let cell = 0; cell < CELLS; cell++) sheet[cell] = paper[map[cell]];
  return sheet;
}
