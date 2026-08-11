import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CHILD_RATIO,
  FINAL_HOLD_FRAMES,
  GENERATIONS,
  PEAK_ANGLE,
  STAGE_RATIO,
  TOTAL_FRAMES,
  accelerandoPlan,
  eruptionSegments,
  generationSegments,
  perimeter,
  sceneAt,
  subdivide,
  unitSquare
} from "../artworks/koch-curves/substitution.js";

const span = (segment) => Math.hypot(
  segment.end.x - segment.start.x,
  segment.end.y - segment.start.y
);

test("the law: four equal children joining the parent's own endpoints, one peak off the line", () => {
  const parent = { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
  const children = subdivide(parent);

  assert.equal(children.length, 4);
  assert.deepEqual(children[0].start, parent.start);
  assert.deepEqual(children[3].end, parent.end);
  for (const child of children) {
    assert.ok(Math.abs(span(child) - CHILD_RATIO) < 1e-12);
  }
  // The two feet stay on the parent's line; only the peak leaves it.
  assert.ok(Math.abs(children[0].end.y) < 1e-12);
  assert.ok(Math.abs(children[2].end.y) < 1e-12);
  assert.ok(Math.abs(Math.abs(children[1].end.y) - CHILD_RATIO * Math.sin(PEAK_ANGLE)) < 1e-12);
});

test("every generation multiplies the rim by the same factor, and it runs away", () => {
  const factor = 4 * CHILD_RATIO;
  assert.ok(Math.abs(factor - 2 / (1 + Math.cos(PEAK_ANGLE))) < 1e-12);
  assert.ok(factor > 1.8);

  let previous = perimeter(generationSegments(0));
  assert.ok(Math.abs(previous - 4) < 1e-12);
  for (let generation = 1; generation <= GENERATIONS; generation += 1) {
    const now = perimeter(generationSegments(generation));
    assert.ok(Math.abs(now / previous - factor) < 1e-9);
    previous = now;
  }
  // Five generations more than twentyfold the square's rim around the same ground.
  assert.ok(previous / 4 > 20);
});

test("the similarity dimension the angle implies is measured, not assumed", () => {
  // Count ratio four per generation, scale ratio one over the child ratio.
  const counts = [0, 1, 2].map((generation) => generationSegments(generation).length);
  assert.equal(counts[1] / counts[0], 4);
  assert.equal(counts[2] / counts[1], 4);
  const dimension = Math.log(4) / Math.log(1 / CHILD_RATIO);
  assert.ok(dimension > 1.7 && dimension < 1.8);
});

test("an eruption starts flat at exactly the old length and lands exactly on the next generation", () => {
  for (const generation of [0, 2]) {
    const flat = eruptionSegments(generation, 0);
    assert.ok(Math.abs(
      perimeter(flat) - perimeter(generationSegments(generation))
    ) < 1e-9);

    const landed = eruptionSegments(generation, 1);
    const next = generationSegments(generation + 1);
    assert.equal(landed.length, next.length);
    for (let index = 0; index < next.length; index += 1) {
      assert.ok(Math.hypot(
        landed[index].start.x - next[index].start.x,
        landed[index].start.y - next[index].start.y
      ) < 1e-12);
    }
  }
});

test("the accelerando: each stage takes six tenths of the last, and the plan lands on the clip", () => {
  const plan = accelerandoPlan();

  assert.equal(plan.length, GENERATIONS);
  assert.equal(STAGE_RATIO, 0.6);
  const stageFrames = plan.map((stage) => stage.holdFrames + stage.eruptionFrames);
  for (let index = 1; index < stageFrames.length; index += 1) {
    assert.ok(stageFrames[index] < stageFrames[index - 1]);
  }
  // Geometric within a frame of rounding.
  for (let index = 1; index < stageFrames.length; index += 1) {
    assert.ok(Math.abs(stageFrames[index] - stageFrames[index - 1] * STAGE_RATIO) <= 1);
  }
  assert.equal(
    stageFrames.reduce((sum, frames) => sum + frames, 0) + FINAL_HOLD_FRAMES,
    TOTAL_FRAMES
  );
  for (const stage of plan) {
    assert.ok(stage.holdFrames >= 1);
    assert.ok(stage.eruptionFrames >= 1);
  }
});

test("the clip opens on the plain square, ends on the finished rim, and never steps back", () => {
  assert.deepEqual(sceneAt(0), { generation: 0, blend: 0 });
  assert.deepEqual(sceneAt(TOTAL_FRAMES - 1), { generation: GENERATIONS, blend: 0 });
  assert.equal(unitSquare().length, 4);
  let previous = -1;
  for (let frameIndex = 0; frameIndex < TOTAL_FRAMES; frameIndex += 1) {
    const scene = sceneAt(frameIndex);
    const position = scene.generation + scene.blend;
    assert.ok(position >= previous - 1e-12);
    previous = position;
  }
});

test("the clip's arithmetic matches the manifest, which now declares a video", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "koch-curves");

  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.durationSeconds * 30, TOTAL_FRAMES);
});
