import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  WIDTH,
  HEIGHT,
  CX,
  CY,
  FPS,
  DURATION,
  FRAMES,
  CLEARANCE_RADIUS,
  OBSTACLE_STEPS,
  COORD_SCALE,
  OBSTACLES,
  OBSTACLE_SEGMENTS,
  VIEWPORT_SEGMENTS,
  FIELD_RINGS,
  eyeAt,
  eyeVelocityAt,
  exactCross2D,
  exactRayHitRational,
  exactCollinearWithRay,
  intersectRaySegment,
  segmentIntersectsObstacle,
  visibilityAt,
  partitionFieldRings,
  reconstructEyeFromBoundaries,
  stateAt
} from "../artworks/not-in-the-field/field.js";
import { loadCatalog } from "../lib/catalog.mjs";
import { renderIndexPage } from "../lib/gallery.mjs";
import { buildPostBody, validatePostBody } from "../lib/post-text.mjs";

function maxInteriorTurnDegrees(obstacles) {
  let maxDeg = 0;
  for (const obs of obstacles) {
    const pts = obs.points;
    for (let s = 1; s < pts.length - 1; s++) {
      const a1 = Math.atan2(pts[s][1] - pts[s - 1][1], pts[s][0] - pts[s - 1][0]);
      const a2 = Math.atan2(pts[s + 1][1] - pts[s][1], pts[s + 1][0] - pts[s][0]);
      let deg = (Math.abs(a2 - a1) * 180) / Math.PI;
      if (deg > 180) deg = 360 - deg;
      if (deg > maxDeg) maxDeg = deg;
    }
  }
  return maxDeg;
}

test("all obstacle and viewport vertices lie on the exact 1/64-px lattice, arc joints are smooth, and exact rational ray hits obey zero-tolerance BigInt collinearity", () => {
  assert.equal(WIDTH, 900);
  assert.equal(HEIGHT, 680);
  assert.equal(FPS, 30);
  assert.equal(DURATION, 24);
  assert.equal(FRAMES, 720);
  assert.equal(OBSTACLE_STEPS, 24);
  assert.equal(COORD_SCALE, 64);
  assert.equal(OBSTACLES.length, 36);
  assert.deepEqual(
    [0, 1, 2, 3].map((r) => OBSTACLES.filter((o) => o.ring === r).length),
    [6, 8, 10, 12]
  );
  assert.equal(OBSTACLE_SEGMENTS.length, 864);
  assert.equal(FIELD_RINGS.length, 34);

  for (const seg of [...OBSTACLE_SEGMENTS, ...VIEWPORT_SEGMENTS]) {
    assert.ok(
      Number.isInteger(seg.a[0] * COORD_SCALE) && Number.isInteger(seg.a[1] * COORD_SCALE)
    );
    assert.ok(
      Number.isInteger(seg.b[0] * COORD_SCALE) && Number.isInteger(seg.b[1] * COORD_SCALE)
    );
    assert.ok(exactCross2D([0, 0], seg.a, seg.b) !== 0n || seg.isViewport);
  }

  // Smoothness check: 24-step 1/64-px obstacle arcs turn by < 2.35 degrees per interior joint,
  // whereas a coarse 4-step integer-rounded specimen has > 12-degree polygonal kinks.
  const actualMaxTurn = maxInteriorTurnDegrees(OBSTACLES);
  assert.ok(actualMaxTurn < 2.35, `expected max interior turn < 2.35 deg, got ${actualMaxTurn}`);

  const coarseKinkedSpecimen = [
    {
      points: Array.from({ length: 5 }, (_, s) => {
        const u = s / 4;
        const halfSpan = 0.34 * (0.92 + 0.14 * 2);
        const a = 0.18 + (2 * Math.PI * 2) / 6 + 0.06 * Math.sin(3.4) - halfSpan + 2 * halfSpan * u;
        const rMod = 1 + 0.05 * (u - 0.5);
        return [Math.round(CX + 152 * rMod * Math.cos(a)), Math.round(CY + 128 * rMod * Math.sin(a))];
      })
    }
  ];
  assert.ok(maxInteriorTurnDegrees(coarseKinkedSpecimen) > 12.0);

  let exactHitsChecked = 0;
  for (let ex = 410; ex <= 490; ex += 40) {
    for (let ey = 300; ey <= 380; ey += 40) {
      const eyeInt = [ex, ey];
      for (const obs of OBSTACLES) {
        for (const vertexPt of [obs.points[0], obs.points.at(-1)]) {
          for (const seg of OBSTACLE_SEGMENTS) {
            if (seg.obstacleId === obs.id) continue;
            const hit = exactRayHitRational(eyeInt, vertexPt, seg.a, seg.b);
            if (!hit) continue;
            assert.equal(exactCollinearWithRay(eyeInt, vertexPt, hit), 0n);
            const displacedHit = [hit[0] + 1n, hit[1], hit[2]];
            assert.notEqual(
              exactCollinearWithRay(eyeInt, vertexPt, displacedHit),
              0n
            );
            exactHitsChecked++;
          }
        }
      }
    }
  }
  assert.ok(exactHitsChecked > 300, `expected > 300 exact rational hits, got ${exactHitsChecked}`);
});

