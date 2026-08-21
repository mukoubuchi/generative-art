import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BUILD_FRAMES,
  CELL_COUNT,
  COLUMNS,
  DURATION_SECONDS,
  EMBER_MOVES,
  FIRST_WALK_FRAMES,
  HOLD_FRAMES,
  PLAYBACK_FPS,
  ROUTE_ENDS,
  ROUTE_FRAMES,
  ROWS,
  SEED,
  TOTAL_FRAMES,
  adjacency,
  buildMoves,
  cellAt,
  columnOf,
  emberClockAt,
  erasePath,
  movesAt,
  neighbours,
  pacingOf,
  replay,
  routeBetween,
  routeLitAt,
  rowOf
} from "../artworks/not-without-a-plan/not-without-a-plan.js";

const MODULE = readFileSync(
  new URL("../artworks/not-without-a-plan/not-without-a-plan.js", import.meta.url),
  "utf8"
);
const SKETCH = readFileSync(
  new URL("../artworks/not-without-a-plan/sketch.js", import.meta.url),
  "utf8"
);

const MOVES = buildMoves();
const PACING = pacingOf(MOVES);
const MAZE = replay(MOVES, MOVES.length);
const ROUTE = routeBetween(MAZE.edges, ...ROUTE_ENDS);

/** Do these edges reach every cell of the grid from one of them? */
function reachedFrom(edges, start) {
  const links = adjacency(edges);
  const seen = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    for (const next of links.get(queue[head]) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** Do these edges close a cycle anywhere? Union-find says so the moment two ends meet. */
function hasCycle(edges) {
  const parent = new Map();
  const find = (cell) => {
    while (parent.get(cell) !== cell) {
      parent.set(cell, parent.get(parent.get(cell)));
      cell = parent.get(cell);
    }
    return cell;
  };
  for (const [from, to] of edges) {
    for (const cell of [from, to]) {
      if (!parent.has(cell)) {
        parent.set(cell, cell);
      }
    }
    const left = find(from);
    const right = find(to);
    if (left === right) {
      return true;
    }
    parent.set(left, right);
  }
  return false;
}

test("the maze is a spanning tree: it reaches every cell, closes no loop, and is held together", () => {
  // The scan must be scanning something: an empty edge list passes every clause below.
  assert.equal(CELL_COUNT, COLUMNS * ROWS);
  assert.equal(CELL_COUNT, 600);
  assert.ok(MAZE.edges.length > 0);

  // Covering. Every cell of the grid is in the maze, counted rather than sampled.
  assert.equal(MAZE.inTree.size, CELL_COUNT);
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    assert.ok(MAZE.inTree.has(cell), `cell ${cell} was left out of the maze`);
  }

  // Connected. One cell reaches all of them along corridors.
  assert.equal(reachedFrom(MAZE.edges, 0).size, CELL_COUNT);

  // Acyclic, and with exactly the edge count a tree on this many cells must have.
  assert.equal(hasCycle(MAZE.edges), false);
  assert.equal(MAZE.edges.length, CELL_COUNT - 1);

  // Controls, one for each clause, constructed rather than frozen from a defect: this
  // artwork has not shipped a broken maze. Drop a corridor and the maze falls in two;
  // add one back somewhere else and it closes a loop. Either mutation leaves the other
  // two clauses satisfied, so no clause here is carrying no weight.
  const short = MAZE.edges.slice(0, -1);
  assert.ok(reachedFrom(short, 0).size < CELL_COUNT, "a maze missing a corridor is in pieces");
  assert.equal(hasCycle(short), false);

  const [nearby] = neighbours(ROUTE[1]).filter(
    (cell) => cell !== ROUTE[0] && cell !== ROUTE[2]
  );
  const looped = [...MAZE.edges, [ROUTE[1], nearby]];
  assert.equal(hasCycle(looped), true, "an extra corridor between two cells closes a loop");
  assert.equal(reachedFrom(looped, 0).size, CELL_COUNT);
});

test("every corridor is one step of the grid", () => {
  assert.ok(MAZE.edges.length >= 599);
  for (const [from, to] of MAZE.edges) {
    const apart =
      Math.abs(columnOf(from) - columnOf(to)) + Math.abs(rowOf(from) - rowOf(to));
    assert.equal(apart, 1, `${from} and ${to} are not neighbours`);
    assert.ok(neighbours(from).includes(to));
  }
  // And the grid's own edges have no wrap in them: the last cell of a row is not the
  // neighbour of the first cell of the next.
  assert.equal(neighbours(cellAt(COLUMNS - 1, 0)).includes(cellAt(0, 1)), false);
  assert.deepEqual(neighbours(cellAt(0, 0)).sort((a, b) => a - b), [1, COLUMNS]);
  assert.equal(neighbours(cellAt(1, 1)).length, 4);
});

test("the erasure rule throws the loop away whole", () => {
  // Somewhere new lengthens the trail.
  assert.deepEqual(erasePath([4, 5, 6], 7), [4, 5, 6, 7]);
  // Somewhere the trail has been cuts it back to that visit, and everything the walk did
  // in between goes: not retraced, not marked, gone.
  assert.deepEqual(erasePath([4, 5, 6, 7, 8], 5), [4, 5]);
  // Including the degenerate loop of standing still.
  assert.deepEqual(erasePath([4, 5, 6], 6), [4, 5, 6]);
  // The trail it is given is never modified, which is what lets a frame be replayed.
  const before = [4, 5, 6];
  erasePath(before, 5);
  assert.deepEqual(before, [4, 5, 6]);
});

test("no trail in the whole record ever holds a cell twice", () => {
  // The claim the maze's acyclicity rests on, measured on the record itself rather than
  // on the finished maze: the rule is what keeps a loop from being grafted in.
  let path = [];
  let erasures = 0;
  let longest = 0;
  for (const move of MOVES) {
    if (move.kind === "open") {
      path = [move.cell];
    } else if (move.kind === "move") {
      const kept = erasePath(path, move.cell);
      if (kept.length <= path.length) {
        erasures += 1;
      }
      path = kept;
      assert.equal(new Set(path).size, path.length, "a trail doubled back on itself");
      longest = Math.max(longest, path.length);
    }
  }
  // The check has to have had loops to catch, and trails long enough to lose them in.
  assert.ok(erasures > 1000, `only ${erasures} loops were erased`);
  assert.ok(longest > 40, `the longest trail was only ${longest} cells`);

  // Control: the same record read with the rule taken out. A walk that only ever appends
  // revisits a cell almost at once, which is the cycle the maze would then have carried.
  let appended = [];
  let repeated = false;
  for (const move of MOVES.slice(0, 400)) {
    if (move.kind === "open") {
      appended = [move.cell];
    } else if (move.kind === "move") {
      appended = [...appended, move.cell];
      repeated = repeated || new Set(appended).size !== appended.length;
    }
  }
  assert.equal(repeated, true, "without erasure the trail must repeat a cell");
});

test("one seed names one maze", () => {
  assert.deepEqual(buildMoves(SEED), buildMoves(SEED));
  assert.deepEqual(buildMoves(SEED), MOVES);

  const other = buildMoves(SEED + 1);
  assert.notDeepEqual(other, MOVES);
  // A different seed is a different maze, not the same maze reached differently.
  const otherEdges = replay(other, other.length).edges;
  assert.equal(otherEdges.length, CELL_COUNT - 1);
  const key = ([from, to]) => (from < to ? `${from}-${to}` : `${to}-${from}`);
  const mine = new Set(MAZE.edges.map(key));
  assert.ok(
    otherEdges.filter((edge) => !mine.has(key(edge))).length > 100,
    "two seeds should not be drawing nearly the same maze"
  );

  // And there is no second source of randomness anywhere: everything the picture does
  // comes through the one seeded generator, so a render is repeatable.
  assert.equal(MODULE.includes("Math.random"), false);
  assert.equal(SKETCH.includes("Math.random"), false);
  assert.match(MODULE, /mulberry32\(seed\)/u);
});

test("the maze allows exactly one route between the two corners", () => {
  assert.deepEqual(ROUTE_ENDS, [0, CELL_COUNT - 1]);
  assert.equal(ROUTE[0], ROUTE_ENDS[0]);
  assert.equal(ROUTE[ROUTE.length - 1], ROUTE_ENDS[1]);
  assert.ok(ROUTE.length > 40, `the route is only ${ROUTE.length} cells long`);
  assert.equal(new Set(ROUTE).size, ROUTE.length);
  for (let step = 0; step + 1 < ROUTE.length; step += 1) {
    assert.ok(neighbours(ROUTE[step]).includes(ROUTE[step + 1]));
  }

  // Uniqueness, measured as what uniqueness means: every corridor the route uses is the
  // only way past that point. Take any one of them out and the two corners stop being
  // connected at all — so there is no second route, not merely no shorter one.
  const onRoute = new Set();
  for (let step = 0; step + 1 < ROUTE.length; step += 1) {
    onRoute.add(`${ROUTE[step]}-${ROUTE[step + 1]}`);
    onRoute.add(`${ROUTE[step + 1]}-${ROUTE[step]}`);
  }
  let tested = 0;
  for (const edge of MAZE.edges) {
    if (!onRoute.has(`${edge[0]}-${edge[1]}`)) {
      continue;
    }
    tested += 1;
    const without = MAZE.edges.filter((candidate) => candidate !== edge);
    assert.equal(
      reachedFrom(without, ROUTE_ENDS[0]).has(ROUTE_ENDS[1]),
      false,
      `the corners survive losing the corridor ${edge[0]}-${edge[1]}`
    );
  }
  assert.equal(tested, ROUTE.length - 1, "every corridor of the route must be tried");

  // Control: a corridor the route does not use is not load-bearing for it.
  const spare = MAZE.edges.find((edge) => !onRoute.has(`${edge[0]}-${edge[1]}`));
  assert.ok(spare, "the maze has corridors the route does not use");
  assert.equal(
    reachedFrom(MAZE.edges.filter((edge) => edge !== spare), ROUTE_ENDS[0]).has(ROUTE_ENDS[1]),
    true
  );
});

test("the clip walks the record forward and lands on the end of it", () => {
  assert.equal(TOTAL_FRAMES, PLAYBACK_FPS * DURATION_SECONDS);
  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(BUILD_FRAMES + HOLD_FRAMES + ROUTE_FRAMES <= TOTAL_FRAMES, true);
  assert.equal(PACING.total, MOVES.length);

  assert.equal(movesAt(0, PACING), 0);
  let previous = -1;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const at = movesAt(frame, PACING);
    assert.ok(at >= previous, `frame ${frame} runs the record backwards`);
    previous = at;
  }
  assert.equal(movesAt(BUILD_FRAMES - 1, PACING), MOVES.length);
  assert.equal(movesAt(TOTAL_FRAMES - 1, PACING), MOVES.length);

  // Why there are two tempos at all: the first walk is most of the record and leaves one
  // branch, so at one rate the clip would be an empty grid for half its length.
  assert.ok(PACING.firstGraft / PACING.total > 0.4, "the first walk is most of the record");
  assert.equal(movesAt(FIRST_WALK_FRAMES, PACING), PACING.firstGraft);

  // And what the two tempos are for, measured rather than described. The first corridor
  // has to arrive early in the clip, and the maze has to be well along by the middle of
  // the build — both would fail if the first walk were given a comfortable share of the
  // ten seconds, which is the mistake this pacing exists to avoid.
  const edgesAt = (frame) => replay(MOVES, movesAt(frame, PACING)).edges.length;
  const firstCorridor = [...Array(TOTAL_FRAMES).keys()].find((frame) => edgesAt(frame) > 0);
  assert.ok(firstCorridor <= TOTAL_FRAMES / 4, `the maze starts only at frame ${firstCorridor}`);
  assert.ok(
    edgesAt(Math.round(BUILD_FRAMES / 2)) > (CELL_COUNT - 1) / 5,
    "half way through the build the maze should be well under way"
  );
  assert.equal(edgesAt(BUILD_FRAMES - 1), CELL_COUNT - 1);

  // Frames are wrapped, so a looping player never falls off either end of the record.
  assert.equal(movesAt(TOTAL_FRAMES, PACING), movesAt(0, PACING));
  assert.equal(movesAt(-1, PACING), movesAt(TOTAL_FRAMES - 1, PACING));
});

