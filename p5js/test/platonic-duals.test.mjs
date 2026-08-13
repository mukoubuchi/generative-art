import assert from "node:assert/strict";
import test from "node:test";
import {
  GOLDEN_RATIO,
  centroidOf,
  circumradiusOf,
  dualOf,
  edgesOf,
  icosahedron,
  inradiusOf
} from "../artworks/platonic-duals/geometry.js";
import {
  PLAN,
  STAGE_TURN,
  TOTAL_FRAMES,
  alignedIcosahedron,
  dualShrink,
  nestedSolids,
  sceneState
} from "../artworks/platonic-duals/staging.js";

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function norm(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

test("the dual swaps vertices for faces and keeps the thirty edges", () => {
  const ico = icosahedron();
  const dod = dualOf(ico);

  assert.equal(ico.vertices.length, 12);
  assert.equal(edgesOf(ico).length, 30);
  assert.equal(ico.faces.length, 20);
  assert.equal(dod.vertices.length, 20);
  assert.equal(edgesOf(dod).length, 30);
  assert.equal(dod.faces.length, 12);
  for (const solid of [ico, dod]) {
    assert.equal(
      solid.vertices.length - edgesOf(solid).length + solid.faces.length,
      2
    );
  }
});

test("both solids are regular: one sphere of vertices, one length of edge, flat faces", () => {
  const ico = icosahedron();
  const dod = dualOf(ico);
  for (const solid of [ico, dod]) {
    const radii = solid.vertices.map(norm);
    for (const radius of radii) {
      assert.ok(Math.abs(radius - radii[0]) < 1e-9);
    }
    const lengths = edgesOf(solid).map(
      ([a, b]) => norm(subtract(solid.vertices[a], solid.vertices[b]))
    );
    for (const edge of lengths) {
      assert.ok(Math.abs(edge - lengths[0]) < 1e-9);
    }
    for (const face of solid.faces) {
      const points = face.map((index) => solid.vertices[index]);
      const centre = centroidOf(points);
      const normal = (() => {
        const first = subtract(points[1], points[0]);
        const second = subtract(points[2], points[0]);
        const raw = [
          first[1] * second[2] - first[2] * second[1],
          first[2] * second[0] - first[0] * second[2],
          first[0] * second[1] - first[1] * second[0]
        ];
        return raw.map((part) => part / norm(raw));
      })();
      for (const point of points) {
        assert.ok(Math.abs(dot(subtract(point, centre), normal)) < 1e-9);
      }
    }
  }
});

test("the theorem: icosahedron and dodecahedron share one inradius-to-circumradius ratio", () => {
  const ico = icosahedron();
  const dod = dualOf(ico);
  const icoRatio = inradiusOf(ico) / circumradiusOf(ico);
  const dodRatio = inradiusOf(dod) / circumradiusOf(dod);

  assert.ok(Math.abs(icoRatio - dodRatio) < 1e-12);
  // The same number in closed form, so the measurement answers to the golden ratio:
  // r/R = phi^2 / (sqrt(3) * sqrt(phi * sqrt(5))).
  const phi = GOLDEN_RATIO;
  const closedForm = phi ** 2 / (Math.sqrt(3) * Math.sqrt(phi * Math.sqrt(5)));
  assert.ok(Math.abs(icoRatio - closedForm) < 1e-12);
});

test("dualizing twice returns the icosahedron: same directions, shrunk by the ratio squared", () => {
  const ico = icosahedron();
  const again = dualOf(dualOf(ico));
  const ratio = inradiusOf(ico) / circumradiusOf(ico);

  assert.ok(Math.abs(circumradiusOf(again) - ratio ** 2) < 1e-12);
  const matched = new Set();
  for (const vertex of again.vertices) {
    let best = -1;
    let bestIndex = -1;
    ico.vertices.forEach((original, index) => {
      const alignment = dot(vertex, original) / (norm(vertex) * norm(original));
      if (alignment > best) {
        best = alignment;
        bestIndex = index;
      }
    });
    assert.ok(best > 1 - 1e-12);
    matched.add(bestIndex);
  }
  assert.equal(matched.size, 12);
});

test("every edge crosses its dual edge at a right angle", () => {
  const ico = icosahedron();
  const dod = dualOf(ico);
  for (const [a, b] of edgesOf(ico)) {
    const sharedFaces = [];
    ico.faces.forEach((face, index) => {
      if (face.includes(a) && face.includes(b)) {
        sharedFaces.push(index);
      }
    });
    assert.equal(sharedFaces.length, 2);
    const edgeDirection = subtract(ico.vertices[b], ico.vertices[a]);
    const dualDirection = subtract(
      dod.vertices[sharedFaces[1]],
      dod.vertices[sharedFaces[0]]
    );
    assert.ok(
      Math.abs(dot(edgeDirection, dualDirection))
        < 1e-9 * norm(edgeDirection) * norm(dualDirection)
    );
  }
});

test("the aligned icosahedron stands on a vertical five-fold axis, and so does its dual", () => {
  const { outer, middle } = nestedSolids();
  assert.ok(outer.vertices.some(
    (vertex) => norm(subtract(vertex, [0, 1, 0])) < 1e-9
  ));

  const fifth = STAGE_TURN;
  for (const solid of [outer, middle]) {
    for (const vertex of solid.vertices) {
      const turned = [
        vertex[0] * Math.cos(fifth) + vertex[2] * Math.sin(fifth),
        vertex[1],
        -vertex[0] * Math.sin(fifth) + vertex[2] * Math.cos(fifth)
      ];
      const nearest = Math.min(
        ...solid.vertices.map((other) => norm(subtract(turned, other)))
      );
      assert.ok(nearest < 1e-9);
    }
  }
});

test("the three solids nest at one, the ratio, and the ratio squared — as the dual hands them over", () => {
  const { outer, middle, inner } = nestedSolids();
  const ratio = dualShrink();

  assert.ok(Math.abs(circumradiusOf(outer) - 1) < 1e-12);
  assert.ok(Math.abs(circumradiusOf(middle) - ratio) < 1e-12);
  assert.ok(Math.abs(circumradiusOf(inner) - ratio ** 2) < 1e-12);
  assert.ok(Math.abs(ratio - 0.7946544723) < 1e-9);
});

test("the clip closes onto its opening frame: same figure, same bearing, one cycle deeper", () => {
  const first = sceneState(0);
  const last = sceneState(TOTAL_FRAMES);

  assert.equal(first.zoom, 1);
  // The camera has closed in by exactly the shrink of two dualizations, so the inner
  // icosahedron arrives at the size the outer one started at.
  assert.ok(Math.abs(last.zoom * dualShrink() ** 2 - 1) < 1e-12);
  assert.ok(Math.abs(last.spin - STAGE_TURN) < 1e-12);
  // The frame the clip ends on shows what the frame it opens on showed.
  assert.equal(first.outer.faceAlpha, 1);
  assert.equal(first.outer.edgeAlpha, 1);
  assert.equal(last.inner.faceAlpha, 1);
  assert.equal(last.inner.edgeAlpha, 1);
  for (const gone of [first.middle, first.inner, last.middle, last.outer]) {
    assert.ok(Math.abs(gone.faceAlpha) < 1e-12);
    assert.ok(Math.abs(gone.edgeAlpha) < 1e-12);
  }
  assert.equal(first.sparks.onOuter + first.sparks.onMiddle, 0);
  assert.equal(last.sparks.onOuter + last.sparks.onMiddle, 0);
});

test("every alpha stays within its range through the whole clip, and each act actually happens", () => {
  let sparksPeak = 0;
  let middlePeak = 0;
  for (let frame = 0; frame <= TOTAL_FRAMES; frame += 1) {
    const state = sceneState(frame);
    for (const band of [state.outer, state.middle, state.inner]) {
      assert.ok(band.faceAlpha >= -1e-12 && band.faceAlpha <= 1 + 1e-12);
      assert.ok(band.edgeAlpha >= -1e-12 && band.edgeAlpha <= 1 + 1e-12);
    }
    assert.ok(state.sparks.onOuter >= -1e-12 && state.sparks.onOuter <= 1 + 1e-12);
    assert.ok(state.sparks.onMiddle >= -1e-12 && state.sparks.onMiddle <= 1 + 1e-12);
    sparksPeak = Math.max(sparksPeak, state.sparks.onOuter, state.sparks.onMiddle);
    middlePeak = Math.max(middlePeak, state.middle.faceAlpha);
  }
  assert.equal(sparksPeak, 1);
  assert.equal(middlePeak, 1);

  // The sparks stand fully lit before the wireframe they announce begins to draw.
  assert.equal(sceneState(PLAN.middleEdgesIn[0]).sparks.onOuter, 1);
  // Each outgoing solid holds its ghost level a while before it goes for good.
  const outerGhost = sceneState(145).outer.edgeAlpha;
  assert.ok(outerGhost > 0.2 && outerGhost < 0.4);
  const middleGhost = sceneState(268).middle.edgeAlpha;
  assert.ok(middleGhost > 0.2 && middleGhost < 0.4);
});
