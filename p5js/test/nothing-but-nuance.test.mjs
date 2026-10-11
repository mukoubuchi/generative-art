import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  SIZE, FPS, DURATION, FRAMES, GRID, MODES, GROUND, GOLD, BONE,
  frameAt, fieldAt, makeSampler, sample, surfaceAt, colourAt
} from "../artworks/nothing-but-nuance/field.js";

const power = (modes, progress) => {
  let sum = 0;
  // Twenty points per axis resolve all differences of the integer wave numbers.
  for (let y = 0; y < 20; y += 1) for (let x = 0; x < 20; x += 1) {
    sum += fieldAt(x / 20, y / 20, progress, modes).intensity;
  }
  return sum / 400;
};

test("distinct integer modes have fixed amplitudes and quadratic propagation rates", () => {
  assert.equal(MODES.length, 24);
  assert.equal(new Set(MODES.map(({ m, n }) => `${m},${n}`)).size, MODES.length);
  assert.deepEqual([...new Set(MODES.map(({ rate }) => rate))].sort((a, b) => a - b), [0, 2, 3, 8, 11, 15]);
  for (const mode of MODES) {
    assert.ok(Number.isInteger(mode.m) && Number.isInteger(mode.n));
    assert.equal(mode.rate + 50, mode.m ** 2 + mode.n ** 2);
    assert.ok(mode.amplitude > 0);
  }
  assert.ok(Math.abs(MODES.reduce((sum, { amplitude }) => sum + amplitude ** 2, 0) - 1) < 1e-14);
});

test("direct spatial integration conserves full-cell power at every video frame", () => {
  let worst = 0;
  for (let frame = 0; frame <= FRAMES; frame += 1) worst = Math.max(worst, Math.abs(power(MODES, frame / FRAMES) - 1));
  assert.ok(worst < 1e-12, `full-cell power differs by ${worst}`);
  // A fixed magnitude change breaks unit normalization, but still conserves power.
  const brighter = MODES.map((mode, i) => ({ ...mode, amplitude: mode.amplitude * (i === 0 ? 2 : 1) }));
  assert.ok(power(brighter, 0.3) > 1.05);
  assert.ok(Math.abs(power(brighter, 0.3) - power(brighter, 0)) < 1e-12);
  // A propagation-dependent magnitude loses conservation between positions.
  const gainAt = (s) => MODES.map((mode, i) => ({ ...mode, amplitude: mode.amplitude * (i === 0 ? 1 + s : 1) }));
  assert.ok(Math.abs(power(gainAt(0), 0) - 1) < 1e-12);
  assert.ok(power(gainAt(1), 1) - power(gainAt(0), 0) > 0.05);
});

test("the field returns through its integer propagation phases, with a contrary noninteger rate", () => {
  let worst = 0, contrary = 0;
  const broken = MODES.map((mode, i) => ({ ...mode, rate: mode.rate + (i === 0 ? 0.25 : 0) }));
  for (let i = 0; i < 1000; i += 1) {
    const x = i * 0.6180339887498949 % 1, y = i * 0.4142135623730951 % 1;
    const a = fieldAt(x, y, 0), b = fieldAt(x, y, 1);
    const c = fieldAt(x, y, 1, broken);
    worst = Math.max(worst, Math.hypot(a.re - b.re, a.im - b.im));
    contrary = Math.max(contrary, Math.abs(a.intensity - c.intensity));
  }
  assert.ok(worst < 1e-12, `return error ${worst}`);
  assert.ok(contrary > 0.5, "the noninteger-rate control did not visibly break the return");
});

test("propagation has the paraxial quadratic dispersion, measured by finite differences", () => {
  const h = 0.00001;
  function residual(x, y, t, modes) {
    const z = fieldAt(x, y, t, modes);
    const before = fieldAt(x, y, t - h, modes), after = fieldAt(x, y, t + h, modes);
    const neighbours = [fieldAt(x - h, y, t, modes), fieldAt(x + h, y, t, modes), fieldAt(x, y - h, t, modes), fieldAt(x, y + h, t, modes)];
    const lap = (key) => (neighbours.reduce((sum, value) => sum + value[key], 0) - 4 * z[key]) / h ** 2;
    // i dPsi/dt = -Laplacian(Psi)/(2pi) - 100pi Psi, the last term
    // removing the common phase of squared wave number 50.
    const re = -(after.im - before.im) / (2 * h) + lap("re") / (2 * Math.PI) + 100 * Math.PI * z.re;
    const im = (after.re - before.re) / (2 * h) + lap("im") / (2 * Math.PI) + 100 * Math.PI * z.im;
    return Math.hypot(re, im);
  }
  let worst = 0, contrary = 0;
  const linear = MODES.map((mode) => ({ ...mode, rate: mode.m + mode.n }));
  for (let i = 0; i < 30; i += 1) {
    const x = i * 0.317 % 1, y = i * 0.271 % 1, t = i * 0.137 % 1;
    worst = Math.max(worst, residual(x, y, t, MODES));
    contrary = Math.max(contrary, residual(x, y, t, linear));
  }
  assert.ok(worst < 0.0003, `quadratic propagation residual ${worst}`);
  assert.ok(contrary > 10, "a linear dispersion should fail the paraxial equation");
});

