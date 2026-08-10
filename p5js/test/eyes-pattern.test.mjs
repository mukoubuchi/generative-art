import assert from "node:assert/strict";
import test from "node:test";
import {
  CIRCLE_DIAMETER,
  CIRCLE_RADIUS,
  GRID_SIZE,
  allCentres,
  latticeCentres,
  visibleCentres
} from "../artworks/eyes-pattern/geometry.js";

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