test("the closed viewpoint trajectory is C1-continuous across the loop seam and rejects a half-period envelope kink", () => {
  assert.deepEqual(eyeAt(0), [CX, CY]);
  assert.deepEqual(eyeAt(FRAMES), [CX, CY]);

  const h = 1e-4;
  function seamVelocities(fn) {
    const p0 = fn(0);
    const pRight = fn(h);
    const pLeft = fn(FRAMES - h);
    return {
      vRight: [(pRight[0] - p0[0]) / h, (pRight[1] - p0[1]) / h],
      vLeft: [(p0[0] - pLeft[0]) / h, (p0[1] - pLeft[1]) / h]
    };
  }

  const actualSeam = seamVelocities(eyeAt);
  const v0 = eyeVelocityAt(0);
  const vEnd = eyeVelocityAt(FRAMES);
  assert.ok(Math.hypot(v0[0], v0[1]) > 0.15);
  assert.ok(Math.hypot(v0[0] - vEnd[0], v0[1] - vEnd[1]) < 1e-14);
  assert.ok(
    Math.hypot(
      actualSeam.vRight[0] - actualSeam.vLeft[0],
      actualSeam.vRight[1] - actualSeam.vLeft[1]
    ) < 1e-7
  );
  assert.ok(Math.hypot(actualSeam.vRight[0] - v0[0], actualSeam.vRight[1] - v0[1]) < 1e-7);

  // Across all 720 frames, central finite difference matches eyeVelocityAt(f) and velocity never jumps.
  for (let f = 0; f < FRAMES; f++) {
    const pPlus = eyeAt(f + h);
    const pMinus = eyeAt(f - h);
    const fd = [(pPlus[0] - pMinus[0]) / (2 * h), (pPlus[1] - pMinus[1]) / (2 * h)];
    const analytic = eyeVelocityAt(f);
    assert.ok(Math.hypot(fd[0] - analytic[0], fd[1] - analytic[1]) < 1e-9);
    const nextAnalytic = eyeVelocityAt(f + 1);
    assert.ok(Math.hypot(nextAnalytic[0] - analytic[0], nextAnalytic[1] - analytic[1]) < 0.03);
  }

  // Contrary control: the defective sin(pi * tau) envelope reverses y-velocity at the seam.
  function kinkedHalfPeriodSpecimen(frame) {
    const wrapped = ((frame % FRAMES) + FRAMES) % FRAMES;
    const tau = wrapped / FRAMES;
    const env = Math.sin(Math.PI * tau);
    return [
      CX + env * (82 * Math.sin(2 * Math.PI * tau) - 14 * Math.sin(6 * Math.PI * tau)),
      CY + env * (62 * Math.sin(4 * Math.PI * tau - 0.55) + 10 * Math.cos(2 * Math.PI * tau))
    ];
  }
  const kinkSeam = seamVelocities(kinkedHalfPeriodSpecimen);
  assert.ok(kinkSeam.vLeft[1] * kinkSeam.vRight[1] < 0);
  assert.ok(Math.abs(kinkSeam.vRight[1] - kinkSeam.vLeft[1]) > 0.19);
});

