import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { publicSource } from "../lib/citation.mjs";
import { escapeHtml, renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";
import {
  CATCH_UP_FRAMES, DT, DURATION_SECONDS, FRICTION_SECONDS, LIFT_THRESHOLD, LOGICAL_SIZE, MODES, MODE_SUM, ONSET,
  PLATE_SIZE, PLAYBACK_FPS, RELEASE, SHAPES, STROKE_SECONDS, SUBSTEPS, TOTAL_FRAMES,
  advanceGrains, agitation, createFields, createGrains, excitationAt,
  fieldAt, gradientAt, nearNodeFraction, nextPageFrame, reachFrame, sampleField, stepsTo
} from "../artworks/those-unheard/field.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const CATALOG = JSON.parse(readFileSync(new URL("../quotes.json", import.meta.url), "utf8"));
const NOTES = readFileSync(new URL("../README.md", import.meta.url), "utf8");

const fields = createFields();

test("the complete four-dimensional eigenspace has integer mode sum 130", () => {
  const independentlyEnumerated = [];
  for (let m = 0; m * m <= MODE_SUM; m += 1) {
    for (let n = 0; n * n <= MODE_SUM; n += 1) {
      if (m * m + n * n === MODE_SUM) independentlyEnumerated.push([m, n]);
    }
  }
  assert.equal(MODES.length, 4);
  assert.deepEqual(MODES, independentlyEnumerated);
  for (const [m, n] of MODES) assert.equal(m * m + n * n, 130);
});

test("spatial finite differences obey Delta psi + 130*pi^2*psi = 0 for each shape", () => {
  // This measurement differentiates field samples, not the module's analytic derivative.
  const h = 0.0001;
  function worstResidual(coefficients, modes = MODES) {
    let worst = 0;
    for (let i = 1; i <= 17; i += 1) {
      for (let j = 1; j <= 19; j += 1) {
        const x = i / 18;
        const y = j / 20;
        const centre = fieldAt(coefficients, x, y, modes);
        const laplacian = (fieldAt(coefficients, x + h, y, modes)
          + fieldAt(coefficients, x - h, y, modes)
          + fieldAt(coefficients, x, y + h, modes)
          + fieldAt(coefficients, x, y - h, modes) - 4 * centre) / (h * h);
        worst = Math.max(worst, Math.abs(laplacian + 130 * Math.PI ** 2 * centre));
      }
    }
    return worst;
  }
  for (const shape of SHAPES) assert.ok(worstResidual(shape.coefficients) < 0.002);
  // The neighbouring mode (4, 11) looks alike but has another eigenvalue.
  const changedMode = MODES.map(([m, n], k) => [k === 0 ? m + 1 : m, n]);
  assert.ok(worstResidual(SHAPES[0].coefficients, changedMode) > 20,
    "the wrong-eigenvalue control must fail the same numerical measurement");
});

test("the central cross is exactly nodal in every shape and its sampled envelope", () => {
  for (const [index, shape] of SHAPES.entries()) {
    for (let k = 0; k <= 512; k += 1) {
      const t = k / 512;
      assert.equal(fieldAt(shape.coefficients, 0.5, t), 0);
      assert.equal(fieldAt(shape.coefficients, t, 0.5), 0);
      assert.equal(sampleField(fields[index], 0.5, t), 0);
      assert.equal(sampleField(fields[index], t, 0.5), 0);
    }
  }
  const wrongParity = [[4, 11], ...MODES.slice(1)];
  assert.ok(Math.abs(fieldAt(SHAPES[0].coefficients, 0.5, 0.13, wrongParity)) > 0.05);
  // The exact zeros above come from the x === 1/2 branch. A billionth to either side, the
  // basis itself must already be at the node.
  for (const shape of SHAPES) {
    for (let k = 0; k <= 512; k += 1) {
      const t = k / 512;
      for (const offset of [-1e-9, 1e-9]) {
        assert.ok(Math.abs(fieldAt(shape.coefficients, 0.5 + offset, t)) < 1e-7);
        assert.ok(Math.abs(fieldAt(shape.coefficients, t, 0.5 + offset)) < 1e-7);
      }
    }
  }
});

test("the Neumann edges and the extra point constraint belong to the actual shapes", () => {
  // The normal derivative on each edge, differenced from the field across the edge, so the
  // module's analytic gradient (which is zero on an edge by construction) is not consulted.
  const h = 1e-6;
  function worstNormalDerivative(coefficients, modes = MODES) {
    let worst = 0;
    for (let k = 0; k <= 40; k += 1) {
      const t = k / 40;
      for (const edge of [0, 1]) {
        worst = Math.max(worst,
          Math.abs(fieldAt(coefficients, edge + h, t, modes) - fieldAt(coefficients, edge - h, t, modes)) / (2 * h),
          Math.abs(fieldAt(coefficients, t, edge + h, modes) - fieldAt(coefficients, t, edge - h, modes)) / (2 * h));
      }
    }
    return worst;
  }
  for (const shape of SHAPES) {
    assert.ok(worstNormalDerivative(shape.coefficients) < 1e-6);
    if (shape.hold) assert.ok(Math.abs(fieldAt(shape.coefficients, ...shape.hold)) < 1e-14);
  }
  // A half-integer mode is not Neumann at x = 1, and the same measurement must say so.
  assert.ok(worstNormalDerivative(SHAPES[0].coefficients, [[3.5, 11], ...MODES.slice(1)]) > 1);
  // The eigenvalue alone does not force the drawings to be the same.
  const readings = SHAPES.map(({ coefficients }) => fieldAt(coefficients, 0.17, 0.29));
  for (let i = 0; i < readings.length; i += 1) {
    for (let j = i + 1; j < readings.length; j += 1) assert.ok(Math.abs(readings[i] - readings[j]) > 0.01);
  }
});

test("the analytic gradient agrees with the field's own central differences", () => {
  // nearNodeFraction divides |psi| by |grad psi|, so a wrong gradient would misreport how
  // many grains have gathered. The gradient is checked against the field it belongs to.
  const h = 1e-6;
  let worst = 0;
  for (const shape of SHAPES) {
    for (let i = 0; i < 37; i += 1) {
      for (let j = 0; j < 41; j += 1) {
        const x = (i + 0.37) / 37;
        const y = (j + 0.61) / 41;
        const [dx, dy] = gradientAt(shape.coefficients, x, y);
        worst = Math.max(worst,
          Math.abs(dx - (fieldAt(shape.coefficients, x + h, y) - fieldAt(shape.coefficients, x - h, y)) / (2 * h)),
          Math.abs(dy - (fieldAt(shape.coefficients, x, y + h) - fieldAt(shape.coefficients, x, y - h)) / (2 * h)));
      }
    }
  }
  assert.ok(worst < 1e-6, `gradient disagrees with the field by ${worst}`);
});

test("the interpolated driving field stays close to the analytic eigenfunction", () => {
  let worst = 0;
  for (const field of fields) {
    for (let row = 0; row < 85; row += 1) {
      for (let column = 0; column < 87; column += 1) {
        const x = (column + 0.37) / 87;
        const y = (row + 0.61) / 85;
        worst = Math.max(worst, Math.abs(sampleField(field, x, y) - fieldAt(field.coefficients, x, y)));
      }
    }
  }
  assert.ok(worst < 0.0013, `field interpolation error: ${worst}`);
});

test("the excitation rises gradually, rings down, and finishes below the lift threshold", () => {
  for (let index = 0; index < SHAPES.length; index += 1) {
    const start = index * STROKE_SECONDS;
    assert.equal(excitationAt(start).amplitude, 0);
    assert.ok(excitationAt(start + ONSET + 0.4).amplitude < 0.1);
    assert.equal(excitationAt(start + ONSET + 1.4).amplitude, 1);
    assert.ok(excitationAt(start + RELEASE + 1).amplitude < LIFT_THRESHOLD);
  }
  assert.equal(excitationAt(TOTAL_FRAMES / 30).amplitude, 0);
  assert.equal(agitation(1, 0), 0);
  assert.equal(agitation(1, LIFT_THRESHOLD / 2), 0);
  assert.ok(agitation(1, 0.8) > 0.7);
});

test("grains gather near nodes by agitation, while a no-kick control does not", () => {
  const grains = createGrains({ count: 4096, fields });
  const control = createGrains({ count: 4096, fields });
  const initial = nearNodeFraction(grains, 0);
  assert.ok(initial < 0.3);
  advanceGrains(grains, Math.round(4 / DT));
  advanceGrains(control, Math.round(4 / DT), 0);
  assert.ok(nearNodeFraction(grains, 0) > 0.55);
  assert.equal(nearNodeFraction(control, 0), initial);
  for (const v of [...grains.x, ...grains.y]) assert.ok(v >= 0 && v <= 1);
  assert.equal(grains.count, 4096);
});

test("a grain at rest on the common node is not pulled onto a prescribed path", () => {
  const grains = createGrains({ count: 1, fields });
  grains.x[0] = 0.5;
  grains.y[0] = 0.23;
  advanceGrains(grains, (TOTAL_FRAMES - 1) * SUBSTEPS);
  assert.equal(grains.x[0], 0.5);
  assert.equal(grains.y[0], 0.23);
  assert.equal(grains.vx[0], 0);
  assert.equal(grains.vy[0], 0);
});

test("off the nodes, the kicks have no mean direction: nothing pulls grains towards a curve", () => {
  // A force towards the nodal curves would show as a mean velocity change towards the
  // nearest node. Many grains are kicked once from rest at the same point, at full
  // amplitude, and the mean of their velocity change is compared with its standard error.
  const count = 65_536;
  const time = 2;
  assert.equal(excitationAt(time).amplitude, 1);
  const measured = [];
  for (const [x, y] of [[0.21, 0.37], [0.63, 0.12], [0.08, 0.81], [0.37, 0.66]]) {
    const grains = createGrains({ count, fields });
    grains.steps = Math.round(time / DT);
    grains.x.fill(x);
    grains.y.fill(y);
    advanceGrains(grains, 1);
    const value = sampleField(fields[0], x, y);
    assert.ok(Math.abs(value) > 0.25, "the point is well away from a node, so it is kicked");
    // The direction a pull towards the nearest node would take: down the slope of |psi|.
    const [gx, gy] = gradientAt(fields[0].coefficients, x, y);
    const length = Math.hypot(gx, gy);
    const towards = [-Math.sign(value) * gx / length, -Math.sign(value) * gy / length];
    const along = Float64Array.from(grains.vx, (vx, k) => vx * towards[0] + grains.vy[k] * towards[1]);
    measured.push(along);
  }
  const zScore = (samples) => {
    const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
    const variance = samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (samples.length - 1);
    return mean / Math.sqrt(variance / samples.length);
  };
  for (const along of measured) {
    assert.ok(along.some((v) => v !== 0), "the grains were kicked");
    assert.ok(Math.abs(zScore(along)) < 4, `mean change towards the node is ${zScore(along).toFixed(2)} standard errors`);
  }
  // The control: the same kicks with a pull towards the node of 2 per cent of their spread
  // added. At this sample size the measurement must see it.
  for (const along of measured) {
    const spread = Math.sqrt(along.reduce((sum, v) => sum + v * v, 0) / along.length);
    assert.ok(zScore(along.map((v) => v + 0.02 * spread)) > 4);
  }
});

test("quiet grains dissipate velocity by friction, and the seeded process replays deterministically", () => {
  const grains = createGrains({ count: 128, fields });
  const replay = createGrains({ count: 128, fields });
  advanceGrains(grains, 480);
  for (let frame = 0; frame < 120; frame += 1) advanceGrains(replay);
  assert.deepEqual(grains.x, replay.x);
  assert.deepEqual(grains.y, replay.y);
  assert.equal(grains.randomState, replay.randomState);
  const quiet = createGrains({ count: 1, fields });
  quiet.steps = Math.round(23 / DT);
  quiet.x[0] = quiet.y[0] = 0.5;
  quiet.vx[0] = 0.001;
  advanceGrains(quiet, 60);
  assert.ok(Math.abs(quiet.vx[0] - 0.001 * Math.exp(-60 * DT / FRICTION_SECONDS)) < 1e-18);
  assert.ok((quiet.x[0] - 0.5) * PLATE_SIZE < 0.04);
});

test("the manifest, notes, card and post agree on the clip and the quotation", () => {
  const artwork = MANIFEST.artworks.find((entry) => entry.id === "those-unheard");
  const quote = CATALOG.quotes.find((entry) => entry.id === "keats-those-unheard");
  assert.equal(artwork.title, "Those Unheard");
  assert.equal(artwork.entry, "p5js/artworks/those-unheard/index.html");
  assert.equal(artwork.interactivePath, "those-unheard/");
  assert.deepEqual(artwork.canvas, { width: LOGICAL_SIZE, height: LOGICAL_SIZE });
  assert.deepEqual(artwork.quoteIds, ["keats-those-unheard"]);
  assert.deepEqual(artwork.thumbnail, { frame: 480 });
  assert.deepEqual(artwork.render, { kind: "video", artifact: "exports/p5js/ThoseUnheard.mp4", durationSeconds: 24, scale: 2 });
  assert.equal(artwork.render.durationSeconds, DURATION_SECONDS);
  assert.equal(artwork.render.durationSeconds * PLAYBACK_FPS, TOTAL_FRAMES);
  assert.match(NOTES, /\| `those-unheard` \| 680×680 \| 1360×1360 MP4 at 30 fps \| 24 seconds,/u);
  assert.match(NOTES, /Those Unheard begins with Keats[\s\S]*?The thumbnail is frame 480\./u);
  // The edition the wording was checked in is named, not only linked.
  assert.match(NOTES, /edited by Horace Elisha Scudder \(1899\), page 135, as \[transcribed on Wikisource\]/u);
  const body = buildPostBody(artwork, quote, MANIFEST.defaults.interactiveBaseUrl);
  assert.equal(validatePostBody(body, MANIFEST.defaults.maxWeightedCharacters), 143);
  assert.equal(body.split("\n").slice(0, 2).join("\n"), quote.text);
  const index = renderIndexPage(MANIFEST, CATALOG);
  const start = index.indexOf('<h2 class="card__title">Those Unheard</h2>');
  assert.ok(start >= 0);
  const card = index.slice(start, index.indexOf("</li>", start));
  assert.equal(card.match(/<cite class="card__cite">(.*?)<\/cite>/u)?.[1],
    `—&nbsp;<b>${escapeHtml(quote.author)}</b>, ${escapeHtml(publicSource(quote))}`);
});

test("a frame past the end holds the last figure, and an earlier frame starts the grains over", () => {
  assert.deepEqual(stepsTo(719, 0), { frame: 719, target: 719 * SUBSTEPS, restart: false });
  assert.deepEqual(stepsTo(900, 0), { frame: 719, target: 719 * SUBSTEPS, restart: false });
  assert.deepEqual(stepsTo(-5, 40), { frame: 0, target: 0, restart: true });
  assert.equal(stepsTo(10, 30 * SUBSTEPS).restart, true);
  assert.equal(stepsTo(30, 30 * SUBSTEPS).restart, false);
  assert.equal(stepsTo(31, 30 * SUBSTEPS).restart, false);

  // With real grains: forward to 30, back to 10, forward to 30 again.
  const direct = (frame) => {
    const grains = createGrains({ count: 512, fields });
    advanceGrains(grains, frame * SUBSTEPS);
    return grains;
  };
  let { grains } = reachFrame(createGrains({ count: 512, fields }), 30);
  const atThirty = { x: Float64Array.from(grains.x), y: Float64Array.from(grains.y) };
  ({ grains } = reachFrame(grains, 10));
  assert.deepEqual([grains.x, grains.y, grains.steps], [direct(10).x, direct(10).y, 10 * SUBSTEPS]);
  ({ grains } = reachFrame(grains, 30));
  assert.deepEqual([grains.x, grains.y], [atThirty.x, atThirty.y]);
  const held = reachFrame(grains, 5000);
  assert.equal(held.frame, TOTAL_FRAMES - 1);
  assert.equal(held.grains.steps, (TOTAL_FRAMES - 1) * SUBSTEPS);
});

test("a captured frame is drawn from its index alone", () => {
  // The renderer asks for each frame by number; nothing on that path reads a clock.
  const sketch = readFileSync(new URL("../artworks/those-unheard/sketch.js", import.meta.url), "utf8");
  assert.match(sketch, /window\.__renderFrame = \(frameIndex\) => Promise\.resolve\(publishState\(drawUpTo\(frameIndex\)\)\);/u);
  assert.match(sketch, /function drawUpTo\(frameIndex\) \{\n {4}const reached = reachFrame\(grains, frameIndex\);/u);
});

test("the page follows the clock but never computes more than half a second in one draw", () => {
  assert.equal(CATCH_UP_FRAMES, 15);
  // On time, it shows the frame the clock is at.
  for (let frame = 0; frame < 30; frame += 1) assert.equal(nextPageFrame(frame, (frame + 1) / PLAYBACK_FPS), frame + 1);
  // Behind, after a hidden tab: half a second on, not the whole gap.
  assert.equal(nextPageFrame(100, 24), 115);
  // Never back, never past the last frame, and the last frame holds.
  assert.equal(nextPageFrame(300, 1), 300);
  assert.equal(nextPageFrame(TOTAL_FRAMES - 1, 1000), TOTAL_FRAMES - 1);
  let shown = 0;
  let draws = 0;
  for (let elapsed = 0; shown < TOTAL_FRAMES - 1; elapsed += 1) {
    const next = nextPageFrame(shown, elapsed);
    assert.ok(next - shown <= CATCH_UP_FRAMES && next >= shown);
    shown = next;
    draws += 1;
  }
  assert.equal(draws, Math.ceil((TOTAL_FRAMES - 1) / CATCH_UP_FRAMES) + 1);
});
