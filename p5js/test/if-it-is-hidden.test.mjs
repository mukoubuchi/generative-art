import assert from "node:assert/strict";
import test from "node:test";
import { mulberry32 } from "../artworks/shared/random.js";
import { FRAMES, FPS, DURATION, COLUMNS, ROWS, CELLS, PITCH, SIZE, HOLD, CLOCK_FRAMES, RAMP, SEAM,
  FLOWERS, PAPER, INK, PAPER_SEED, DOT_RADII, makePaper, makeBloom, clockFrame, pageFrame, frameState,
  stepsTaken, sourceMap, frameSheet } from "../artworks/if-it-is-hidden/field.js";

const bloom = makeBloom();
const paper = makePaper();
const [cherry, chrysanthemum] = bloom.flowers;

/**
 * The sketch itself, run without a browser. p5 is replaced by a stand-in whose drawing
 * context only writes down what it is asked to draw, and the window by one that keeps the
 * listeners the sketch registers, so that keys and pointers can be played to it. `search`
 * is the page's query string: the renderer's, or none for a reader's page.
 */
let runs = 0;
async function runSketch(search) {
  const drawn = [], typed = [];
  const context = {
    fillStyle: "",
    save() {}, restore() {}, moveTo() {},
    scale(x, y) { drawn.push(["scale", x, y]); },
    fillRect(...box) { drawn.push(["fillRect", this.fillStyle, ...box]); },
    beginPath() { drawn.push(["beginPath"]); },
    arc(...disc) { drawn.push(["arc", ...disc]); },
    fill() { drawn.push(["fill", this.fillStyle]); }
  };
  const heard = { window: new Map(), document: new Map(), canvas: new Map() };
  const listen = (handlers) => (name, handler) => handlers.set(name, handler);
  const canvas = { style: {}, addEventListener: listen(heard.canvas), setPointerCapture() {} };
  // Anything else the sketch or the legend asks of p5 is accepted and does nothing.
  const sketch = new Proxy({
    drawingContext: context,
    createCanvas: () => ({ parent: () => ({ elt: canvas }) }),
    textWidth: (text) => String(text).length * 7,
    text: (text) => { typed.push(String(text)); }
  }, { get: (target, name) => name in target ? target[name] : () => undefined });
  const page = { location: { search }, addEventListener: listen(heard.window), p5: function (body) { body(sketch); } };
  globalThis.window = page;
  globalThis.document = { hidden: false, addEventListener: listen(heard.document) };
  await import(`../artworks/if-it-is-hidden/sketch.js?run=${runs++}`);
  return { sketch, page, drawn, typed, heard };
}

/** A detector "finds" a flower when its statistic is this many standard deviations out. */
const FOUND = 5;

/** The first clock frame at which every petal is at full speed, and the last. */
function fullSpeed(flower) {
  const begins = flower.petals.map((petal) => petal.begins);
  return { from: Math.max(...begins) + RAMP, to: Math.min(...begins) + flower.steps };
}
/** A frame of the clip for a clock frame outside the recorded hold. */
const frameOfClock = (clock) => clock < HOLD.from ? clock : clock + (HOLD.to - HOLD.from);

test("the sheet is drawn one cell at a time from one distribution, before any flower exists", () => {
  // One draw per cell, the same thresholds for every cell: a cell's value is a function of
  // its own draw alone, so no cell is placed by looking at a neighbour.
  const random = mulberry32(PAPER_SEED);
  const counts = [0, 0, 0, 0];
  for (let cell = 0; cell < CELLS; cell++) {
    const draw = random();
    const value = draw < 0.07 ? 1 : draw < 0.105 ? 2 : draw < 0.12 ? 3 : 0;
    assert.equal(paper[cell], value);
    counts[value]++;
  }
  assert.equal(counts.reduce((a, b) => a + b), CELLS);
  assert.equal(CELLS, COLUMNS * ROWS);
  assert.equal(COLUMNS * PITCH, SIZE);
  assert.equal(DOT_RADII.length, counts.length);
  // Each share within four binomial deviations of what it was drawn with.
  [0.88, 0.07, 0.035, 0.015].forEach((share, value) => {
    assert.ok(Math.abs(counts[value] - CELLS * share) < 4 * Math.sqrt(CELLS * share * (1 - share)));
  });
  // Another seed is another sheet: the sheet is the generator's, not a fixed picture.
  const other = makePaper(PAPER_SEED + 1);
  let different = 0;
  for (let cell = 0; cell < CELLS; cell++) if (other[cell] !== paper[cell]) different++;
  assert.ok(different > CELLS / 10);
});

