import assert from "node:assert/strict";
import test from "node:test";
import { hsbToRgb } from "../artworks/shared/color.js";

test("the primaries land where they should", () => {
  assert.deepEqual(hsbToRgb(0, 100, 100), [255, 0, 0]);
  assert.deepEqual(hsbToRgb(120, 100, 100), [0, 255, 0]);
  assert.deepEqual(hsbToRgb(240, 100, 100), [0, 0, 255]);
});

test("no saturation is grey and no brightness is black", () => {
  assert.deepEqual(hsbToRgb(0, 0, 100), [255, 255, 255]);
  assert.deepEqual(hsbToRgb(210, 0, 50), [128, 128, 128]);
  assert.deepEqual(hsbToRgb(200, 50, 0), [0, 0, 0]);
});

test("hue wraps rather than falling off either end", () => {
  assert.deepEqual(hsbToRgb(360, 100, 100), hsbToRgb(0, 100, 100));
  assert.deepEqual(hsbToRgb(-120, 100, 100), hsbToRgb(240, 100, 100));
  assert.deepEqual(hsbToRgb(480, 100, 100), hsbToRgb(120, 100, 100));
});

test("a hue between two primaries mixes them in the right order", () => {
  const [red, green, blue] = hsbToRgb(350, 80, 60);
  assert.ok(red > green && red > blue, "deep magenta reads as red-dominant");
  const [, teal] = hsbToRgb(190, 80, 60);
  assert.ok(teal > 0, "and the tide palette's cyan has green in it");
});
