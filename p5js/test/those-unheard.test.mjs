import assert from "node:assert/strict";
import test from "node:test";
import {
  DT, FRICTION_SECONDS, LIFT_THRESHOLD, MODES, MODE_SUM, ONSET,
  PLATE_SIZE, RELEASE, SHAPES, STROKE_SECONDS, SUBSTEPS, TOTAL_FRAMES,
  advanceGrains, agitation, createFields, createGrains, excitationAt,
  fieldAt, gradientAt, nearNodeFraction, sampleField
} from "../artworks/those-unheard/field.js";

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
  // Same-looking indices are insufficient: this neighboring mode has a different eigenvalue.
  assert.notEqual(4 * 4 + 11 * 11, MODE_SUM);
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
});

test("the Neumann edges and the extra point constraint belong to the actual shapes", () => {
  for (const shape of SHAPES) {
    for (let k = 0; k <= 40; k += 1) {
      for (const edge of [0, 1]) {
        assert.equal(gradientAt(shape.coefficients, edge, k / 40)[0], 0);
        assert.equal(gradientAt(shape.coefficients, k / 40, edge)[1], 0);
      }
    }
    if (shape.hold) assert.ok(Math.abs(fieldAt(shape.coefficients, ...shape.hold)) < 1e-14);
  }
  // The eigenvalue alone does not force the drawings to be the same.
  const readings = SHAPES.map(({ coefficients }) => fieldAt(coefficients, 0.17, 0.29));
  for (let i = 0; i < readings.length; i += 1) {
    for (let j = i + 1; j < readings.length; j += 1) assert.ok(Math.abs(readings[i] - readings[j]) > 0.01);
  }
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