test("every frame shows the first sheet through a one-to-one map, at every cell", () => {
  assert.equal(FRAMES, FPS * DURATION);
  const source = new Int32Array(CELLS), seen = new Uint8Array(CELLS);
  let resting = 0, mostMoved = 0, checked = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    sourceMap(bloom, frame, source);
    seen.fill(0);
    let moved = 0;
    for (let cell = 0; cell < CELLS; cell++) {
      const from = source[cell];
      assert.ok(Number.isInteger(from) && from >= 0 && from < CELLS);
      assert.equal(seen[from], 0, `frame ${frame}: cell ${from} is shown twice`);
      seen[from] = 1;
      if (from !== cell) moved++;
      checked++;
    }
    if (moved === 0) resting++;
    mostMoved = Math.max(mostMoved, moved);
  }
  assert.equal(checked, FRAMES * CELLS);
  // Not vacuous: most frames rearrange tens of thousands of cells, and the rest none. The
  // frames at rest are the three intervals in which no flower is open, counted again from
  // the petals' own times in the test of the restored sheet below.
  // A flower's very first and very last frame may or may not have moved a speck yet, which
  // is the only slack in the count.
  const closes = (flower) => Math.max(...flower.petals.map((petal) => petal.begins)) + flower.steps + RAMP;
  const closed = cherry.begins + 1 + (chrysanthemum.begins - closes(cherry) + 1) + (CLOCK_FRAMES - closes(chrysanthemum));
  assert.equal(closed, 86);
  assert.ok(resting >= closed && resting <= closed + 4, `${resting} frames at rest`);
  assert.ok(mostMoved > 20000, `at most ${mostMoved} cells moved`);
  console.log(JSON.stringify({ framesChecked: FRAMES, cellsChecked: checked, restingFrames: resting, mostMoved }));

  // The control: a map that carries two cells onto one is caught by the same count.
  sourceMap(bloom, frameOfClock(fullSpeed(cherry).from), source);
  const loop = cherry.loops[0].cells;
  source[loop[0]] = source[loop[1]];
  seen.fill(0);
  let doubled = 0;
  for (let cell = 0; cell < CELLS; cell++) if (seen[source[cell]]++) doubled++;
  assert.equal(doubled, 1);
});

test("the map is worked out without the sheet", () => {
  // Whatever the sheet holds, a frame is that sheet read through the frame's map: the map
  // is computed first and alone, and each of four unlike sheets comes out as itself
  // rearranged by it.
  const sheets = [paper, makePaper(7), Uint8Array.from({ length: CELLS }, (_, cell) => cell % 4),
    new Uint8Array(CELLS).fill(3)];
  const source = new Int32Array(CELLS), shown = new Uint8Array(CELLS);
  for (const frame of [0, 97, 150, 200, 301, 470, 555, 640, 719]) {
    sourceMap(bloom, frame, source);
    for (const sheet of sheets) {
      frameSheet(bloom, sheet, frame, shown);
      for (let cell = 0; cell < CELLS; cell++) assert.equal(shown[cell], sheet[source[cell]]);
    }
  }
  // The flowers are built with no sheet in hand, and twice over they are the same flowers.
  assert.equal(makeBloom.length, 0);
  const again = makeBloom();
  again.flowers.forEach((flower, index) => {
    assert.deepEqual(flower.owner, bloom.flowers[index].owner);
    assert.equal(flower.loops.length, bloom.flowers[index].loops.length);
  });
});

test("the sketch draws one flat disc for each speck of the frame's sheet, in a petal as out of one", async () => {
  const { sketch, page, drawn, typed } = await runSketch("?capture=1&renderScale=2");
  sketch.setup();
  assert.equal(page.__ARTWORK_READY__, true);
  const ink = `rgb(${INK.join(",")})`, ground = `rgb(${PAPER.join(",")})`;
  const sheet = new Uint8Array(CELLS);
  /** What the sketch draws for a frame: the disc it puts on each cell, and whatever else. */
  const picture = async (frame) => {
    drawn.length = 0;
    typed.length = 0;
    const state = await page.__renderFrame(frame);
    assert.equal(state.frameIndex, frame);
    assert.equal(state.totalFrames, FRAMES);
    const discs = new Map(), rest = [];
    let open = [];
    for (const [call, ...values] of drawn) {
      if (call === "arc") {
        open.push(values);
      } else if (call === "fill") {
        // Every disc is whole and filled in the one ink.
        assert.equal(values[0], ink);
        for (const [x, y, radius, from, to] of open) {
          assert.equal(from, 0);
          assert.equal(to, 2 * Math.PI);
          const column = x / PITCH - 0.5, row = y / PITCH - 0.5;
          assert.ok(Number.isInteger(column) && Number.isInteger(row), "a disc off the centre of its cell");
          assert.ok(!discs.has(row * COLUMNS + column), "two discs on one cell");
          discs.set(row * COLUMNS + column, radius);
        }
        open = [];
      } else if (call !== "beginPath") {
        rest.push([call, ...values]);
      }
    }
    assert.equal(open.length, 0);
    return { discs, rest, words: typed.slice() };
  };
  /** Cells whose disc is not the one their own value in the sheet calls for. */
  const disagreements = (discs) => {
    let wrong = 0;
    for (let cell = 0; cell < CELLS; cell++) {
      const radius = discs.get(cell);
      if (sheet[cell] === 0 ? radius !== undefined : radius !== DOT_RADII[sheet[cell]]) wrong++;
    }
    return wrong;
  };
  const inBlossom = frameOfClock(fullSpeed(cherry).from + 40);
  const inChrysanthemum = frameOfClock(fullSpeed(chrysanthemum).from + 40);
  let specks = 0;
  for (const frame of [0, inBlossom, HOLD.from + 30, inChrysanthemum, FRAMES - 1]) {
    const { discs, rest, words } = await picture(frame);
    // The frame's sheet, worked out here and not taken from the sketch.
    frameSheet(bloom, paper, frame, sheet);
    assert.equal(disagreements(discs), 0, `frame ${frame}: discs that are not the sheet's`);
    // Besides the specks there is the export scale and the paper laid over the whole canvas.
    assert.deepEqual(rest, [["scale", 2, 2], ["fillRect", ground, 0, 0, SIZE, SIZE]]);
    // The clip lights the Space token through its own hold, and prints no legend.
    assert.deepEqual(words, frame >= HOLD.from && frame < HOLD.to ? ["space"] : []);
    specks += discs.size;
  }
  assert.ok(specks > 5 * 13000, `only ${specks} discs were looked at`);
  // The measure can say no. Were one petal's specks drawn a hundredth of a pixel larger,
  // every one of them would be counted.
  const { discs } = await picture(inBlossom);
  frameSheet(bloom, paper, inBlossom, sheet);
  let enlarged = 0;
  cherry.owner.forEach((owner, cell) => {
    if (owner !== 0 || !discs.has(cell)) return;
    discs.set(cell, discs.get(cell) + 0.01);
    enlarged++;
  });
  assert.ok(enlarged > 500);
  assert.equal(disagreements(discs), enlarged);
});

