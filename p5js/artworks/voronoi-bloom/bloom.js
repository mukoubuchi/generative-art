export const SITE_COUNT = 42;
export const ART_SEED = 20260808;
export const GOLDEN_ANGLE = 2.3999632;
/** Hue runs from cyan through to magenta across the bloom. */
export const HUE_LOW = 185;
export const HUE_HIGH = 335;
/** How far apart the two nearest sites have to be before the edge stops glowing. */
export const EDGE_GAP = 20;

function mix(from, to, amount) {
  return from + (to - from) * amount;
}

/**
 * Sites on a golden-angle spiral, jittered.
 *
 * The exponent on the radius packs the spiral more tightly towards the rim than a plain
 * square root would, which is what gives the bloom a dense centre and open petals. The
 * jitter keeps the Voronoi edges from falling into the regular pattern the bare spiral
 * would produce. `random` and `noise` are injected so the layout can be built without p5.
 */
export function createSites(width, height, random, noise) {
  const reach = Math.min(width, height) * 0.44;
  return Array.from({ length: SITE_COUNT }, (unused, index) => {
    const progress = (index + 0.65) / SITE_COUNT;
    const radius = Math.pow(progress, 0.62) * reach;
    const angle = index * GOLDEN_ANGLE + random(-0.16, 0.16);
    const x = width * 0.5 + Math.cos(angle) * radius + random(-8, 8);
    const y = height * 0.5 + Math.sin(angle) * radius + random(-8, 8);
    return { x, y, hue: mix(HUE_LOW, HUE_HIGH, noise(x * 0.005, y * 0.00625)) };
  });
}

/**
 * The nearest site to a point and how much further the second nearest is. The gap between
 * the two is what locates a Voronoi boundary: it falls to zero exactly on an edge, so
 * shading by it draws the diagram without ever computing a polygon.
 *
 * Results are written into `out` so the per-pixel loop allocates nothing.
 */
export function nearestTwo(xs, ys, count, x, y, out) {
  let nearest = Number.POSITIVE_INFINITY;
  let second = Number.POSITIVE_INFINITY;
  let index = 0;
  for (let site = 0; site < count; site += 1) {
    const dx = x - xs[site];
    const dy = y - ys[site];
    const squared = dx * dx + dy * dy;
    if (squared < nearest) {
      second = nearest;
      nearest = squared;
      index = site;
    } else if (squared < second) {
      second = squared;
    }
  }
  out.index = index;
  out.nearest = Math.sqrt(nearest);
  out.gap = Math.sqrt(second) - out.nearest;
  return out;
}

/**
 * The nearest-neighbour pairs used by the frozen Retina-density specimen.
 *
 * The live artwork no longer draws this second graph. The helper remains because the
 * specimen is the sketch exactly as it shipped with the density fault, and that specimen
 * is executed by the smoke check rather than merely read as text.
 */
export function connections(sites) {
  const pairs = [];
  for (let index = 0; index < sites.length; index += 1) {
    let nearest = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let other = 0; other < sites.length; other += 1) {
      if (other === index) {
        continue;
      }
      const dx = sites[index].x - sites[other].x;
      const dy = sites[index].y - sites[other].y;
      const squared = dx * dx + dy * dy;
      if (squared < nearestDistance) {
        nearestDistance = squared;
        nearest = other;
      }
    }
    if (nearest >= 0 && index < nearest) {
      pairs.push([index, nearest]);
    }
  }
  return pairs;
}

/** Hue, saturation and brightness for one pixel, given its Voronoi measurements. */
export function shade(site, measurement, texture, vignette) {
  const edgeGlow = Math.pow(1 - Math.min(1, Math.max(0, measurement.gap / EDGE_GAP)), 2.2);
  const centreGlow = Math.exp(-measurement.nearest * 0.052);
  const brightness = (9 + edgeGlow * 70 + centreGlow * 24 + texture * 7)
    * (0.38 + 0.62 * Math.pow(vignette, 0.32));
  return {
    hue: (site.hue + (texture - 0.5) * 28) % 360,
    saturation: Math.max(0, Math.min(100, 82 - edgeGlow * 42 - centreGlow * 12)),
    brightness: Math.max(0, Math.min(100, brightness))
  };
}