test("the route is lit only after the maze is finished and the last ember is out", () => {
  assert.equal(routeLitAt(BUILD_FRAMES - 1), 0);
  assert.equal(routeLitAt(BUILD_FRAMES + HOLD_FRAMES - 1), 0);
  assert.ok(routeLitAt(BUILD_FRAMES + HOLD_FRAMES) > 0);
  assert.equal(routeLitAt(TOTAL_FRAMES - 1), 1);
  assert.equal(routeLitAt(BUILD_FRAMES + HOLD_FRAMES + ROUTE_FRAMES - 1), 1);

  // Nothing warm is left on the page once the route begins. The embers keep ageing after
  // the last move so that the loops cut at the very end die instead of freezing where
  // they were, and the hold is long enough to see all of them out.
  const alive = (frame) => {
    const clock = emberClockAt(frame, PACING);
    const state = replay(MOVES, movesAt(frame, PACING));
    return state.embers.filter((ember) => clock - ember.at < EMBER_MOVES).length;
  };
  assert.ok(alive(BUILD_FRAMES - 1) > 0, "the last building frame still has embers on it");
  for (let frame = BUILD_FRAMES + HOLD_FRAMES; frame < TOTAL_FRAMES; frame += 1) {
    assert.equal(alive(frame), 0, `frame ${frame} still has an ember burning`);
  }

  // Control: without the ageing that runs on past the record, those embers would still
  // be there at the end, because the record itself has stopped advancing.
  const frozen = MAZE.embers.filter((ember) => PACING.total - ember.at < EMBER_MOVES).length;
  assert.ok(frozen > 0, "there are embers alive at the moment the maze is finished");
});