test("each line of a petal is a chain of its own cells running away from the focus", () => {
  for (const flower of bloom.flowers) {
    const taken = new Uint8Array(CELLS);
    let moving = 0, short = 0, inFlower = 0, worstSpeed = 0;
    for (const owner of flower.owner) if (owner >= 0) inFlower++;
    for (const loop of flower.loops) {
      const petal = flower.petals[loop.petal];
      const length = loop.cells.length;
      assert.ok(length >= 2);
      // A whole number of turns by the time the petal closes.
      assert.equal(loop.total % length, 0, `${flower.name}: ${loop.total} steps round ${length} cells`);
      assert.ok(loop.total <= flower.steps && loop.total >= 0.4 * flower.steps);
      let previous = -Infinity, travelled = 0;
      for (let i = 0; i < length; i++) {
        const cell = loop.cells[i];
        assert.equal(flower.owner[cell], loop.petal);
        assert.equal(taken[cell], 0, "two loops share a cell");
        taken[cell] = 1;
        const x = (cell % COLUMNS + 0.5) * PITCH - petal.focus[0];
        const y = (Math.floor(cell / COLUMNS) + 0.5) * PITCH - petal.focus[1];
        const distance = x * x + y * y;
        assert.ok(distance > previous, "a line turns back toward its focus");
        previous = distance;
        if (i > 0) {
          const dc = (cell % COLUMNS) - (loop.cells[i - 1] % COLUMNS);
          const dr = Math.floor(cell / COLUMNS) - Math.floor(loop.cells[i - 1] / COLUMNS);
          assert.ok(Math.abs(dc) <= 3 && Math.abs(dr) <= 3 && Math.min(Math.abs(dc), Math.abs(dr)) <= 1);
          travelled += Math.sqrt(dc * dc + dr * dr);
        }
      }
      // One speed on the canvas whichever way the line slants: steps times stride.
      if (length >= 24) {
        const distance = loop.total * travelled / (length - 1);
        worstSpeed = Math.max(worstSpeed, Math.abs(distance / flower.steps - 1));
      }
      moving += length;
      if (length < 12) short += length;
    }
    // Nearly every cell of the flower moves, and few of them in very short loops.
    assert.ok(moving > 0.99 * inFlower, `${flower.name}: ${moving} of ${inFlower} cells move`);
    assert.ok(short < 0.08 * moving, `${flower.name}: ${short} cells in short loops`);
    // Neighbouring petals never touch: wherever the cells of two of them come near, at
    // least SEAM cells of paper that belongs to neither lie between.
    let near = 0;
    for (let row = 0; row < ROWS; row++) for (let column = 0; column < COLUMNS; column++) {
      const here = flower.owner[row * COLUMNS + column];
      if (here < 0) continue;
      for (let dr = 0; dr <= SEAM; dr++) for (let dc = -SEAM; dc <= SEAM; dc++) {
        const r = row + dr, c = column + dc;
        if (r >= ROWS || c < 0 || c >= COLUMNS) continue;
        const there = flower.owner[r * COLUMNS + c];
        assert.ok(there < 0 || there === here, `${flower.name}: petals ${here} and ${there} within ${SEAM} cells`);
        near++;
      }
    }
    assert.ok(near > 10 * inFlower);
    assert.ok(worstSpeed < 0.1, `${flower.name}: a loop ${worstSpeed} away from the common speed`);
    console.log(JSON.stringify({ flower: flower.name, cells: inFlower, loops: flower.loops.length, moving, short, worstSpeed }));
  }
});

