import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CATENARY_PARAMETER,
  HALF_SPAN,
  NODE_COUNT,
  TOTAL_FRAMES,
  archResidual,
  archShareAt,
  hangingNodes,
  hangingResidual,
  jointLoads,
  reflectedNodes,
  reflectionProgressAt,
  sagAt
} from "../artworks/what-hangs-stands/funicular.js";

const HANGING = hangingNodes();
const ARCH = reflectedNodes(HANGING);
const LOADS = jointLoads(HANGING);

test("the sampled catenary lands exactly on both supports", () => {
  assert.equal(HANGING.length, NODE_COUNT);
  assert.equal(HANGING[0].x, -HALF_SPAN);
  assert.equal(HANGING.at(-1).x, HALF_SPAN);
  assert.equal(HANGING[0].y, 0);
  assert.equal(HANGING.at(-1).y, 0);
  assert.equal(sagAt(-HALF_SPAN), 0);
  assert.equal(sagAt(HALF_SPAN), 0);
});

test("the chain follows the stated catenary and sags by a visible amount", () => {
  for (const node of HANGING) {
    assert.equal(node.y, CATENARY_PARAMETER * (
      Math.cosh(HALF_SPAN / CATENARY_PARAMETER) - Math.cosh(node.x / CATENARY_PARAMETER)
    ));
  }
  const crown = HANGING[(NODE_COUNT - 1) / 2];
  assert.ok(crown.y > 160 && crown.y < 190, `sag is only ${crown.y}`);
});

test("the arch is the chain reflected across the springing line and nothing else", () => {
  HANGING.forEach((node, index) => {
    assert.equal(ARCH[index].x, node.x);
    assert.equal(ARCH[index].y, -node.y);
  });
});

test("both funicular polygons are bilaterally symmetric", () => {
  HANGING.forEach((node, index) => {
    const opposite = HANGING.at(-index - 1);
    assert.ok(Math.abs(node.x + opposite.x) < 1e-12);
    assert.ok(Math.abs(node.y - opposite.y) < 1e-12);
  });
});

test("every required joint load points down and mirrors its partner", () => {
  assert.equal(LOADS.length, NODE_COUNT - 2);
  LOADS.forEach(({ load }, index) => {
    assert.ok(load > 0, `joint ${index + 1} asks for an upward load`);
    assert.ok(Math.abs(load - LOADS.at(-index - 1).load) < 1e-12);
  });
});

test("the joint loads are one uniform weight distributed along the chain", () => {
  const step = HANGING[1].x - HANGING[0].x;
  const densities = LOADS.map(({ index, load }) => {
    const x = HANGING[index].x;
    // Half of each neighbouring analytic catenary segment belongs to this joint.
    const tributaryLength = (CATENARY_PARAMETER / 2) * (
      Math.sinh((x + step) / CATENARY_PARAMETER)
      - Math.sinh((x - step) / CATENARY_PARAMETER)
    );
    return load / tributaryLength;
  });
  for (const density of densities) {
    assert.ok(Math.abs(density - densities[0]) < 1e-14);
  }
});

test("tension and the vertical loads balance every hanging joint", () => {
  for (const { index, load } of LOADS) {
    const residual = hangingResidual(HANGING, index, load);
    assert.ok(Math.abs(residual.x) < 1e-14);
    assert.ok(Math.abs(residual.y) < 1e-12, `joint ${index} misses by ${residual.y}`);
  }
});

test("reflection turns the same force polygon into a compression-only arch", () => {
  for (const { index, load } of LOADS) {
    const residual = archResidual(ARCH, index, load);
    assert.ok(Math.abs(residual.x) < 1e-14);
    assert.ok(Math.abs(residual.y) < 1e-12, `joint ${index} misses by ${residual.y}`);
  }
});

