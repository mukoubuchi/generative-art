/**
 * A maze that is a spanning tree, built by erasing the walk's own loops.
 *
 * Wilson's algorithm grows a uniform spanning tree of the grid one branch at a time. A
 * cell outside the tree is chosen and a walk sets off from it at random. Whenever the
 * walk arrives at a cell already on its own trail, everything it did since that cell is
 * erased and it goes on from there as if the detour had never happened. When the walk
 * finally reaches the tree, what is left of it — the part that survived erasure — is
 * grafted on, and the next cell outside the tree begins again.
 *
 * What that leaves is a maze with no loop anywhere in it and no cell left out, so
 * between any two cells there is exactly one route. The tangle is as large as the grid
 * and the route is not chosen at the end: it was settled the moment the last loop went.
 *
 * `erasePath` is the whole rule, and it is written once. `buildMoves` runs the algorithm
 * and records nothing but the cells the walk stepped to; `replay` reads that record back
 * through `erasePath` to recover any moment of the build. The picture is a replay, so it
 * cannot show a maze the rule did not make.
 */

import { mulberry32 } from "../shared/random.js";

export const COLUMNS = 30;
export const ROWS = 20;
export const CELL_COUNT = COLUMNS * ROWS;

/** One seed, fixed, so the maze on the page is the maze the tests measure. */
export const SEED = 1734;

export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 10;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/** Seven seconds of building, then the finished maze alone, then the route through it. */
export const BUILD_FRAMES = 210;
export const HOLD_FRAMES = 18;
export const ROUTE_FRAMES = 54;

/**
 * How long an erased branch goes on glowing, counted in moves rather than in frames. The
 * clip does not advance the record at a constant rate (see `movesAt`), so a life measured
 * in moves is short where the walk is racing and many loops are dying at once, and long
 * where it has slowed to a few branches — which is the balance a fixed number of frames
 * would get wrong at both ends.
 */
export const EMBER_MOVES = 240;

/** The two cells the closing route runs between: opposite corners of the grid. */
export const ROUTE_ENDS = [0, CELL_COUNT - 1];

export function columnOf(cell) {
  return cell % COLUMNS;
}

export function rowOf(cell) {
  return Math.floor(cell / COLUMNS);
}

export function cellAt(column, row) {
  if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) {
    throw new RangeError(`(${column}, ${row}) is off the grid`);
  }
  return row * COLUMNS + column;
}

/** The cells one step away, in a fixed order, so a seed names one maze and not several. */
export function neighbours(cell) {
  const column = columnOf(cell);
  const row = rowOf(cell);
  const found = [];
  if (row > 0) {
    found.push(cell - COLUMNS);
  }
  if (column > 0) {
    found.push(cell - 1);
  }
  if (column < COLUMNS - 1) {
    found.push(cell + 1);
  }
  if (row < ROWS - 1) {
    found.push(cell + COLUMNS);
  }
  return found;
}

/**
 * The loop erasure, on its own. Stepping to a cell the walk has not been to lengthens the
 * trail; stepping to one it has been to cuts the trail back to that visit, which throws
 * away the loop entire rather than retracing it. This is the only thing that keeps a
 * random walk from leaving cycles behind, and it is why the finished maze has none.
 */
export function erasePath(path, cell) {
  const seen = path.indexOf(cell);
  return seen === -1 ? [...path, cell] : path.slice(0, seen + 1);
}

/**
 * Wilson's algorithm, recorded as the moves it made. Nothing about erasure is stored:
 * a move is the cell the walk stepped to, and reading the record back through
 * `erasePath` is what recovers the trail.
 */
export function buildMoves(seed = SEED) {
  const random = mulberry32(seed);
  const inTree = new Uint8Array(CELL_COUNT);
  const root = cellAt(COLUMNS >> 1, ROWS >> 1);
  const moves = [{ kind: "root", cell: root }];
  inTree[root] = 1;

  for (let start = 0; start < CELL_COUNT; start += 1) {
    if (inTree[start]) {
      continue;
    }
    moves.push({ kind: "open", cell: start });
    let path = [start];
    while (!inTree[path[path.length - 1]]) {
      const options = neighbours(path[path.length - 1]);
      const cell = options[Math.floor(random() * options.length)];
      moves.push({ kind: "move", cell });
      path = erasePath(path, cell);
    }
    moves.push({ kind: "graft" });
    for (const cell of path) {
      inTree[cell] = 1;
    }
  }
  return moves;
}

/**
 * The build as it stood after `count` moves: the maze so far, the walk still out, and the
 * branches erased recently enough to be still glowing. The trail is recomputed by the
 * rule rather than looked up, so a picture drawn from this is a picture of the rule.
 */