test("the petals set off in phyllotactic order, gather speed, hold it and come to rest", () => {
  assert.equal(CLOCK_FRAMES, FRAMES - (HOLD.to - HOLD.from));
  const report = {};
  for (const flower of bloom.flowers) {
    const count = flower.petals.length;
    // Two fifths of a turn between successive petals of the cherry; five thirteenths for
    // the chrysanthemum.
    const order = flower.petals.map((petal) => petal.index).sort((a, b) => flower.petals[a].begins - flower.petals[b].begins);
    order.forEach((index, n) => {
      assert.equal(index, (n * flower.stride) % count);
      assert.equal(flower.petals[index].begins, flower.begins + n * flower.lag);
    });
    const span = flower.steps + RAMP, whole = 2 * RAMP * flower.steps;
    for (const petal of flower.petals) {
      assert.ok(petal.begins > 0 && petal.begins + span < CLOCK_FRAMES);
      for (const total of new Set(flower.loops.map((loop) => loop.total))) {
        // Whatever phase a loop is given, it starts from nothing, never takes two steps in
        // a frame, and ends on its total.
        for (const phase of [0, 1, whole, 2 * whole - 1]) {
          let previous = 0;
          for (let clock = 0; clock <= CLOCK_FRAMES; clock++) {
            const steps = stepsTaken(flower, petal, { total, phase }, clock);
            assert.ok(Number.isInteger(steps));
            assert.ok(steps - previous === 0 || steps - previous === 1, "more than one step in a frame");
            if (clock <= petal.begins) assert.equal(steps, 0);
            if (clock >= petal.begins + span) assert.equal(steps, total);
            previous = steps;
          }
        }
      }
      // Full speed is one step a frame along an axis-parallel line.
      const fastest = { total: flower.steps, phase: whole }, middle = petal.begins + RAMP + 10;
      assert.equal(stepsTaken(flower, petal, fastest, middle + 30) - stepsTaken(flower, petal, fastest, middle), 30);
      // Speed is gained and lost evenly: the same distance in the first frames as the last.
      assert.equal(stepsTaken(flower, petal, fastest, petal.begins + RAMP),
        flower.steps - stepsTaken(flower, petal, fastest, petal.begins + span - RAMP));
    }
    // The loops slower than a step a frame do not all stand still in the same frames: in
    // any one frame at full speed, most of every petal's cells have just moved.
    for (const loop of flower.loops) assert.ok(Number.isInteger(loop.phase) && loop.phase >= 0 && loop.phase < 2 * whole);
    const { from, to } = fullSpeed(flower);
    let stillest = 1;
    for (let clock = from; clock < to; clock++) {
      const stepped = flower.petals.map(() => 0), all = flower.petals.map(() => 0);
      for (const loop of flower.loops) {
        const petal = flower.petals[loop.petal];
        all[loop.petal] += loop.cells.length;
        if (stepsTaken(flower, petal, loop, clock + 1) > stepsTaken(flower, petal, loop, clock)) stepped[loop.petal] += loop.cells.length;
      }
      for (const petal of flower.petals) stillest = Math.min(stillest, stepped[petal.index] / all[petal.index]);
    }
    assert.ok(stillest > 0.55, `${flower.name}: in one frame only ${stillest} of a petal moved`);
    report[flower.name] = stillest;
  }
  assert.equal(cherry.petals.length, 5);
  assert.equal(chrysanthemum.petals.length, 13);
  assert.equal(FLOWERS.length, 2);
  // The cherry has closed before the chrysanthemum opens.
  const cherryEnds = Math.max(...cherry.petals.map((petal) => petal.begins)) + cherry.steps + RAMP;
  assert.ok(chrysanthemum.begins - cherryEnds >= FPS);
  console.log(JSON.stringify({ leastShareOfAPetalMovingInOneFrame: report }));
});

test("when no flower is open the sheet is the first sheet, cell for cell", () => {
  const source = new Int32Array(CELLS);
  const identity = (frame) => {
    sourceMap(bloom, frame, source);
    for (let cell = 0; cell < CELLS; cell++) if (source[cell] !== cell) return false;
    return true;
  };
  const cherryEnds = Math.max(...cherry.petals.map((petal) => petal.begins)) + cherry.steps + RAMP;
  const lastEnds = Math.max(...chrysanthemum.petals.map((petal) => petal.begins)) + chrysanthemum.steps + RAMP;
  let rests = 0;
  for (let clock = 0; clock < CLOCK_FRAMES; clock++) {
    const open = (clock > cherry.begins && clock < cherryEnds) || (clock > chrysanthemum.begins && clock < lastEnds);
    if (open) continue;
    assert.ok(identity(frameOfClock(clock)), `the sheet is not restored at clock frame ${clock}`);
    rests++;
  }
  assert.ok(identity(FRAMES) && identity(2 * FRAMES + 5));
  // The three rests: before the cherry, between the flowers, after the chrysanthemum.
  assert.equal(rests, cherry.begins + 1 + (chrysanthemum.begins - cherryEnds + 1) + (CLOCK_FRAMES - lastEnds));
  assert.ok(!identity(frameOfClock(cherry.begins + 60)) && !identity(frameOfClock(chrysanthemum.begins + 60)));

  // What restores it is that every loop goes round a whole number of times. One loop given
  // one step too many leaves its specks displaced after the flower has closed.
  const spoiled = { flowers: bloom.flowers.map((flower) => ({ ...flower, loops: flower.loops.slice() })) };
  spoiled.flowers[0].loops[0] = { ...cherry.loops[0], total: cherry.loops[0].total + 1 };
  sourceMap(spoiled, frameOfClock(cherryEnds + 5), source);
  let displaced = 0;
  for (let cell = 0; cell < CELLS; cell++) if (source[cell] !== cell) displaced++;
  assert.equal(displaced, cherry.loops[0].cells.length);
});