test("the reflection is held at both exact forms and closes its ten-second loop", () => {
  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(reflectionProgressAt(0), 0);
  assert.equal(reflectionProgressAt(45), 0);
  assert.equal(reflectionProgressAt(135), 1);
  assert.equal(reflectionProgressAt(195), 1);
  assert.equal(reflectionProgressAt(285), 0);
  assert.equal(reflectionProgressAt(TOTAL_FRAMES), reflectionProgressAt(0));
});

test("the travelling frontier reveals the arch from left to right", () => {
  const frame = 90;
  assert.ok(archShareAt(-HALF_SPAN, frame) > 0.99);
  assert.ok(archShareAt(0, frame) > 0.45 && archShareAt(0, frame) < 0.55);
  assert.ok(archShareAt(HALF_SPAN, frame) < 0.01);
  for (let index = 1; index < HANGING.length; index += 1) {
    assert.ok(archShareAt(HANGING[index - 1].x, frame) >= archShareAt(HANGING[index].x, frame));
  }
});

test("the arch is in the steel of the dark, lit works, with their white heart", () => {
  // The arch's colours are All on One Circumference's own STEEL_EDGE and HEART_WHITE.
  const sketch = readFileSync(new URL("../artworks/what-hangs-stands/sketch.js", import.meta.url), "utf8");
  const reference = readFileSync(new URL("../artworks/all-on-one-circumference/sketch.js", import.meta.url), "utf8");
  const literal = (source, name) => {
    const match = source.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`, "u"));
    assert.ok(match, `${name} is not declared`);
    return JSON.parse(match[1]);
  };
  assert.deepEqual(literal(sketch, "ARCH"), literal(reference, "STEEL_EDGE"));
  assert.deepEqual(literal(sketch, "HEART"), literal(reference, "HEART_WHITE"));
  // The halo's two passes, and the standing run drawn as one path per pass.
  assert.match(sketch, /const HALO_PASSES = \[\[26, 26\], \[52, 14\]\];/u);
  assert.match(sketch, /runPaths\(p, nodes, run\)/u);
});

/**
 * The halo at the frontier. Strokes are added, so two halos that meet add up: a segment at
 * the frontier drawn on its own, with round ends, piled onto the standing run's halo at the
 * joint they share and onto its neighbour's, and made a bright bead there brighter than the
 * halo it stood beside. The sketch is run on a stand-in for p5 that records every stroke,
 * every frame, and at every joint the light the halo strokes add is summed as the canvas
 * would sum it -- added strokes add; in the frontier's layer the brighter of two strokes
 * wins, the standing run is cut out, and the layer is added once -- and held to the
 * standing run's own level.
 */
async function haloLevels(sketchUrl) {
  const frames = [];
  let record;
  const target = () => ({ blend: "BLEND", stroke: null, weight: 1, path: null });
  function surface(onDraw) {
    const state = target();
    return {
      state,
      ADD: "ADD", BLEND: "BLEND", LIGHTEST: "LIGHTEST",
      push() {}, pop() {}, scale() {}, noFill() {}, noStroke() {}, fill() {}, circle() {}, frameRate() {}, noLoop() {},
      background() { onDraw({ kind: "clear" }); },
      blendMode(mode) { state.blend = mode; },
      stroke(...colour) { state.stroke = colour.length === 1 ? [colour[0], colour[0], colour[0], 255] : colour; },
      strokeWeight(weight) { state.weight = weight; },
      line(ax, ay, bx, by) { onDraw({ kind: "stroke", blend: state.blend, stroke: state.stroke, weight: state.weight, points: [[ax, ay], [bx, by]] }); },
      beginShape() { state.path = []; },
      vertex(x, y) { state.path.push([x, y]); },
      endShape() { onDraw({ kind: "stroke", blend: state.blend, stroke: state.stroke, weight: state.weight, points: state.path }); state.path = null; }
    };
  }
  class RecordingP5 {
    constructor(define) {
      const p = surface((event) => record.main.push(event));
      p.createCanvas = () => ({ parent() {} });
      p.pixelDensity = () => 1;
      p.createGraphics = () => {
        const layer = surface((event) => record.layer.push(event));
        layer.pixelDensity = () => {};
        layer.elt = { remove() {} };
        return layer;
      };
      p.image = () => record.main.push({ kind: "layer", events: record.layer.splice(0) });
      define(p);
      p.setup();
    }
  }
  const priorWindow = globalThis.window;
  globalThis.window = { p5: RecordingP5, location: { search: "?capture=1&renderScale=1" } };
  try {
    record = { main: [], layer: [] };
    await import(`${sketchUrl.href}?halo=${Math.random()}`);
    for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
      record = { main: [], layer: [] };
      await window.__renderFrame(frame);
      frames.push(record.main);
    }
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
  return frames;
}

/** Whether a stroke of round ends and caps covers a point. */
function covers(stroke, [x, y]) {
  const reach = stroke.weight / 2;
  for (let index = 1; index < stroke.points.length; index += 1) {
    const [ax, ay] = stroke.points[index - 1];
    const [bx, by] = stroke.points[index];
    const length2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length2));
    if (Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) <= reach + 1e-9) return true;
  }
  return false;
}

/**
 * The most any joint of the arch receives from the halo beyond what the standing run gives,
 * over every frame, in red-channel units: positive means a bead.
 */
function worstExcess(frames, colour, joints) {
  let worst = -Infinity;
  for (const events of frames) {
    for (const weight of [26, 14]) {
      const isHalo = (event) => event.kind === "stroke" && event.weight === weight && event.blend === "ADD"
        && event.stroke[1] / event.stroke[0] === colour[1] / colour[0];
      const runs = events.filter(isHalo);
      if (runs.length === 0) continue;
      const level = colour[0] * Math.max(...runs.map((event) => event.stroke[3])) / 255;
      for (const joint of joints) {
        let total = 0;
        for (const event of events) {
          if (isHalo(event) && covers(event, joint)) total += colour[0] * event.stroke[3] / 255;
          if (event.kind === "layer") {
            // The layer, stroke by stroke as the canvas composes it: an added stroke adds,
            // the lighter of two is kept, and an opaque black stroke clears what it covers.
            let value = 0;
            for (const inner of event.events) {
              if (inner.kind !== "stroke" || inner.weight !== weight || !covers(inner, joint)) continue;
              const ownColour = inner.stroke[0] > 0 && inner.stroke[1] / inner.stroke[0] === colour[1] / colour[0];
              if (inner.blend === "BLEND" && inner.stroke[0] === 0) value = 0;
              else if (ownColour && inner.blend === "LIGHTEST") value = Math.max(value, inner.stroke[0]);
              else if (ownColour && inner.blend === "ADD") value += inner.stroke[0];
            }
            total += value;
          }
        }
        worst = Math.max(worst, total - level);
      }
    }
  }
  return worst;
}

const ARCH_JOINTS = ARCH.map((node) => [480 + node.x, 320 + node.y]);
const ARCH_COLOUR = [156, 192, 240];

test("nothing at the frontier is brighter than the arch's standing halo beside it", async () => {
  const fixed = await haloLevels(new URL("../artworks/what-hangs-stands/sketch.js", import.meta.url));
  assert.equal(fixed.length, TOTAL_FRAMES);
  // The halo is there to be measured: the arch is haloed in most frames, and in some the
  // frontier crosses it, so the layer is used.
  assert.ok(fixed.filter((events) => events.some((event) => event.kind === "layer")).length > 50);
  assert.ok(worstExcess(fixed, ARCH_COLOUR, ARCH_JOINTS) <= 1e-9);
  // The control: the sketch as it stood at 04bcd1b, frozen outside artworks/, added each
  // frontier segment on its own and piled it onto the standing run at their joint.
  const frozen = await haloLevels(new URL("./fixtures/arch-halo-frontier/sketch.js", import.meta.url));
  assert.ok(worstExcess(frozen, ARCH_COLOUR, ARCH_JOINTS) > 1, "the frozen sketch shows no bead");
});