export function replay(moves, count) {
  const limit = Math.max(0, Math.min(count, moves.length));
  const inTree = new Set();
  const edges = [];
  const embers = [];
  let path = [];

  for (let index = 0; index < limit; index += 1) {
    const move = moves[index];
    if (move.kind === "root") {
      inTree.add(move.cell);
    } else if (move.kind === "open") {
      path = [move.cell];
    } else if (move.kind === "move") {
      const kept = erasePath(path, move.cell);
      if (kept.length <= path.length) {
        // The loop that was cut, drawn from where it left the surviving trail so that it
        // dies as the shape it was rather than as a scatter of cells.
        embers.push({ cells: path.slice(kept.length - 1).concat(move.cell), at: index });
      }
      path = kept;
    } else {
      for (let step = 0; step + 1 < path.length; step += 1) {
        edges.push([path[step], path[step + 1]]);
      }
      for (const cell of path) {
        inTree.add(cell);
      }
      path = [];
    }
  }
  return {
    edges,
    path,
    inTree,
    moves: limit,
    embers: embers.filter((ember) => ember.at > limit - EMBER_MOVES)
  };
}

/** Every cell's neighbours in the finished maze, which is what makes a route findable. */
export function adjacency(edges) {
  const links = new Map();
  for (const [from, to] of edges) {
    if (!links.has(from)) {
      links.set(from, []);
    }
    if (!links.has(to)) {
      links.set(to, []);
    }
    links.get(from).push(to);
    links.get(to).push(from);
  }
  return links;
}

/**
 * The route between two cells. In a tree there is exactly one, so this walks out from the
 * far end and reads the way back rather than searching for a short way among many.
 */
export function routeBetween(edges, from, to) {
  const links = adjacency(edges);
  const cameFrom = new Map([[from, -1]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    if (cell === to) {
      const route = [];
      for (let step = cell; step !== -1; step = cameFrom.get(step)) {
        route.push(step);
      }
      return route.reverse();
    }
    for (const next of links.get(cell) ?? []) {
      if (!cameFrom.has(next)) {
        cameFrom.set(next, cell);
        queue.push(next);
      }
    }
  }
  throw new Error(`no route from ${from} to ${to}`);
}

/**
 * How many frames the first walk gets. The pacing is in two parts and the reason is in
 * the algorithm rather than in taste. The first walk sets out with a single cell to find
 * and takes nearly half of all the moves to find it, and until it does there is no maze
 * on the page at all; the hundreds of walks after it are mostly two or three moves long.
 * Given one rate the opening would be five seconds of an empty grid. So the first walk is
 * played fast and the rest of the record slowly, and the tempo changes at the moment the
 * first branch appears, which is a moment the picture already marks.
 *
 * Both parts run at a constant rate, and the moves are the moves the algorithm made, in
 * the order it made them. What is chosen here is which part of the record gets which part
 * of the ten seconds, and nothing else.
 */
export const FIRST_WALK_FRAMES = 45;

/** The two lengths a frame needs to place itself in the record. */
export function pacingOf(moves) {
  const firstGraft = moves.findIndex((move) => move.kind === "graft") + 1;
  if (firstGraft === 0) {
    throw new Error("the record has no graft in it");
  }
  return { total: moves.length, firstGraft };
}

/** How far into the record a frame stands. The last building frame lands on the end. */
export function movesAt(frameIndex, pacing) {
  const wrapped = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  const { total, firstGraft } = pacing;
  if (wrapped >= BUILD_FRAMES - 1) {
    return total;
  }
  if (wrapped <= FIRST_WALK_FRAMES) {
    return Math.round((wrapped / FIRST_WALK_FRAMES) * firstGraft);
  }
  const along = (wrapped - FIRST_WALK_FRAMES) / (BUILD_FRAMES - 1 - FIRST_WALK_FRAMES);
  return firstGraft + Math.round(along * (total - firstGraft));
}

/**
 * The clock the embers age by. It follows the record while the maze is being built, and
 * then goes on running through the hold so that the loops cut in the last moves finish
 * dying instead of freezing where they were. By the time the route is lit there is no
 * ember left anywhere: what was spent has gone out, and what stands is the plan.
 */
export function emberClockAt(frameIndex, pacing) {
  const wrapped = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  const built = BUILD_FRAMES - 1;
  if (wrapped <= built) {
    return movesAt(frameIndex, pacing);
  }
  return pacing.total + ((wrapped - built) / HOLD_FRAMES) * EMBER_MOVES;
}

/** How much of the closing route is lit: none while the maze is still being made. */
export function routeLitAt(frameIndex) {
  const wrapped = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  const begins = BUILD_FRAMES + HOLD_FRAMES;
  if (wrapped < begins) {
    return 0;
  }
  return Math.min(1, (wrapped - begins + 1) / ROUTE_FRAMES);
}