test("the recorded hold and a held key stop the clock, and the page closes at the full period", () => {
  assert.equal(pageFrame(3), 90);
  assert.equal(pageFrame(DURATION), 0);
  assert.equal(pageFrame(DURATION + 3), 90);
  assert.equal(pageFrame(-1), 0);
  const a = new Int32Array(CELLS), b = new Int32Array(CELLS);
  // Mid-bloom: the cherry is at full speed on both sides of the hold.
  const { from, to } = fullSpeed(cherry);
  assert.ok(from < HOLD.from - FPS && to > HOLD.from + FPS);
  sourceMap(bloom, HOLD.from, a);
  for (let frame = HOLD.from; frame <= HOLD.to; frame++) {
    assert.equal(clockFrame(frame), HOLD.from);
    assert.equal(frameState(frame).recorded, frame < HOLD.to);
    assert.deepEqual(sourceMap(bloom, frame, b), a);
  }
  assert.notDeepEqual(sourceMap(bloom, HOLD.from - 1, b), a);
  assert.notDeepEqual(sourceMap(bloom, HOLD.to + 1, b), a);
  assert.equal(HOLD.to - HOLD.from, 2 * FPS);
  for (let frame = 0; frame < FRAMES; frame++) {
    const running = frameState(frame), held = frameState(frame, true);
    assert.equal(held.clock, running.clock);
    assert.equal(held.stopped, true);
    assert.equal(running.stopped, running.recorded);
    assert.ok(clockFrame(frame + 1) - clockFrame(frame) <= 1 || frame === FRAMES - 1);
  }
});

test("on the page a held key or pointer stops the clock, and a release takes it up where it stood", async (t) => {
  // The page's own draw loop, driven by a clock this test advances step by step.
  let now = 5000;
  t.mock.method(performance, "now", () => now);
  const { sketch, page, drawn, typed, heard } = await runSketch("");
  sketch.setup();
  // The page prints the legend; it never shows the clip's lit key.
  assert.deepEqual(typed.slice().sort(), ["hold to stop time", "space / touch"]);
  const STEP = 35;
  let clock = 0;
  const tick = (running) => {
    now += STEP;
    if (running) clock += STEP / 1000;
    drawn.length = 0;
    typed.length = 0;
    sketch.draw();
    const state = page.__ARTWORK_STATE__;
    assert.equal(state.frameIndex, pageFrame(clock));
    assert.equal(state.held, !running);
    assert.equal(state.stopped, !running || frameState(state.frameIndex).recorded);
    assert.ok(!typed.includes("space"));
    return state.frameIndex;
  };
  const key = (name, code) => heard.window.get(name)({ code, preventDefault() {} });
  const pointer = (name, pointerId, pointerType = "touch", button = 0) =>
    heard.canvas.get(name)({ pointerId, pointerType, button, preventDefault() {} });
  /** Holds for a second of the stepped clock and checks that nothing on the page moves. */
  const heldStill = () => {
    const frame = tick(false), picture = JSON.stringify(drawn);
    for (let i = 0; i < 30; i++) {
      assert.equal(tick(false), frame);
      assert.equal(JSON.stringify(drawn), picture, "the picture changed during a hold");
    }
    return frame;
  };
  // Running: into the blossom, well before the recorded hold.
  let frame = 0;
  for (let i = 0; i < 100; i++) frame = tick(true);
  assert.ok(frame > 90 && frame < HOLD.from - 60);
  const moving = JSON.stringify(drawn);
  tick(true);
  assert.notEqual(JSON.stringify(drawn), moving);

  // Space held, then let go: the next frame follows the one it was held on.
  key("keydown", "Space");
  frame = heldStill();
  key("keyup", "Space");
  assert.ok(tick(true) - frame <= 2);
  // Another key is not a hold.
  key("keydown", "KeyK");
  tick(true);
  key("keyup", "KeyK");
  // A touch, and a second finger: held until the last one lifts.
  pointer("pointerdown", 3);
  pointer("pointerdown", 4);
  frame = heldStill();
  pointer("pointerup", 3);
  assert.equal(tick(false), frame);
  pointer("pointercancel", 4);
  assert.ok(tick(true) - frame <= 2);
  // The primary mouse button holds; any other does not.
  pointer("pointerdown", 1, "mouse", 2);
  tick(true);
  pointer("pointerdown", 1, "mouse", 0);
  heldStill();
  pointer("lostpointercapture", 1);
  tick(true);
  // A hold does not outlast the window losing focus or the page being hidden.
  key("keydown", "Space");
  heldStill();
  heard.window.get("blur")();
  tick(true);
  pointer("pointerdown", 9);
  heldStill();
  globalThis.document.hidden = true;
  heard.document.get("visibilitychange")();
  globalThis.document.hidden = false;
  tick(true);
  // And left alone it runs through the recorded hold and round the full period.
  const seen = new Set();
  while (clock < DURATION + 2) seen.add(tick(true));
  assert.ok(seen.has(HOLD.from) && seen.has(FRAMES - 1) && seen.has(0));
});

