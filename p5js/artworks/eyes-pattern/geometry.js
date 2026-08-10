// The Processing sketch worked in pixels: circles of diameter 100 on a 400 px canvas.
// Every length here is in grid units of one diameter, so the same lattice fits any canvas
// at four circles across.
export const GRID_SIZE = 4;
export const CIRCLE_DIAMETER = 1;
export const CIRCLE_RADIUS = CIRCLE_DIAMETER / 2;

/**
 * Circle centres for one lattice. The offset shifts the whole lattice; the original drew
 * one lattice on the half-integer points and a second on the integer points, so each pair
 * of neighbouring circles overlaps in a lens and the lenses read as eyes.
 *
 * The bound keeps going one place past the canvas so the pattern runs off every edge
 * instead of stopping short of one. The original wrote a slightly different bound for each
 * of its two lattices — one canvas plus a diameter, the other plus a radius — but both
 * come to five circles a side, so the port states the bound once.
 */
export function latticeCentres(offset) {
  const centres = [];
  for (let column = 0; offset + column < GRID_SIZE + CIRCLE_DIAMETER; column += 1) {
    for (let row = 0; offset + row < GRID_SIZE + CIRCLE_DIAMETER; row += 1) {
      centres.push({ x: offset + column, y: offset + row });
    }
  }
  return centres;
}

/** Both lattices, in the order the original drew them. */
export function allCentres() {
  return [...latticeCentres(CIRCLE_RADIUS), ...latticeCentres(0)];
}

/** Centres with any part of their circle inside the canvas. */
export function visibleCentres(centres) {
  return centres.filter((centre) => (
    centre.x + CIRCLE_RADIUS > 0
    && centre.x - CIRCLE_RADIUS < GRID_SIZE
    && centre.y + CIRCLE_RADIUS > 0
    && centre.y - CIRCLE_RADIUS < GRID_SIZE
  ));
}
