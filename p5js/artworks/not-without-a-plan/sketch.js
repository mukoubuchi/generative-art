import {
  CELL_COUNT,
  COLUMNS,
  DURATION_SECONDS,
  EMBER_MOVES,
  PLAYBACK_FPS,
  ROUTE_ENDS,
  ROWS,
  TOTAL_FRAMES,
  buildMoves,
  columnOf,
  emberClockAt,
  movesAt,
  pacingOf,
  replay,
  routeBetween,
  routeLitAt,
  rowOf
} from "./not-without-a-plan.js";

/**
 * A walk wanders, its loops are erased, and what survives becomes the maze. The maze is a
 * spanning tree, so when the last branch is grafted there is exactly one route between
 * any two cells — and the clip ends by lighting the one that runs corner to corner.
 *
 * The maze is not stored as a picture. Every frame replays the algorithm's record through
 * the erasure rule and draws what it finds, so nothing on the page can drift away from
 * the rule that made it.
 */
const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 640;
const CELL = 26;
const ORIGIN_X = (LOGICAL_WIDTH - (COLUMNS - 1) * CELL) / 2;
const ORIGIN_Y = (LOGICAL_HEIGHT - (ROWS - 1) * CELL) / 2;

const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;

/**
 * Three colours and no more. Night for the ground; one cool stone for everything the maze
 * has settled, told apart by weight rather than by hue; one warm ember for what is still
 * alive — the walk that is out, and the loops it loses. What lasts is cold and thin, what
 * is spent is warm and goes out.
 */
const GROUND = [11, 14, 20];
const STONE = [154, 172, 190];
const EMBER = [206, 138, 82];

const MOVES = buildMoves();
const PACING = pacingOf(MOVES);
const MAZE = replay(MOVES, MOVES.length);
const ROUTE = routeBetween(MAZE.edges, ...ROUTE_ENDS);

const P5 = window.p5;

new P5((p) => {
  function centreX(cell) {
    return ORIGIN_X + columnOf(cell) * CELL;
  }

  function centreY(cell) {
    return ORIGIN_Y + rowOf(cell) * CELL;
  }

  function drawChain(cells, colour, alpha, weight) {
    if (cells.length < 2) {
      return;
    }
    p.stroke(...colour, alpha);
    p.strokeWeight(weight);
    p.beginShape();
    for (const cell of cells) {
      p.vertex(centreX(cell), centreY(cell));
    }
    p.endShape();
  }

  /**
   * The corridors, and nothing under them. A faint halo was drawn beneath them for a
   * while and it turned out to be the only thing the cross-engine check could see: at
   * one twentieth of an alpha it stood about eight levels of 255 clear of the ground,
   * which is the threshold that check counts ink at, so the two engines were being
   * compared on the ragged edge of a wash nobody could see. Ratio 1.30 with it, 1.00
   * without, and the picture is the same picture.
   */
  function drawMaze(edges) {
    p.stroke(...STONE, 180);
    p.strokeWeight(1.5);
    for (const [from, to] of edges) {
      p.line(centreX(from), centreY(from), centreX(to), centreY(to));
    }
  }

  function drawEmbers(embers, atMove) {
    for (const ember of embers) {
      const spent = (atMove - ember.at) / EMBER_MOVES;
      if (spent < 0 || spent > 1) {
        continue;
      }
      // A loop dies fastest just after it is cut, which is what keeps a field of them
      // from reading as a second maze laid over the first.
      const life = (1 - spent) * (1 - spent);
      drawChain(ember.cells, EMBER, 4 + 96 * life, 0.6 + 1.1 * life);
    }
  }

  function drawWalk(path) {
    if (path.length === 0) {
      return;
    }
    drawChain(path, EMBER, 16, 6);
    drawChain(path, EMBER, 210, 1.9);
    const head = path[path.length - 1];
    p.noStroke();
    p.fill(...EMBER, 40);
    p.circle(centreX(head), centreY(head), 13);
    p.fill(...EMBER, 235);
    p.circle(centreX(head), centreY(head), 4.4);
  }

  /** The one route the finished maze allows between its opposite corners. */
  function drawRoute(lit) {
    const reached = Math.max(2, Math.round(lit * ROUTE.length));
    const cells = ROUTE.slice(0, reached);
    drawChain(cells, STONE, 26, 9);
    drawChain(cells, STONE, 96, 4.5);
    drawChain(cells, STONE, 250, 1.9);
    p.noStroke();
    for (const end of [ROUTE[0], cells[cells.length - 1]]) {
      p.fill(...STONE, 30);
      p.circle(centreX(end), centreY(end), 15);
      p.fill(...STONE, 240);
      p.circle(centreX(end), centreY(end), 4.6);
    }
  }

  function drawFrame(frameIndex) {
    const atMove = movesAt(frameIndex, PACING);
    const state = replay(MOVES, atMove);
    const lit = routeLitAt(frameIndex);
    const emberClock = emberClockAt(frameIndex, PACING);

    p.background(...GROUND);
    p.push();
    p.scale(RENDER_SCALE);
    p.noFill();
    p.strokeCap(p.ROUND);
    p.strokeJoin(p.ROUND);

    drawMaze(state.edges);
    drawEmbers(state.embers, emberClock);
    drawWalk(state.path);
    if (lit > 0) {
      drawRoute(lit);
    }
    p.pop();
    return { state, atMove, lit };
  }

  function publishState(frameIndex, drawn) {
    const state = {
      kind: "video",
      frameIndex,
      totalFrames: TOTAL_FRAMES,
      durationSeconds: DURATION_SECONDS,
      atMove: drawn.atMove,
      edges: drawn.state.edges.length,
      cellsReached: drawn.state.inTree.size,
      cells: CELL_COUNT,
      walking: drawn.state.path.length,
      routeLit: drawn.lit,
      routeCells: ROUTE.length,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_STATE__ = state;
    window.__ARTWORK_READY__ = true;
    return state;
  }

  p.setup = () => {
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    if (CAPTURE_MODE) {
      p.pixelDensity(1);
    }
    p.frameRate(PLAYBACK_FPS);
    if (CAPTURE_MODE) {
      p.noLoop();
      window.__renderFrame = (frameIndex) =>
        Promise.resolve(publishState(frameIndex, drawFrame(frameIndex)));
    }
    publishState(0, drawFrame(0));
  };

  p.draw = () => {
    if (CAPTURE_MODE) {
      return;
    }
    const frameIndex = p.frameCount % TOTAL_FRAMES;
    publishState(frameIndex, drawFrame(frameIndex));
  };
});
