import assert from "node:assert/strict";
import test from "node:test";
import { buildFabric, cycleRank, traceEdges, plane, warp, unwarp, WIDTH, HEIGHT } from "../artworks/supplied-by-another/fabric.js";
import { loadCatalog } from "../lib/catalog.mjs";

const fabric = buildFabric();
const paths = traceEdges(fabric);

// Independent E - V + C count, using graph traversal rather than union/find.
function topology(edges) {
  const neighbours = fabric.vertices.map(() => []);
  for (const { a, b } of edges) {
    neighbours[a].push(b);
    neighbours[b].push(a);
  }
  const visited = new Set();
  let components = 0;
  for (let start = 0; start < neighbours.length; start += 1) {
    if (visited.has(start)) continue;
    components += 1;
    const queue = [start];
    visited.add(start);
    for (let i = 0; i < queue.length; i += 1) {
      for (const next of neighbours[queue[i]]) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }
  return { components, cycles: edges.length - neighbours.length + components };
}

test("every finite cell requires all three contributions, with one shared central opening", () => {
  assert.equal(fabric.vertices.length, 744);
  assert.equal(fabric.edges.length, 1074);
  assert.equal(fabric.faces.length, 330);
  assert.equal(new Set(fabric.vertices.map(String)).size, 744);
  const incidence = fabric.edges.map(() => 0);
  for (const face of fabric.faces) {
    assert.equal(new Set(face.vertices).size, 6);
    assert.deepEqual([0, 1, 2].map((c) => face.edges.filter((e) => fabric.edges[e].colour === c).length), [2, 2, 2]);
    for (const edge of face.edges) incidence[edge] += 1;
  }
  assert.ok(incidence.every((n) => n === 1 || n === 2));
  for (const { a, b } of fabric.edges) {
    const du = fabric.vertices[b][0] - fabric.vertices[a][0];
    const dv = fabric.vertices[b][1] - fabric.vertices[a][1];
    assert.equal(du * du + 3 * dv * dv, 4);
  }
  assert.deepEqual(topology(fabric.edges), { components: 1, cycles: 331 });
  assert.equal(cycleRank(fabric), 331);
  for (const colour of [0, 1, 2]) {
    const remainder = fabric.edges.filter((e) => e.colour !== colour);
    assert.equal(topology(remainder).cycles, 0);
    assert.equal(cycleRank(fabric, remainder), 0);
  }
  // A complete cell assigned to one contribution breaks the actual claim.
  const falseColours = fabric.edges.map((e, i) => ({ ...e, colour: fabric.faces[0].edges.includes(i) ? 0 : e.colour }));
  assert.ok(topology(falseColours.filter((e) => e.colour !== 1)).cycles > 0);
});

function endpointErrors(candidate) {
  return candidate.filter((edge) => [edge.a, edge.b].some((id, i) => {
    const actual = i === 0 ? edge.points[0] : edge.points.at(-1);
    const expected = warp(plane(fabric.vertices[id]));
    return actual[0] !== expected[0] || actual[1] !== expected[1];
  })).length;
}

test("drawn edges share their actual endpoints and a separated endpoint is rejected", () => {
  assert.equal(endpointErrors(paths), 0);
  const broken = structuredClone(paths);
  broken[0].points[0] = [broken[0].points[0][0] + 3, broken[0].points[0][1]];
  assert.equal(endpointErrors(broken), 1);
});

function crosses(a, b, c, d) {
  const orient = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return orient(a, b, c) * orient(a, b, d) < -1e-12
    && orient(c, d, a) * orient(c, d, b) < -1e-12;
}

test("the complete sampled drawing stays inside the page and has no proper crossings", () => {
  const buckets = new Map();
  let maxInverseError = 0;
  let maxMidpointError = 0;
  let segmentCount = 0;
  for (const edge of paths) {
    const a = plane(fabric.vertices[edge.a]);
    const b = plane(fabric.vertices[edge.b]);
    for (let i = 0; i < edge.points.length; i += 1) {
      const point = edge.points[i];
      assert.ok(point[0] > 40 && point[0] < WIDTH - 40 && point[1] > 40 && point[1] < HEIGHT - 40);
      const back = unwarp(point);
      const t = i / (edge.points.length - 1);
      maxInverseError = Math.max(maxInverseError, Math.hypot(back[0] - a[0] - t * (b[0] - a[0]), back[1] - a[1] - t * (b[1] - a[1])));
      if (i === 0) continue;
      const previous = edge.points[i - 1];
      const middleT = (i - 0.5) / (edge.points.length - 1);
      const actualMiddle = warp([a[0] + middleT * (b[0] - a[0]), a[1] + middleT * (b[1] - a[1])]);
      maxMidpointError = Math.max(maxMidpointError, Math.hypot(actualMiddle[0] - (point[0] + previous[0]) / 2, actualMiddle[1] - (point[1] + previous[1]) / 2));
      const seen = new Set();
      for (let x = Math.floor(Math.min(point[0], previous[0]) / 20); x <= Math.floor(Math.max(point[0], previous[0]) / 20); x += 1) {
        for (let y = Math.floor(Math.min(point[1], previous[1]) / 20); y <= Math.floor(Math.max(point[1], previous[1]) / 20); y += 1) {
          const key = `${x},${y}`;
          const bucket = buckets.get(key) ?? [];
          for (const other of bucket) {
            if (seen.has(other.id)) continue;
            seen.add(other.id);
            assert.equal(crosses(previous, point, other.a, other.b), false);
          }
          bucket.push({ a: previous, b: point, id: segmentCount });
          buckets.set(key, bucket);
        }
      }
      segmentCount += 1;
    }
  }
  assert.equal(segmentCount, 17184);
  assert.ok(maxInverseError < 4e-14, `${maxInverseError}`);
  assert.ok(maxMidpointError < 0.006, `${maxMidpointError}`);
  assert.equal(crosses([0, 0], [2, 2], [0, 2], [2, 0]), true);
});

test("the requested still is a still throughout the catalog and keeps the original year unknown", async () => {
  const { manifest, quoteCatalog } = await loadCatalog();
  const entry = manifest.artworks.find((a) => a.id === "supplied-by-another");
  assert.equal(entry.render.kind, "image");
  assert.equal(entry.render.artifact, "exports/p5js/SuppliedByAnother.png");
  assert.equal(entry.render.scale, 3);
  assert.equal(entry.render.durationSeconds, undefined);
  assert.equal(entry.thumbnail, undefined);
  const quote = quoteCatalog.quotes.find((q) => q.id === entry.quoteIds[0]);
  assert.equal(quote.year, null);
  assert.equal(quote.text, "what was wanting to one in the representation of the divine goodness might be supplied by another.");
});
