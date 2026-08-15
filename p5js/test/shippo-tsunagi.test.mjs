import assert from "node:assert/strict";
import test from "node:test";
import {
  CIRCLE_DIAMETER,
  CIRCLE_RADIUS,
  GRID_SIZE,
  allCentres,
  latticeCentres,
  visibleCentres
,
  DISSOLVE_FRAMES,
  FIRST_LATTICE_FRAMES,
  HOLD_FRAMES,
  REST_FRAMES,
  SECOND_LATTICE_FRAMES,
  TOTAL_FRAMES,
  rippleOrder
} from "../artworks/shippo-tsunagi/geometry.js";

const offsetLattice = latticeCentres(CIRCLE_RADIUS);
const alignedLattice = latticeCentres(0);

test("two lattices of five circles a side make fifty circles", () => {
  const side = GRID_SIZE + 1;

  assert.equal(offsetLattice.length, side * side);
  assert.equal(alignedLattice.length, side * side);
  assert.equal(allCentres().length, 2 * side * side);
});

test("one lattice sits on the integer points and the other on the half points", () => {
  for (const centre of alignedLattice) {
    assert.equal(centre.x % 1, 0);
    assert.equal(centre.y % 1, 0);
  }
  for (const centre of offsetLattice) {
    assert.equal(centre.x % 1, CIRCLE_RADIUS);
    assert.equal(centre.y % 1, CIRCLE_RADIUS);
  }
});

test("neighbouring circles overlap, which is what cuts the lens shapes", () => {
  // Centres one diameter apart along an axis only touch; the lenses come from the two
  // lattices, whose nearest centres are a half diagonal apart.
  const diagonal = Math.hypot(CIRCLE_RADIUS, CIRCLE_RADIUS);

  assert.ok(diagonal < CIRCLE_DIAMETER, "the offset lattice has to overlap the aligned one");
  assert.ok(diagonal > CIRCLE_RADIUS, "but not so far that a centre falls inside a neighbour");
});

test("the lattice runs off every edge rather than stopping short of one", () => {
  for (const lattice of [offsetLattice, alignedLattice]) {
    const xs = lattice.map((centre) => centre.x);

    assert.ok(Math.min(...xs) - CIRCLE_RADIUS <= 0, "left edge is covered");
    assert.ok(Math.max(...xs) + CIRCLE_RADIUS >= GRID_SIZE, "right edge is covered");
  }
});

test("every circle the sketch draws either shows or sits just past the edge", () => {
  const visible = visibleCentres(allCentres());

  assert.ok(visible.length > 0);
  assert.ok(visible.length < allCentres().length, "some circles fall entirely outside");
  for (const centre of visible) {
    assert.ok(centre.x + CIRCLE_RADIUS > 0 && centre.x - CIRCLE_RADIUS < GRID_SIZE);
    assert.ok(centre.y + CIRCLE_RADIUS > 0 && centre.y - CIRCLE_RADIUS < GRID_SIZE);
  }
});

test("one family alone is tangent and eyeless; the eyes exist only between the families", () => {
  const integer = visibleCentres(latticeCentres(0));
  const half = visibleCentres(latticeCentres(CIRCLE_RADIUS));

  // Within a family the closest circles just touch: distance exactly one diameter.
  for (const family of [integer, half]) {
    let closest = Infinity;
    for (let a = 0; a < family.length; a += 1) {
      for (let b = a + 1; b < family.length; b += 1) {
        closest = Math.min(closest, Math.hypot(
          family[a].x - family[b].x,
          family[a].y - family[b].y
        ));
      }
    }
    assert.equal(closest, CIRCLE_DIAMETER);
  }

  // Across the families the nearest pairs overlap, and every such pair is a lens.
  let lenses = 0;
  for (const a of integer) {
    for (const b of half) {
      const gap = Math.hypot(a.x - b.x, a.y - b.y);
      if (gap < CIRCLE_DIAMETER - 1e-9) {
        assert.ok(Math.abs(gap - Math.SQRT1_2) < 1e-9);
        lenses += 1;
      }
    }
  }
  // Sixteen half-point circles, each cutting a lens with its four integer
  // neighbours: sixty-four eyes, none of them drawn.
  assert.equal(lenses, 16 * 4);
});

test("each family ripples out from the centre, whole and exactly once", () => {
  for (const offset of [0, CIRCLE_RADIUS]) {
    const order = rippleOrder(offset);
    const visible = visibleCentres(latticeCentres(offset));
    assert.equal(order.length, visible.length);
    const key = (point) => `${point.x},${point.y}`;
    assert.deepEqual(new Set(order.map(key)), new Set(visible.map(key)));
    for (let index = 1; index < order.length; index += 1) {
      assert.ok(order[index].reach >= order[index - 1].reach - 1e-9);
    }
  }
});

test("the clip's plan lands on three hundred frames and the manifest agrees", async () => {
  assert.equal(
    FIRST_LATTICE_FRAMES + REST_FRAMES + SECOND_LATTICE_FRAMES + HOLD_FRAMES + DISSOLVE_FRAMES,
    TOTAL_FRAMES
  );
  assert.equal(TOTAL_FRAMES, 300);
  const { readFileSync } = await import("node:fs");
  const manifest = JSON.parse(
    readFileSync(new URL("../manifest.json", import.meta.url), "utf8")
  );
  const artwork = manifest.artworks.find((entry) => entry.id === "shippo-tsunagi");
  assert.equal(artwork.render.kind, "video");
  assert.equal(artwork.render.durationSeconds * 30, TOTAL_FRAMES);
});
