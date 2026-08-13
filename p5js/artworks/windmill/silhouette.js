/**
 * The mill's form, as geometry the tests can hold: four lattice sails — the arms that
 * let Don Quixote's mistake happen — and the tower they turn on. Everything is data;
 * the sketch only strokes and fills what this module returns.
 */

export const SAIL_COUNT = 4;
/** Crossbars on each sail's lattice frame. */
export const RUNG_COUNT = 7;

const QUARTER_TURN = Math.PI / 2;
/** The sail frame's proportions, as fractions of the sail length. */
const SPAR_START = 0.14;
const FRAME_START = 0.3;
const FRAME_END = 0.97;
const FRAME_NEAR = 0.055;
const FRAME_FAR = 0.21;

/**
 * One sail in local coordinates, lying along positive x: the main spar, then the
 * lattice frame offset to one side of it — two stringers and the rungs between —
 * the way a mill's sail hangs its cloth frame beside the spar. Each segment carries
 * its role, because the spar is drawn heavier than the lattice.
 */
export function sailFrame(length) {
  const segments = [
    { role: "spar", x1: SPAR_START * length, y1: 0, x2: length, y2: 0 },
    {
      role: "stringer",
      x1: FRAME_START * length, y1: FRAME_NEAR * length,
      x2: FRAME_END * length, y2: FRAME_NEAR * length
    },
    {
      role: "stringer",
      x1: FRAME_START * length, y1: FRAME_FAR * length,
      x2: FRAME_END * length, y2: FRAME_FAR * length
    }
  ];
  for (let rung = 0; rung < RUNG_COUNT; rung += 1) {
    const x = (FRAME_START + (FRAME_END - FRAME_START) * (rung / (RUNG_COUNT - 1))) * length;
    segments.push({ role: "rung", x1: x, y1: 0, x2: x, y2: FRAME_FAR * length });
  }
  return segments;
}

function rotated(segment, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    role: segment.role,
    x1: segment.x1 * cosine - segment.y1 * sine,
    y1: segment.x1 * sine + segment.y1 * cosine,
    x2: segment.x2 * cosine - segment.y2 * sine,
    y2: segment.x2 * sine + segment.y2 * cosine
  };
}

/**
 * All four sails around the hub, one per quarter turn. The quarter-turn symmetry is
 * load-bearing: the clip's wind turns the mill by a whole number of quarter turns to
 * within a fraction of a pixel, so the loop closes on a silhouette this symmetry
 * makes indistinguishable from the opening one.
 */
export function sailSegments(length) {
  const frame = sailFrame(length);
  return Array.from({ length: SAIL_COUNT }, (unused, sail) =>
    frame.map((segment) => rotated(segment, sail * QUARTER_TURN))
  );
}

/**
 * The tower: a trapezoid body rising from the hill to just above the hub, and the
 * conical cap overhanging it. Plain polygons, symmetric about the hub's vertical.
 */
export function towerShape({ hubX, crownY, baseY, crownWidth, baseWidth, capOverhang, capHeight }) {
  return {
    body: [
      { x: hubX - crownWidth / 2, y: crownY },
      { x: hubX + crownWidth / 2, y: crownY },
      { x: hubX + baseWidth / 2, y: baseY },
      { x: hubX - baseWidth / 2, y: baseY }
    ],
    cap: [
      { x: hubX - crownWidth / 2 - capOverhang, y: crownY },
      { x: hubX + crownWidth / 2 + capOverhang, y: crownY },
      { x: hubX, y: crownY - capHeight }
    ]
  };
}