test("across all 720 frames every occlusion boundary is clipped at its first obstacle hit and leaves the central clearance unmarked", () => {
  assert.deepEqual(eyeAt(0), [CX, CY]);
  assert.deepEqual(eyeAt(FRAMES), [CX, CY]);

  let totalBoundaries = 0;
  let minNearDist = Infinity;
  let minRingPointDist = Infinity;
  let maxCollinearityError = 0;

  for (let f = 0; f < FRAMES; f++) {
    const eye = eyeAt(f);
    const nextEye = eyeAt(f + 1);
    assert.ok(Math.hypot(nextEye[0] - eye[0], nextEye[1] - eye[1]) < 1.15);

    const vis = visibilityAt(eye);
    assert.ok(
      vis.occlusionBoundaries.length >= 14 && vis.occlusionBoundaries.length <= 21,
      `frame ${f}: unexpected boundary count ${vis.occlusionBoundaries.length}`
    );

    for (const b of vis.occlusionBoundaries) {
      totalBoundaries++;
      minNearDist = Math.min(minNearDist, b.nearDist);
      assert.ok(b.nearDist > CLEARANCE_RADIUS + 20);
      assert.ok(b.farDist > b.nearDist + 1.5);

      // Collinearity of (eye, nearPoint, farPoint).
      const cross = Math.abs(
        (b.nearPoint[0] - eye[0]) * (b.farPoint[1] - eye[1]) -
          (b.nearPoint[1] - eye[1]) * (b.farPoint[0] - eye[0])
      );
      const colErr = cross / b.farDist;
      maxCollinearityError = Math.max(maxCollinearityError, colErr);
      assert.ok(colErr < 1e-9, `frame ${f}: collinearity error ${colErr}`);

      // No obstacle segment may cross the open boundary segment (nearPoint, farPoint).
      const penetrated = segmentIntersectsObstacle(
        b.nearPoint,
        b.farPoint,
        new Set([b.nearSegmentId, b.farSegmentId])
      );
      assert.equal(penetrated, false, `frame ${f}: boundary penetrated an obstacle`);
    }

    const { litArcs, shadowArcs } = partitionFieldRings(vis);
    for (const arc of [...litArcs, ...shadowArcs]) {
      for (const pt of arc.points) {
        const d = Math.hypot(pt[0] - eye[0], pt[1] - eye[1]);
        minRingPointDist = Math.min(minRingPointDist, d);
      }
    }
  }

  assert.ok(totalBoundaries > 11000);
  assert.ok(minNearDist > 59.73);
  assert.ok(minRingPointDist > 46.32);
  assert.ok(maxCollinearityError < 1e-10);

  // Contrary control: extending an obstacle-stopped boundary past its blocking segment penetrates that obstacle.
  const vis0 = visibilityAt(eyeAt(0));
  const stoppedByObstacle = vis0.occlusionBoundaries.find((b) => !b.farIsViewport);
  assert.ok(stoppedByObstacle);
  const dx = stoppedByObstacle.farPoint[0] - stoppedByObstacle.nearPoint[0];
  const dy = stoppedByObstacle.farPoint[1] - stoppedByObstacle.nearPoint[1];
  const len = Math.hypot(dx, dy);
  const unclippedFar = [
    stoppedByObstacle.farPoint[0] + (dx / len) * 25,
    stoppedByObstacle.farPoint[1] + (dy / len) * 25
  ];
  assert.equal(
    segmentIntersectsObstacle(
      stoppedByObstacle.nearPoint,
      unclippedFar,
      new Set([stoppedByObstacle.nearSegmentId])
    ),
    true
  );
});