test("the picture is a replay of the record, at the size the catalog registers", () => {
  // The sketch does not keep a maze of its own: it replays the moves through the same
  // erasure rule the tests measure, so it cannot draw a maze the rule did not make.
  assert.match(SKETCH, /from "\.\/not-without-a-plan\.js"/u);
  assert.match(SKETCH, /const state = replay\(MOVES, atMove\);/u);
  assert.match(SKETCH, /drawMaze\(state\.edges\);/u);
  assert.match(SKETCH, /drawWalk\(state\.path\);/u);

  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const artwork = manifest.artworks.find((entry) => entry.id === "not-without-a-plan");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.artifact, "exports/p5js/NotWithoutAPlan.mp4");
  assert.equal(artwork.render.durationSeconds, DURATION_SECONDS);
  assert.equal(artwork.render.scale, 2);
  assert.deepEqual(artwork.canvas, { width: 960, height: 640 });
  assert.deepEqual(artwork.quoteIds, ["pope-mighty-maze"]);
  assert.ok(artwork.thumbnail.frame < TOTAL_FRAMES);

  // The grid has to fit the canvas it is drawn on, with a margin left round it.
  const cell = Number(SKETCH.match(/const CELL = (\d+);/u)[1]);
  assert.ok((COLUMNS - 1) * cell < artwork.canvas.width - 100);
  assert.ok((ROWS - 1) * cell < artwork.canvas.height - 100);
});