/**
 * What a detector may be told: the exact cells of every petal. For each flower, the edges
 * between neighbouring cells are sorted once by where they lie, so that a frame's pairs of
 * neighbouring specks can be counted inside each petal and outside the flower.
 */
function template(flower) {
  const { owner } = flower;
  const petals = flower.petals.length;
  const cells = new Array(petals).fill(0), edges = new Array(petals).fill(0), forks = new Array(petals).fill(0);
  let outsideCells = 0, outsideEdges = 0, outsideForks = 0;
  const pairsOfEdges = (degree) => degree * (degree - 1) / 2;
  for (let row = 0; row < ROWS; row++) for (let column = 0; column < COLUMNS; column++) {
    const here = owner[row * COLUMNS + column];
    let degree = 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = column + dc, r = row + dr;
      if (c < 0 || c >= COLUMNS || r < 0 || r >= ROWS) continue;
      const there = owner[r * COLUMNS + c];
      if (here >= 0 ? there === here : there < 0) degree++;
    }
    if (here >= 0) { cells[here]++; edges[here] += degree / 2; forks[here] += pairsOfEdges(degree); }
    else { outsideCells++; outsideEdges += degree / 2; outsideForks += pairsOfEdges(degree); }
  }
  return { owner, petals, cells, edges, forks, outsideCells, outsideEdges, outsideForks };
}

/** Specks and pairs of neighbouring specks, by petal and outside the flower, in one frame. */
function census(shape, sheet) {
  const ink = new Array(shape.petals).fill(0), pairs = new Array(shape.petals).fill(0);
  let outsideInk = 0, outsidePairs = 0;
  for (let cell = 0; cell < CELLS; cell++) {
    if (sheet[cell] === 0) continue;
    const here = shape.owner[cell];
    if (here >= 0) ink[here]++; else outsideInk++;
    for (const next of [(cell + 1) % COLUMNS === 0 ? -1 : cell + 1, cell + COLUMNS < CELLS ? cell + COLUMNS : -1]) {
      if (next < 0 || sheet[next] === 0 || shape.owner[next] !== here) continue;
      if (here >= 0) pairs[here]++; else outsidePairs++;
    }
  }
  return { ink, pairs, outsideInk, outsidePairs };
}

/**
 * The one-frame detector: is the ink inside a set of petals unlike the ink outside the
 * flower, in how much there is of it or in how often specks sit side by side? Both
 * differences are measured in standard deviations of a sheet drawn cell by cell.
 */
function oneFrame(shape, counted, chosen) {
  let cells = 0, ink = 0, edges = 0, forks = 0, pairs = 0;
  for (const petal of chosen) {
    cells += shape.cells[petal]; ink += counted.ink[petal];
    edges += shape.edges[petal]; forks += shape.forks[petal]; pairs += counted.pairs[petal];
  }
  const density = (ink + counted.outsideInk) / (cells + shape.outsideCells);
  const spread = density * (1 - density);
  const amount = (ink / cells - counted.outsideInk / shape.outsideCells)
    / Math.sqrt(spread / cells + spread / shape.outsideCells);
  const variance = (count, shared) => count * density ** 2 * (1 - density ** 2) + 2 * shared * (density ** 3 - density ** 4);
  const grain = (pairs / edges - counted.outsidePairs / shape.outsideEdges)
    / Math.sqrt(variance(edges, forks) / edges ** 2 + variance(shape.outsideEdges, shape.outsideForks) / shape.outsideEdges ** 2);
  return { amount, grain };
}

const shapes = bloom.flowers.map(template);
const everyPetal = (flower) => flower.petals.map((petal) => petal.index);

test("a detector that sees one frame finds no flower in any of the frames", () => {
  const sheet = new Uint8Array(CELLS);
  const first = shapes.map((shape) => census(shape, paper));
  const worst = { amount: 0, grain: 0 };
  const cherryEnds = Math.max(...cherry.petals.map((petal) => petal.begins)) + cherry.steps + RAMP;
  let verdicts = 0, exact = 0;
  for (let frame = 0; frame < FRAMES; frame++) {
    frameSheet(bloom, paper, frame, sheet);
    const clock = clockFrame(frame);
    bloom.flowers.forEach((flower, index) => {
      const counted = census(shapes[index], sheet);
      // While a flower is the one that is open, the specks inside each of its petals are
      // the same specks in every frame, so their number is the first sheet's, exactly: the
      // amount of ink cannot tell one such frame from another. (The other flower's outline
      // is a region like any other, and specks cross it.)
      if (index === 0 ? clock <= chrysanthemum.begins : clock >= cherryEnds) {
        assert.deepEqual(counted.ink, first[index].ink);
        assert.equal(counted.outsideInk, first[index].outsideInk);
        exact++;
      }
      for (const chosen of [everyPetal(flower), ...flower.petals.map((petal) => [petal.index])]) {
        const { amount, grain } = oneFrame(shapes[index], counted, chosen);
        assert.ok(Math.abs(amount) < FOUND, `frame ${frame}, ${flower.name} ${chosen}: amount ${amount}`);
        assert.ok(Math.abs(grain) < FOUND, `frame ${frame}, ${flower.name} ${chosen}: grain ${grain}`);
        worst.amount = Math.max(worst.amount, Math.abs(amount));
        worst.grain = Math.max(worst.grain, Math.abs(grain));
        verdicts += 2;
      }
    });
  }
  // Two flowers and their eighteen petals, two statistics, every frame.
  assert.equal(verdicts, FRAMES * (2 + 18) * 2);
  assert.ok(exact > FRAMES);
  console.log(JSON.stringify({ oneFrameVerdicts: verdicts, exactCounts: exact, worstAmount: worst.amount, worstGrain: worst.grain }));
});