test("across all 720 frames the unmarked viewpoint is uniquely conditioned and reconstructed from drawn occlusion boundaries alone", () => {
  let minEigenvalue = Infinity;
  let maxReconstructionError = 0;
  let maxLineResidual = 0;

  for (let f = 0; f < FRAMES; f++) {
    const vis = visibilityAt(eyeAt(f));
    const state = stateAt(f, vis);
    const rec = reconstructEyeFromBoundaries(vis.occlusionBoundaries);
    assert.equal(rec.ok, true);
    minEigenvalue = Math.min(minEigenvalue, rec.minEigenvalue);
    maxReconstructionError = Math.max(maxReconstructionError, state.reconstructionError);
    maxLineResidual = Math.max(maxLineResidual, rec.maxLineResidual);

    // Verify pairwise angular spread among active boundary normals: max |n_i x n_j| > 0.99.
    let maxSinSpread = 0;
    const normals = vis.occlusionBoundaries.map((b) => {
      const dx = b.farPoint[0] - b.nearPoint[0];
      const dy = b.farPoint[1] - b.nearPoint[1];
      const l = Math.hypot(dx, dy);
      return [-dy / l, dx / l];
    });
    for (let i = 0; i < normals.length; i++) {
      for (let j = i + 1; j < normals.length; j++) {
        const sinSpread = Math.abs(
          normals[i][0] * normals[j][1] - normals[i][1] * normals[j][0]
        );
        if (sinSpread > maxSinSpread) maxSinSpread = sinSpread;
      }
    }
    assert.ok(maxSinSpread > 0.99, `frame ${f}: insufficient angular spread ${maxSinSpread}`);
  }

  assert.ok(minEigenvalue > 6.468, `expected minEigenvalue > 6.468, got ${minEigenvalue}`);
  assert.ok(
    maxReconstructionError < 3.6e-13,
    `expected maxReconstructionError < 3.6e-13, got ${maxReconstructionError}`
  );
  assert.ok(maxLineResidual < 1e-11);

  // Contrary control 1: parallel boundary segments cannot localize a viewpoint.
  const parallelSpecimens = [
    { nearPoint: [100, 100], farPoint: [200, 100] },
    { nearPoint: [100, 180], farPoint: [220, 180] },
    { nearPoint: [120, 260], farPoint: [260, 260] }
  ];
  const degenerate = reconstructEyeFromBoundaries(parallelSpecimens);
  assert.equal(degenerate.ok, false);
  assert.ok(degenerate.minEigenvalue <= 1e-12);

  // Contrary control 2: perturbing one boundary segment's far point breaks line convergence.
  const cleanBoundaries = structuredClone(visibilityAt(eyeAt(180)).occlusionBoundaries);
  cleanBoundaries[0].farPoint[1] += 6;
  const perturbed = reconstructEyeFromBoundaries(cleanBoundaries);
  assert.ok(perturbed.maxLineResidual > 0.5);
});

test("across all 720 frames lit and occluded obstacle sub-segments conserve total length and reject displaced viewpoints", () => {
  const segById = new Map(OBSTACLE_SEGMENTS.map((s) => [s.id, s]));

  for (let f = 0; f < FRAMES; f++) {
    const eye = eyeAt(f);
    const vis = visibilityAt(eye);
    const lengthBySeg = new Map();

    for (const part of vis.litSegments) {
      const len = Math.hypot(part.b[0] - part.a[0], part.b[1] - part.a[1]);
      lengthBySeg.set(part.segmentId, (lengthBySeg.get(part.segmentId) ?? 0) + len);
      if (len > 0.05) {
        const mid = [0.5 * (part.a[0] + part.b[0]), 0.5 * (part.a[1] + part.b[1])];
        assert.equal(
          segmentIntersectsObstacle(eye, mid, new Set([part.segmentId])),
          false,
          `frame ${f}: lit midpoint blocked`
        );
      }
    }

    for (const part of vis.occludedSegments) {
      const len = Math.hypot(part.b[0] - part.a[0], part.b[1] - part.a[1]);
      lengthBySeg.set(part.segmentId, (lengthBySeg.get(part.segmentId) ?? 0) + len);
      if (len > 0.1) {
        const mid = [0.5 * (part.a[0] + part.b[0]), 0.5 * (part.a[1] + part.b[1])];
        assert.equal(
          segmentIntersectsObstacle(eye, mid, new Set([part.segmentId])),
          true,
          `frame ${f}: occluded midpoint not blocked by any obstacle`
        );
      }
    }

    for (const seg of OBSTACLE_SEGMENTS) {
      const fullLen = Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]);
      const sumLen = lengthBySeg.get(seg.id) ?? 0;
      assert.ok(Math.abs(fullLen - sumLen) < 1e-9);
    }

    // Specific displaced control points outside the central chamber fail visibility of the frame's lit segments.
    const displacedControls = [
      [eye[0] + 190, eye[1]],
      [eye[0] - 190, eye[1]],
      [eye[0], eye[1] + 165],
      [eye[0], eye[1] - 165]
    ];
    for (const cand of displacedControls) {
      let blockedCount = 0;
      for (const part of vis.litSegments) {
        const mid = [0.5 * (part.a[0] + part.b[0]), 0.5 * (part.a[1] + part.b[1])];
        if (segmentIntersectsObstacle(cand, mid, new Set([part.segmentId]))) {
          blockedCount++;
          if (blockedCount >= 50) break;
        }
      }
      assert.ok(blockedCount >= 50, `frame ${f}: displaced point unexpectedly saw all lit segments`);
    }
  }
  assert.equal(segById.size, 864);
});

