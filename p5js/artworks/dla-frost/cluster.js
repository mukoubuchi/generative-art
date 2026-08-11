/**
 * Diffusion-limited aggregation: one stuck seed, and walkers that wander in from far
 * away until they touch the cluster and freeze. Nothing chooses the shape — no field,
 * no rule about branches — yet branches are what grows, because a wandering particle is
 * far more likely to meet the cluster's outermost tips than to thread its way down a
 * fjord to the interior. The openness of the result is the visible record of that
 * shadowing, and the tests measure it rather than admire it.
 *
 * Everything is integer lattice cells and a seeded generator, so the same seed grows
 * the same crystal in a test as on the page.
 */

/** Mulberry32: a tiny seeded generator, uniform on [0, 1). */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Grows a cluster of `particles` cells from a seed at the origin. Returns them in
 * arrival order, each with its cell and its index — the index is the age a renderer
 * colours by. Walkers spawn on a circle just outside the cluster and are abandoned if
 * they stray far beyond it; while far away they leap the distance they are certain not
 * to meet anything across, which changes where they land not at all and the running
 * time enormously.
 */
export function growCluster({ particles, seed }) {
  const random = mulberry32(seed);
  const occupied = new Set();
  const grown = [];
  const key = (x, y) => x * 4096 + y;

  const settle = (x, y) => {
    occupied.add(key(x, y));
    grown.push({ x, y, index: grown.length });
  };
  settle(0, 0);
  let clusterRadius = 0;

  while (grown.length < particles) {
    const angle = random() * 2 * Math.PI;
    const spawnRadius = clusterRadius + 5;
    let x = Math.round(spawnRadius * Math.cos(angle));
    let y = Math.round(spawnRadius * Math.sin(angle));
    const killRadius = clusterRadius + 24;

    for (;;) {
      const distance = Math.hypot(x, y);
      if (distance > killRadius) {
        break;
      }
      if (distance > clusterRadius + 3) {
        // Far from everything: jump the guaranteed-empty gap in one stride.
        const stride = Math.max(1, Math.floor(distance - clusterRadius - 2));
        const direction = random() * 2 * Math.PI;
        x += Math.round(stride * Math.cos(direction));
        y += Math.round(stride * Math.sin(direction));
        continue;
      }
      const [dx, dy] = STEPS[Math.floor(random() * 4)];
      x += dx;
      y += dy;
      if (
        occupied.has(key(x + 1, y)) || occupied.has(key(x - 1, y))
        || occupied.has(key(x, y + 1)) || occupied.has(key(x, y - 1))
      ) {
        if (!occupied.has(key(x, y))) {
          settle(x, y);
          clusterRadius = Math.max(clusterRadius, Math.hypot(x, y));
        }
        break;
      }
    }
  }
  return grown;
}