test("the separable renderer agrees with direct plane-wave evaluation and bounded interpolation", () => {
  const sampler = makeSampler();
  assert.equal(GRID & (GRID - 1), 0, "the renderer's periodic index masks need a power-of-two grid");
  let worst = 0, gridError = 0;
  for (const t of [0, 0.13, 0.25, 0.43, 0.5, 0.67, 0.83]) {
    sampler.at(t);
    for (let i = 0; i < 1000; i += 1) {
      const x = i * 0.6180339887 % 1, y = i * 0.4142135623 % 1;
      worst = Math.max(worst, Math.abs(sample(sampler, x, y) - fieldAt(x, y, t).intensity));
      const ix = i * 31 % GRID, iy = i * 47 % GRID;
      const exact = fieldAt(ix / GRID, iy / GRID, t);
      gridError = Math.max(gridError, Math.hypot(sampler.re[iy * GRID + ix] - exact.re, sampler.im[iy * GRID + ix] - exact.im));
    }
  }
  assert.ok(gridError < 1e-12, `grid error ${gridError}`);
  assert.ok(worst < 0.06, `interpolated intensity error ${worst}`);
  // Capture order must not become part of the state.
  const first = [...sampler.at(0.13).re];
  sampler.at(0.77);
  assert.deepEqual([...sampler.at(0.13).re], first);
});

test("stationary shears are invertible and periodic, and the palette is inherited", () => {
  const tau = 2 * Math.PI;
  for (let i = 0; i < 100; i += 1) {
    const x = i * 0.317 % 1, y = i * 0.271 % 1;
    const { u, v } = surfaceAt(x, y);
    const backY = v - 0.12 * Math.sin(tau * u + 0.5) - 0.025 * Math.sin(3 * tau * u);
    const backX = u - 0.145 * Math.sin(tau * backY) - 0.035 * Math.sin(2 * tau * backY + 0.7);
    assert.ok(Math.hypot(backX - x, backY - y) < 1e-14);
    const across = surfaceAt(x + 1, y), down = surfaceAt(x, y + 1);
    assert.ok(Math.abs(across.u - u - 1) < 1e-14 && Math.abs(across.v - v) < 1e-14);
    assert.ok(Math.abs(down.u - u) < 1e-14 && Math.abs(down.v - v - 1) < 1e-14);
  }
  const rings = readFileSync(new URL("../artworks/moire-rings/sketch.js", import.meta.url), "utf8");
  const net = readFileSync(new URL("../artworks/by-misunderstanding/sketch.js", import.meta.url), "utf8");
  const value = (source, key) => JSON.parse(source.match(new RegExp(`const ${key} = (\\[[^;]+\\]);`, "u"))[1]);
  assert.deepEqual(GROUND, value(rings, "BACKGROUND"));
  assert.deepEqual(GOLD, value(rings, "WANDERING_RING").slice(0, 3));
  assert.deepEqual(BONE, value(net, "BONE"));
  assert.deepEqual(colourAt(0), GROUND);
  assert.deepEqual(colourAt(100), BONE);
});

test("phase changes reshape the picture; frozen phases and incoherent intensity cannot", () => {
  const frozen = MODES.map((mode) => ({ ...mode, rate: 0 }));
  let difference = 0, frozenDifference = 0, low = Infinity, high = 0;
  for (let y = 0; y < 40; y += 1) for (let x = 0; x < 40; x += 1) {
    const { u, v } = surfaceAt(x / 40, y / 40);
    const a = fieldAt(u, v, 0).intensity, b = fieldAt(u, v, 0.1625).intensity;
    difference += Math.abs(a - b);
    frozenDifference += Math.abs(fieldAt(u, v, 0, frozen).intensity - fieldAt(u, v, 0.1625, frozen).intensity);
    low = Math.min(low, a); high = Math.max(high, a);
  }
  assert.ok(difference / 1600 > 0.5);
  assert.equal(frozenDifference, 0);
  assert.ok(low < 0.01 && high > 4);
  // Summing intensities instead of complex amplitudes would erase every fringe.
  const incoherent = MODES.reduce((sum, mode) => sum + mode.amplitude ** 2, 0);
  assert.ok(incoherent > low + 0.5 && incoherent < high - 0.5);
});

test("catalog, quotation and loop timing agree and the public post omits the date", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url)));
  const catalog = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url)));
  const artwork = manifest.artworks.find(({ id }) => id === "nothing-but-nuance");
  const quote = catalog.quotes.find(({ id }) => id === "verlaine-nuance");
  assert.deepEqual(artwork.canvas, { width: SIZE, height: SIZE });
  assert.equal(artwork.render.durationSeconds, DURATION);
  assert.equal(manifest.defaults.fps, FPS);
  assert.equal(FRAMES, FPS * DURATION);
  assert.deepEqual(artwork.quoteIds, [quote.id]);
  assert.equal(quote.text, "Not Colour, nothing but nuance!");
  assert.equal(quote.original.text, "Pas la Couleur, rien que la nuance !");
  assert.equal(quote.original.lang, "fr");
  assert.equal(quote.rendering, "English rendering");
  assert.equal(quote.year, 1882);
  const body = buildPostBody(artwork, quote, manifest.defaults.interactiveBaseUrl);
  validatePostBody(body, manifest.defaults.maxWeightedCharacters);
  assert.ok(body.includes("— Paul Verlaine, Art of Poetry"));
  assert.ok(!body.includes("1882") && !body.includes("1884"));
  assert.equal(frameAt(0), 0);
  assert.equal(frameAt(DURATION - 1 / FPS), FRAMES - 1);
  assert.equal(frameAt(DURATION), 0);
  assert.equal(frameAt(DURATION + 1), FPS);
});