test("catalog, post format, gallery card, and README record Wittgenstein 5.633 accurately", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const artwork = manifest.artworks.find((a) => a.id === "not-in-the-field");
  assert.ok(artwork);
  assert.equal(artwork.title, "Not in the Field");
  assert.deepEqual(artwork.canvas, { width: 900, height: 680 });
  assert.deepEqual(artwork.thumbnail, { frame: 180 });
  assert.deepEqual(artwork.render, {
    kind: "video",
    artifact: "exports/p5js/NotInTheField.mp4",
    durationSeconds: 24,
    scale: 2
  });

  const quote = quoteCatalog.quotes.find((q) => q.id === "wittgenstein-not-in-the-field");
  assert.ok(quote);
  assert.equal(
    quote.text,
    "But you do not really see the eye. And from nothing in the field of sight can it be concluded that it is seen from an eye."
  );
  assert.equal(quote.author, "Ludwig Wittgenstein");
  assert.equal(quote.source, "Tractatus Logico-Philosophicus, 5.633");
  assert.equal(quote.year, 1921);
  assert.equal(quote.publicDomain, true);
  assert.equal(quote.sourceUrl, "https://www.gutenberg.org/files/5740/5740-pdf.pdf");
  assert.equal(
    quote.original.text,
    "Aber das Auge siehst du wirklich nicht. Und nichts am Gesichtsfeld lässt darauf schliessen, dass es von einem Auge gesehen wird."
  );
  assert.equal(quote.original.lang, "de");
  assert.equal(quote.original.source, "Logisch-philosophische Abhandlung, 5.633");

  const body = buildPostBody(artwork, quote, manifest.defaults.interactiveBaseUrl);
  assert.ok(
    validatePostBody(body, manifest.defaults.maxWeightedCharacters) <=
      manifest.defaults.maxWeightedCharacters
  );
  assert.equal(
    body,
    [
      quote.text,
      "— Ludwig Wittgenstein, Tractatus Logico-Philosophicus, 5.633",
      "",
      "#generativeart",
      "",
      "https://mukoubuchi.github.io/generative-art/p5js/artworks/not-in-the-field/"
    ].join("\n")
  );

  const indexHtml = renderIndexPage(manifest, quoteCatalog);
  const cardStart = indexHtml.indexOf('<h2 class="card__title">Not in the Field</h2>');
  assert.ok(cardStart >= 0);
  const card = indexHtml.slice(cardStart, indexHtml.indexOf("</li>", cardStart));
  assert.ok(card.includes(quote.text));
  assert.equal(
    card.match(/<cite class="card__cite">(.*?)<\/cite>/u)?.[1],
    "—&nbsp;<b>Ludwig Wittgenstein</b>, Tractatus Logico-Philosophicus, 5.633"
  );
  assert.ok(!card.includes("Ogden"));
  assert.ok(!card.includes("1921"));
  assert.ok(!card.includes("1922"));

  const readme = await fs.readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(readme.includes("## Not in the Field"));
  assert.ok(readme.includes("artistic extension"));
  assert.ok(readme.includes("C. K. Ogden"));
  assert.ok(readme.includes("1922"));
  assert.ok(readme.includes("Project Gutenberg #5740 PDF"));
  assert.ok(readme.includes("PDF page 77 (numbered p. 75)"));
  assert.ok(readme.includes("PDF page 147 (numbered p. 145)"));
  assert.ok(readme.includes("United States"));
});