test("the catalog carries the line as the author's corrected edition set it", () => {
  const catalog = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
  const quote = catalog.quotes.find((entry) => entry.id === "pope-mighty-maze");
  assert.equal(quote.text, "A mighty Maze! but not without a Plan;");
  assert.equal(quote.lang, "en");
  assert.equal(quote.year, 1736);
  assert.equal(quote.author, "Alexander Pope");
  assert.equal(quote.publicDomain, true);
  assert.equal(quote.text.length, 38);

  // The 1736 setting capitalises the two nouns. The printings from 1745 on lower-case
  // them, and this is the author's own corrected edition, so the capitals are the
  // reading: a test that only counted characters would not notice them going.
  assert.ok(quote.text.includes("Maze"));
  assert.ok(quote.text.includes("Plan"));
  assert.equal(quote.text.includes("maze"), false);
  assert.equal(quote.text.includes("plan"), false);

  // Both 1736 issues set a space before the "!" and the ";", and they do not agree on
  // how wide it is; English orthography does not carry that space and no codepoint
  // reproduces "a space of unspecified width", so it is normalised away. This is the
  // opposite decision from the Stendhal quotation and the same rule: keep the spacing a
  // language actually requires, drop the compositor's.
  assert.equal(quote.text.includes(" !"), false);
  assert.equal(quote.text.includes(" ;"), false);
  assert.equal(quote.text.includes(" "), false);

  // Every character is ASCII, so nothing here can be silently replaced by a lookalike.
  for (const character of quote.text) {
    assert.ok(character.codePointAt(0) < 128, `${character} is not ASCII`);
  }

  // The line the title is taken from is the revised one. Before 1736 it read "of walks
  // without a Plan", which says the opposite, and a quotation that drifted back to it
  // would leave the artwork named after a line denying its own subject.
  assert.ok(quote.text.includes("not without a Plan"));
  assert.equal(quote.text.includes("of walks"), false);
});
