/**
 * Greedy circle packing: throw a dart, grow a circle where it lands, repeat.
 *
 * Two constraints and nothing else — a new circle may not cross the frame, and may not
 * cross a circle already placed — yet the result has structure: big circles claim the
 * open country early, later darts only fit the gaps between them, and the gaps between
 * those fill last and smallest. The size hierarchy nobody chose is the record of who
 * arrived when, which is why the renderer colours by arrival.
 *
 * Determinism is the seeded generator's: same seed, same packing, byte for byte.
 */
import { mulberry32 } from "../shared/random.js";

/**
 * The packing the artwork draws: what the sketch renders and the tests measure are the
 * same run, so the numbers below are pinned in one place. Thirty thousand darts fill
 * just under three quarters of the square before the gaps drop below the minimum.
 */
export const PACKING_PARAMETERS = {
  attempts: 30000,
  seed: 11,
  maximumRadius: 0.18,
  minimumRadius: 0.0025,
  margin: 0.006
};

/**
 * Packs up to `attempts` darts into the unit square, keeping those that fit. A dart
 * that lands inside or too close to an existing circle is discarded; one that fits
 * grows until it touches its nearest neighbour or the frame, capped so a lucky early
 * dart cannot swallow the composition.
 *
 * Radii are found by distance, not by trial growth: the largest legal circle at a point
 * is the smallest of (distance to each circle's rim, distance to each wall), which is
 * exact rather than stepped.
 */
export function packCircles({ attempts, seed, maximumRadius = 0.18, minimumRadius = 0.004, margin = 0.012 }) {
  const random = mulberry32(seed);
  const circles = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const x = random();
    const y = random();
    let allowed = Math.min(
      maximumRadius,
      x - margin,
      y - margin,
      1 - margin - x,
      1 - margin - y
    );
    for (const other of circles) {
      const gap = Math.hypot(x - other.x, y - other.y) - other.radius - margin;
      if (gap < allowed) {
        allowed = gap;
        if (allowed < minimumRadius) {
          break;
        }
      }
    }
    if (allowed >= minimumRadius) {
      circles.push({ x, y, radius: allowed, index: circles.length });
    }
  }
  return circles;
}

/** The fraction of the unit square the packing covers; the tests watch it grow. */
export function coverage(circles) {
  return circles.reduce((sum, { radius }) => sum + Math.PI * radius * radius, 0);
}