test("the same detector finds a flower once the inside is altered even slightly", () => {
  const sheet = new Uint8Array(CELLS);
  const frame = frameOfClock(fullSpeed(cherry).from + 40);
  const shape = shapes[0], all = everyPetal(cherry);

  // First control, on the amount: the loops forget to bring a speck round. For two steps
  // each loop lets what leaves its far end go and leaves the near end bare.
  frameSheet(bloom, paper, frame, sheet);
  const kept = census(shape, sheet);
  let lost = 0;
  for (const loop of cherry.loops) {
    const cells = loop.cells, length = cells.length;
    for (let i = length - 1; i >= 2; i--) sheet[cells[i]] = sheet[cells[i - 2]];
    sheet[cells[0]] = 0; sheet[cells[1]] = 0;
  }
  const leaked = census(shape, sheet);
  for (const petal of all) lost += kept.ink[petal] - leaked.ink[petal];
  const share = lost / all.reduce((sum, petal) => sum + kept.ink[petal], 0);
  assert.ok(share > 0.04 && share < 0.12, `the leak removes ${share} of the ink`);
  assert.ok(Math.abs(oneFrame(shape, kept, all).amount) < FOUND);
  assert.ok(oneFrame(shape, leaked, all).amount < -FOUND);

  // Second control, on the grain: a sheet with spacing in it. No two specks are neighbours
  // anywhere on it, inside the flower or out, until the petals rearrange their own cells.
  const random = mulberry32(31);
  const spaced = new Uint8Array(CELLS);
  const order = Int32Array.from({ length: CELLS }, (_, cell) => cell);
  for (let i = CELLS - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const cell of order) {
    const column = cell % COLUMNS;
    const crowded = (column > 0 && spaced[cell - 1]) || (column < COLUMNS - 1 && spaced[cell + 1])
      || (cell >= COLUMNS && spaced[cell - COLUMNS]) || (cell + COLUMNS < CELLS && spaced[cell + COLUMNS]);
    if (!crowded && random() < 0.16) spaced[cell] = 1;
  }
  const still = census(shape, spaced);
  assert.equal(still.pairs.reduce((a, b) => a + b) + still.outsidePairs, 0);
  assert.equal(oneFrame(shape, still, all).grain, 0);
  frameSheet(bloom, spaced, frame, sheet);
  const stirred = census(shape, sheet);
  assert.equal(stirred.outsidePairs, 0);
  assert.deepEqual(stirred.ink, still.ink);
  const { amount, grain } = oneFrame(shape, stirred, all);
  assert.ok(grain > FOUND, `the grain of a spaced sheet gives ${grain}`);
  assert.ok(Math.abs(amount) < FOUND);
  // Petal by petal as well: each one shows.
  for (const petal of all) assert.ok(oneFrame(shape, stirred, [petal]).grain > FOUND);
  console.log(JSON.stringify({ leakShare: share, leakAmount: oneFrame(shape, leaked, all).amount,
    spacedInk: still.ink.reduce((a, b) => a + b) + still.outsideInk, spacedGrain: grain }));
});

/**
 * The two-frame detector's sense of direction: which way the ink in a set of cells has
 * moved between one frame and the next. Each one-cell displacement is weighed by how much
 * more of the first frame's ink it lines up with the second's than chance would, and the
 * answer is the weighted mean of the displacements.
 */
function drift(before, after, cells, sum = [0, 0]) {
  let ink = 0;
  for (const cell of cells) if (before[cell]) ink++;
  const chance = ink * ink / cells.length;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dc === 0 && dr === 0) continue;
    let matched = 0;
    for (const cell of cells) {
      if (!before[cell]) continue;
      const column = cell % COLUMNS + dc, row = Math.floor(cell / COLUMNS) + dr;
      if (column >= 0 && column < COLUMNS && row >= 0 && row < ROWS && after[row * COLUMNS + column]) matched++;
    }
    sum[0] += (matched - chance) * dc; sum[1] += (matched - chance) * dr;
  }
  return sum;
}
const degreesBetween = (vector, petal) => Math.acos(Math.max(-1, Math.min(1,
  (vector[0] * petal.ux + vector[1] * petal.uy) / Math.hypot(vector[0], vector[1])))) * 180 / Math.PI;

