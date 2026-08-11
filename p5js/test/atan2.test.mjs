import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  angleArc,
  angleTone,
  centreLegs,
  needleAngle,
  needleGrid,
  orbitPoint
} from "../artworks/atan2/compass.js";

const PLAYBACK_FPS = 30;
const SWEEP_SECONDS = 10;
const TOTAL_FRAMES = SWEEP_SECONDS * PLAYBACK_FPS;
const WIDTH = 680;
const HEIGHT = 680;
const SPACING = 40;
const MARGIN = 34;

test("the centre needle answers exactly as the original single point did", () => {
  const origin = { x: 0, y: 0 };

  assert.equal(needleAngle(origin, { x: 10, y: 0 }), 0);
  assert.equal(needleAngle(origin, { x: 0, y: 10 }), Math.PI / 2);
  assert.equal(needleAngle(origin, { x: -10, y: 0 }), Math.PI);
  assert.equal(needleAngle(origin, { x: 0, y: -10 }), -Math.PI / 2);
  for (const probe of [{ x: 3, y: 4 }, { x: -5, y: 2 }, { x: -1, y: -7 }]) {
    assert.equal(needleAngle(origin, probe), Math.atan2(probe.y, probe.x));
  }
});

test("the answer jumps a whole turn across the ray due east of the probe, and only there", () => {
  const probe = { x: 47, y: -23 };
  const radius = 150;
  const samples = 3600;
  const angles = [];
  for (let index = 0; index < samples; index += 1) {
    const around = (index / samples) * 2 * Math.PI;
    const foot = {
      x: probe.x + radius * Math.cos(around),
      y: probe.y + radius * Math.sin(around)
    };
    angles.push({ around, answer: needleAngle(foot, probe) });
  }

  const jumps = [];
  for (let index = 0; index < samples; index += 1) {
    const here = angles[index];
    const next = angles[(index + 1) % samples];
    if (Math.abs(next.answer - here.answer) > Math.PI) {
      jumps.push(here);
    }
  }

  // One seam, not several, and it sits on the eastern ray: the walk around the probe
  // crosses due east where its parameter passes zero.
  assert.equal(jumps.length, 1);
  const seam = jumps[0].around;
  assert.ok(Math.min(seam, 2 * Math.PI - seam) < (2 * Math.PI) / samples + 1e-9);
  // And the answers at the seam collide at full depth: +PI meeting -PI.
  assert.ok(Math.abs(Math.abs(jumps[0].answer) - Math.PI) < 0.01);
});

test("west of the probe the two families meet smoothly at zero: the other ray has no seam", () => {
  const probe = { x: 47, y: -23 };
  const nudge = 1e-6;
  for (const distance of [40, 120, 280]) {
    const above = needleAngle({ x: probe.x - distance, y: probe.y - nudge }, probe);
    const below = needleAngle({ x: probe.x - distance, y: probe.y + nudge }, probe);
    assert.ok(Math.abs(above) < 1e-6);
    assert.ok(Math.abs(below) < 1e-6);
    assert.ok(Math.abs(above - below) < 1e-6);
  }
});

test("the colour is the answer: family by sign, depth by magnitude, full depth at the seam", () => {
  assert.equal(angleTone(0).family, "zero");
  assert.equal(angleTone(0).strength, 0);
  assert.equal(angleTone(1).family, "gold");
  assert.equal(angleTone(-1).family, "steel");
  assert.equal(angleTone(Math.PI).strength, 1);
  assert.equal(angleTone(-Math.PI).strength, 1);
  for (let angle = 0.1; angle < Math.PI; angle += 0.1) {
    assert.ok(angleTone(angle).strength > angleTone(angle - 0.1).strength);
    assert.equal(angleTone(angle).strength, angleTone(-angle).strength);
  }
});

test("the grid is odd by odd, keeps its margin, and seats one needle exactly at the centre", () => {
  const feet = needleGrid(WIDTH, HEIGHT, SPACING, MARGIN);
  const columns = new Set(feet.map((foot) => foot.x)).size;
  const rows = new Set(feet.map((foot) => foot.y)).size;

  assert.equal(columns % 2, 1);
  assert.equal(rows % 2, 1);
  assert.equal(feet.length, columns * rows);
  assert.ok(feet.some((foot) => foot.x === 0 && foot.y === 0));
  for (const foot of feet) {
    assert.ok(Math.abs(foot.x) <= WIDTH / 2 - MARGIN);
    assert.ok(Math.abs(foot.y) <= HEIGHT / 2 - MARGIN);
  }
});

test("the orbit closes on itself and carries the seam across every row it can reach", () => {
  const radius = 204;
  const first = orbitPoint(0, TOTAL_FRAMES, radius);
  const last = orbitPoint(TOTAL_FRAMES, TOTAL_FRAMES, radius);
  assert.ok(Math.hypot(first.x - last.x, first.y - last.y) < 1e-9);

  // The probe's row — where the seam lives — visits the whole band the orbit spans.
  let lowest = Infinity;
  let highest = -Infinity;
  for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
    const { y } = orbitPoint(frame, TOTAL_FRAMES, radius);
    lowest = Math.min(lowest, y);
    highest = Math.max(highest, y);
  }
  assert.ok(Math.abs(lowest + radius) < 0.1);
  assert.ok(Math.abs(highest - radius) < 0.1);
});

test("the centre's two legs divide the journey faithfully", () => {
  const probe = { x: 123, y: -78 };
  const legs = centreLegs(probe);

  assert.deepEqual(legs.horizontal.from, { x: 0, y: 0 });
  assert.equal(legs.horizontal.to.y, 0);
  assert.equal(legs.vertical.from.x, legs.horizontal.to.x);
  assert.deepEqual(legs.vertical.to, probe);
  const walked = {
    x: legs.horizontal.to.x - legs.horizontal.from.x + legs.vertical.to.x - legs.vertical.from.x,
    y: legs.horizontal.to.y - legs.horizontal.from.y + legs.vertical.to.y - legs.vertical.from.y
  };
  assert.deepEqual(walked, probe);
});

test("the angle arc runs from the x axis whichever sign the answer takes", () => {
  assert.deepEqual(angleArc(1.2), { start: 0, end: 1.2 });
  assert.deepEqual(angleArc(-0.7), { start: -0.7, end: 0 });
});

test("the clip's arithmetic matches the manifest", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "atan2");

  assert.equal(TOTAL_FRAMES, 300);
  assert.equal(artwork.render.durationSeconds, SWEEP_SECONDS);
});
