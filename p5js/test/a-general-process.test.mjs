import assert from "node:assert/strict";
import test from "node:test";
import { WIDTH, HEIGHT, FRAMES, PARAMETERS, rationalPoint, exactResidual, homogeneous,
  screen, poles, visibleArcs, stateAt, conicType } from "../artworks/a-general-process/family.js";

test("the rational family obeys its conic equation exactly and rejects a displaced coordinate", () => {
  let tested = 0;
  for (let p = -48n; p <= 48n; p++) for (let u = -8n; u <= 8n; u++) for (let v = -8n; v <= 8n; v++) {
    if (!u && !v) continue;
    const point = rationalPoint(u, v, p, 32n);
    assert.equal(exactResidual(point, p, 32n), 0n);
    const changed = [point[0], point[1] + 1n, point[2]];
    assert.notEqual(exactResidual(changed, p, 32n), 0n);
    tested++;
  }
  assert.equal(tested, 27936);
});

test("the shared points and the nondegenerate conic types belong to the whole family", () => {
  for (let p = -48n; p <= 48n; p++) {
    const q = 32n;
    assert.equal(exactResidual([0n, 1n, 1n], p, q), 0n);
    assert.equal(exactResidual([0n, -1n, 1n], p, q), 0n);
    // det [[q²-p²,0,-pq],[0,q²,0],[-pq,0,-q²]] = -q^6.
    const det = q*q*((q*q-p*p)*(-q*q)-p*p*q*q);
    assert.equal(det, -(q ** 6n));
    assert.equal(conicType(Number(p) / 32), p*p < q*q ? "ellipse" : p*p === q*q ? "parabola" : "hyperbola");
  }
});

function crossesPole(a, b, lambda) {
  return poles(lambda).some((theta) => theta > a + 1e-10 && theta < b - 1e-10);
}

test("all rendered cases stay on the conic, inside the viewport, and on their finite branches", () => {
  let vertices = 0, segments = 0, largestResidual = 0, largestMidpointError = 0;
  const cases = [...PARAMETERS, ...Array.from({ length: FRAMES }, (_, i) => stateAt(i).lambda)];
  for (const lambda of cases) {
    const arcs = visibleArcs(lambda);
    assert.ok(arcs.length > 0);
    for (const arc of arcs) {
      assert.ok(arc.length >= 2);
      assert.ok(!crossesPole(arc[0].theta, arc.at(-1).theta, lambda));
      for (let i = 0; i < arc.length; i++) {
        const { h: [x,y,w], xy, theta } = arc[i];
        const residual = Math.abs(x*x+y*y-(w+lambda*x)**2);
        largestResidual = Math.max(largestResidual, residual);
        assert.ok(residual < 1e-12);
        assert.ok(xy.every(Number.isFinite));
        assert.ok(xy[0] >= -1e-6 && xy[0] <= WIDTH+1e-6 && xy[1] >= -1e-6 && xy[1] <= HEIGHT+1e-6);
        vertices++;
        if (i) {
          const before = arc[i-1];
          assert.equal(Math.sign(w), Math.sign(before.h[2]));
          const mid = screen(homogeneous((theta+before.theta)/2,lambda));
          const error = Math.hypot(mid[0]-(xy[0]+before.xy[0])/2,mid[1]-(xy[1]+before.xy[1])/2);
          largestMidpointError = Math.max(largestMidpointError,error);
          assert.ok(error <= 0.120001);
          segments++;
        }
      }
    }
    // Independent angular probes prevent a clipped-away or empty branch from passing.
    for (let n = 0; n < 127; n++) {
      const theta = 2*Math.PI*(n+0.37)/127, xy=screen(homogeneous(theta,lambda));
      const inside=xy[0]>1e-5&&xy[0]<WIDTH-1e-5&&xy[1]>1e-5&&xy[1]<HEIGHT-1e-5;
      const represented=arcs.some(a=>theta>=a[0].theta&&theta<=a.at(-1).theta);
      assert.equal(represented,inside);
    }
  }
  assert.ok(vertices>100000 && segments>100000);
  console.log(JSON.stringify({cases:cases.length,vertices,segments,largestResidual,largestMidpointError}));
});

test("a deliberately joined pair of hyperbola branches is rejected", () => {
  const pole=poles(1.5)[0];
  assert.ok(crossesPole(pole-0.1,pole+0.1,1.5));
  assert.notEqual(Math.sign(homogeneous(pole-0.1,1.5)[2]),Math.sign(homogeneous(pole+0.1,1.5)[2]));
  assert.ok(!crossesPole(0.2,0.5,0.8));
});

test("the selected case passes through a circle, parabola and two visible hyperbola branches", () => {
  assert.equal(stateAt(0).lambda,0);
  assert.equal(stateAt(300).lambda,1);
  assert.equal(stateAt(300).type,"parabola");
  assert.equal(stateAt(480).lambda,1.5);
  const signs=new Set(visibleArcs(1.5).map(a=>Math.sign(a[0].h[2])));
  assert.deepEqual([...signs].sort(),[-1,1]);
  assert.deepEqual(stateAt(FRAMES),stateAt(0));
});