/** Groups of marked cells, two cells being grouped when they lie within two cells of each other. */
function groups(marked) {
  const label = new Int32Array(CELLS).fill(-1), found = [];
  for (let seed = 0; seed < CELLS; seed++) {
    if (!marked[seed] || label[seed] >= 0) continue;
    const members = [seed];
    label[seed] = found.length;
    for (let at = 0; at < members.length; at++) {
      const column = members[at] % COLUMNS, row = Math.floor(members[at] / COLUMNS);
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        const r = row + dr, c = column + dc;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLUMNS) continue;
        const cell = r * COLUMNS + c;
        if (marked[cell] && label[cell] < 0) { label[cell] = found.length; members.push(cell); }
      }
    }
    found.push(members);
  }
  return found;
}

test("a detector that sees two consecutive frames finds the flower, petal by petal", () => {
  const before = new Uint8Array(CELLS), after = new Uint8Array(CELLS);
  const PAIRS = 8;
  const report = {};
  for (const flower of bloom.flowers) {
    const { from, to } = fullSpeed(flower);
    assert.ok(to - from >= 3 * FPS, `${flower.name} is whole for only ${to - from} frames`);
    const cellsOf = flower.petals.map(() => []);
    flower.owner.forEach((owner, cell) => { if (owner >= 0) cellsOf[owner].push(cell); });
    let leastChanged = Infinity, leastGrouped = Infinity, leastCovered = Infinity, worstOnePair = 0, worstRun = 0, runs = 0;
    for (const clock of [from, Math.floor((from + to) / 2) + FPS, to - PAIRS]) {
      const first = frameOfClock(clock);
      assert.ok(first + PAIRS < HOLD.from || first >= HOLD.to, "a run of pairs crosses the recorded hold");
      const everChanged = new Uint8Array(CELLS);
      const sums = flower.petals.map(() => [0, 0]);
      for (let pair = 0; pair < PAIRS; pair++) {
        frameSheet(bloom, paper, first + pair, before);
        frameSheet(bloom, paper, first + pair + 1, after);
        // Every cell that changed lies in a petal of the open flower: the difference of two
        // frames is a picture of the flower and of nothing else.
        const changed = flower.petals.map(() => 0);
        for (let cell = 0; cell < CELLS; cell++) {
          if (before[cell] === after[cell]) continue;
          assert.ok(flower.owner[cell] >= 0, `a cell outside ${flower.name} changed`);
          changed[flower.owner[cell]]++;
          everChanged[cell] = 1;
        }
        for (const petal of flower.petals) {
          leastChanged = Math.min(leastChanged, changed[petal.index] / cellsOf[petal.index].length);
          // One pair of frames already says which way each petal's ink is going.
          worstOnePair = Math.max(worstOnePair, degreesBetween(drift(before, after, cellsOf[petal.index]), petal));
          drift(before, after, cellsOf[petal.index], sums[petal.index]);
        }
      }
      // A short run of pairs says it closely enough to tell every petal from its
      // neighbours: each drift is nearer its own petal's axis than any other's.
      for (const petal of flower.petals) {
        const angle = degreesBetween(sums[petal.index], petal);
        worstRun = Math.max(worstRun, angle);
        for (const other of flower.petals) {
          assert.ok(other === petal || degreesBetween(sums[petal.index], other) > angle,
            `${flower.name}: petal ${petal.index} drifts along petal ${other.index}`);
        }
      }
      // And the cells that changed in the run fall apart into the petals themselves: one
      // group for each, holding nearly all of its changed cells and reaching into no other.
      const large = groups(everChanged).filter((members) => members.length >= 200);
      assert.equal(large.length, flower.petals.length, `${flower.name}: ${large.length} groups of changed cells`);
      const claimed = new Set();
      for (const members of large) {
        const petal = flower.owner[members[0]];
        for (const cell of members) assert.equal(flower.owner[cell], petal);
        const changedHere = cellsOf[petal].filter((cell) => everChanged[cell]).length;
        leastGrouped = Math.min(leastGrouped, members.length / changedHere);
        leastCovered = Math.min(leastCovered, members.length / cellsOf[petal].length);
        claimed.add(petal);
      }
      assert.equal(claimed.size, flower.petals.length);
      runs++;
    }
    assert.equal(runs, 3);
    assert.ok(leastChanged > 0.08, `${flower.name}: a petal changed in only ${leastChanged} of its cells`);
    // Half the angle between neighbouring petals is the most a drift may stray and still
    // point along its own petal; one pair stays within that, a run within half of it.
    assert.ok(worstOnePair < 180 / flower.petals.length, `${flower.name}: one pair puts a drift ${worstOnePair} degrees off its axis`);
    assert.ok(worstRun < 90 / flower.petals.length, `${flower.name}: a run puts a drift ${worstRun} degrees off its axis`);
    assert.ok(leastGrouped > 0.97, `${flower.name}: a petal's group holds only ${leastGrouped} of its changed cells`);
    assert.ok(leastCovered > 0.4, `${flower.name}: a petal's group covers only ${leastCovered} of it`);
    report[flower.name] = { leastChanged, leastGrouped, leastCovered, worstOnePair, worstRun };
  }
  // Stop the clock and the same detector has nothing to see: no cell differs.
  for (let frame = HOLD.from; frame < HOLD.to; frame++) {
    frameSheet(bloom, paper, frame, before);
    frameSheet(bloom, paper, frame + 1, after);
    assert.deepEqual(after, before);
  }
  console.log(JSON.stringify(report));
});