test("pathFromSegments preserves the leading segment and wrap-around angular pruning is conservative", async () => {
  const sketchSource = await fs.readFile(
    new URL("../artworks/not-in-the-field/sketch.js", import.meta.url),
    "utf8"
  );
  const fnMatch = sketchSource.match(/function pathFromSegments\([\s\S]*?\n\}/u);
  assert.ok(fnMatch, "pathFromSegments function must exist in sketch.js");

  class RecordingPath2D {
    constructor() {
      this.ops = [];
    }
    moveTo(x, y) {
      this.ops.push(["moveTo", x, y]);
    }
    lineTo(x, y) {
      this.ops.push(["lineTo", x, y]);
    }
  }

  const runPathFromSegments = new Function(
    "Path2D",
    `${fnMatch[0]}; return pathFromSegments;`
  )(RecordingPath2D);

  // Synthetic check: initial segment a->b, contiguous follow-up segment, and disjoint jump.
  const synthetic = [
    { a: [10, 20], b: [30, 40] },
    { a: [30, 40], b: [50, 60] },
    { a: [70, 80], b: [90, 100] }
  ];
  assert.deepEqual(runPathFromSegments(synthetic).ops, [
    ["moveTo", 10, 20],
    ["lineTo", 30, 40],
    ["lineTo", 50, 60],
    ["moveTo", 70, 80],
    ["lineTo", 90, 100]
  ]);

  // Negative control: NaN initial lastX/lastY without !Number.isFinite(lastX) drops the first moveTo(a).
  function buggyNaNPathFromSegments(segments, aKey = "a", bKey = "b") {
    const path = new RecordingPath2D();
    let lastX = NaN;
    let lastY = NaN;
    for (const seg of segments) {
      const [ax, ay] = seg[aKey];
      const [bx, by] = seg[bKey];
      if (Math.hypot(ax - lastX, ay - lastY) > 1e-5) {
        path.moveTo(ax, ay);
      }
      path.lineTo(bx, by);
      lastX = bx;
      lastY = by;
    }
    return path;
  }
  assert.deepEqual(buggyNaNPathFromSegments(synthetic.slice(0, 2)).ops, [
    ["lineTo", 30, 40],
    ["lineTo", 50, 60]
  ]);

  // Helper to reconstruct drawn line segments from Path2D operations.
  function drawnSegmentsFromOps(ops) {
    const drawn = [];
    let hasCursor = false;
    let cx = 0;
    let cy = 0;
    for (const [op, x, y] of ops) {
      if (op === "moveTo") {
        cx = x;
        cy = y;
        hasCursor = true;
      } else if (op === "lineTo") {
        if (!hasCursor) {
          cx = x;
          cy = y;
          hasCursor = true;
        } else {
          drawn.push({ a: [cx, cy], b: [x, y] });
          cx = x;
          cy = y;
        }
      }
    }
    return drawn;
  }

  // Verify across all 720 frames that occludedSegments, litSegments, and
  // occlusionBoundaries lose 0 segments when converted by pathFromSegments.
  const allSegments = [...OBSTACLE_SEGMENTS, ...VIEWPORT_SEGMENTS];
  const pad = 1e-6;
  let prunedHitsConservative = 0;
  let prunedHitsBuggyWrap = 0;

  for (let f = 0; f < FRAMES; f++) {
    const eye = eyeAt(f);
    const vis = visibilityAt(eye);
    for (const [segments, aKey, bKey] of [
      [vis.occludedSegments, "a", "b"],
      [vis.litSegments, "a", "b"],
      [vis.occlusionBoundaries, "nearPoint", "farPoint"]
    ]) {
      const ops = runPathFromSegments(segments, aKey, bKey).ops;
      assert.equal(ops[0]?.[0], "moveTo", `frame ${f}: path must begin with moveTo`);
      const drawn = drawnSegmentsFromOps(ops);
      assert.equal(drawn.length, segments.length, `frame ${f}: drawn segment count mismatch`);
      for (let i = 0; i < segments.length; i++) {
        assert.ok(
          Math.hypot(drawn[i].a[0] - segments[i][aKey][0], drawn[i].a[1] - segments[i][aKey][1]) <=
            1e-5
        );
        assert.equal(drawn[i].b[0], segments[i][bKey][0]);
        assert.equal(drawn[i].b[1], segments[i][bKey][1]);
      }
    }

    // Check wrapping segments across all critical-sector midpoints on frame f.
    for (const seg of allSegments) {
      const a0 = Math.atan2(seg.a[1] - eye[1], seg.a[0] - eye[0]);
      const a1 = Math.atan2(seg.b[1] - eye[1], seg.b[0] - eye[0]);
      const lo = Math.min(a0, a1);
      const hi = Math.max(a0, a1);
      if (hi - lo <= Math.PI) continue;
      for (const sec of vis.sectors) {
        const mid = 0.5 * (sec.a0 + sec.a1);
        const hit = intersectRaySegment(eye, Math.cos(mid), Math.sin(mid), seg);
        if (!hit) continue;
        if (mid > lo + pad && mid < hi - pad) prunedHitsConservative++;
        if (mid > lo - pad && mid < hi + pad) prunedHitsBuggyWrap++;
      }
    }
  }

  assert.equal(prunedHitsConservative, 0);
  assert.equal(prunedHitsBuggyWrap, 1);

  // Direct execution of field.js's visibilityAt(eye) at both ±π wrap-around endpoints (lo and hi)
  // where OBSTACLE_SEGMENTS[0] (id 0) is the true closest segment and the sector midpoint lies
  // within 4e-7 rad (< pad = 1e-6) of the wrapping segment's lo or hi endpoint.
  const eyeLo = [621.8895929825067, 323.69592591475254];
  const midLo = -3.132505860978614;
  const visLo = visibilityAt(eyeLo);
  const secLo = visLo.sectors.find((s) => Math.abs(0.5 * (s.a0 + s.a1) - midLo) < 1e-7);
  assert.ok(secLo, "sector near lo endpoint of wrapping segment must exist");
  assert.equal(
    secLo.segment.id,
    0,
    "visibilityAt(eyeLo) must hit wrapping segment 0 near its lo endpoint"
  );

  const eyeHi = [622.4783335827017, 323.56708245040676];
  const midHi = 3.0170798469116247;
  const visHi = visibilityAt(eyeHi);
  const secHi = visHi.sectors.find((s) => Math.abs(0.5 * (s.a0 + s.a1) - midHi) < 1e-7);
  assert.ok(secHi, "sector near hi endpoint of wrapping segment must exist");
  assert.equal(
    secHi.segment.id,
    0,
    "visibilityAt(eyeHi) must hit wrapping segment 0 near its hi endpoint"
  );

  // Negative control: mutating field.js in-memory back to lo: lo - pad, hi: hi + pad falsely prunes
  // wrapping segment 0 at both eyeLo and eyeHi.
  const fieldSource = await fs.readFile(
    new URL("../artworks/not-in-the-field/field.js", import.meta.url),
    "utf8"
  );
  const mutatedFieldSource = fieldSource.replace(
    /lo:\s*wraps\s*\?\s*lo\s*\+\s*pad\s*:\s*lo\s*-\s*pad,\s*hi:\s*wraps\s*\?\s*hi\s*-\s*pad\s*:\s*hi\s*\+\s*pad/u,
    "lo: lo - pad, hi: hi + pad"
  );
  assert.notEqual(mutatedFieldSource, fieldSource, "field.js must contain the conservative wrap padding");
  const mutatedFieldMod = await import(
    `data:text/javascript;base64,${Buffer.from(mutatedFieldSource, "utf8").toString("base64")}`
  );
  const bugSecLo = mutatedFieldMod
    .visibilityAt(eyeLo)
    .sectors.find((s) => Math.abs(0.5 * (s.a0 + s.a1) - midLo) < 1e-7);
  const bugSecHi = mutatedFieldMod
    .visibilityAt(eyeHi)
    .sectors.find((s) => Math.abs(0.5 * (s.a0 + s.a1) - midHi) < 1e-7);
  assert.notEqual(bugSecLo?.segment.id, 0);
  assert.notEqual(bugSecHi?.segment.id, 0);
});

