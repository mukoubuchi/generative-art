import { mulberry32 } from "../shared/random.js";

/**
 * Sunlight through the gaps of a canopy, during an eclipse of the sun.
 *
 * The model is geometric optics and nothing else: light travels in straight lines, the sun
 * is a uniformly bright disk, the moon an opaque one, and there is no diffraction. The sun
 * stands at the zenith, the canopy is a thin opaque sheet with holes in it, and the ground
 * is flat. The sheet is not all at one height: each patch of it hangs at one of three.
 *
 * A point x of the ground sees, through the canopy at height h, the sky direction θ exactly
 * when x + hθ falls in a hole. So the light at x is the part of the bright sky whose image,
 * pushed up to the canopy, lands in the holes:
 *
 *   I(x) = ∫ H(x + u) S(u) du / ∫ S(u) du,        u = hθ,
 *
 * where H is the hole mask and S the bright sky drawn at the canopy's scale — the sun's disk
 * with the moon's taken out of it. Nothing in that formula turns anything over. The image a
 * single small hole at y throws is the set of x with y − x in S, which is S turned through a
 * half turn about y; the ground shows the sky upside down because the formula reads it
 * through the hole, not because anything here reverses it.
 *
 * The holes are the gaps between leaves, and the wind moves the leaves: the mask is laid
 * again at every frame from where the wind has each leaf.
 */

export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 12;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/**
 * The three heights of the canopy, measured in the one unit that matters to the picture:
 * the radius, in logical pixels, of the sun a hole at that height throws on the ground.
 * The sun's angular radius is the scale between the two, and it is taken as one pixel of
 * image per unit of height, so a layer's height and its sun's radius are the same number.
 */
export const LAYER_HEIGHTS = [9, 14, 21];

/**
 * The eclipse the clip shows, a partial one. The moon's radius is given as a multiple of the
 * sun's and its path as the least distance between the two centres, in sun radii; at its
 * deepest the moon covers three quarters of the sun.
 */
export const ECLIPSE = { moonRatio: 1.03125, impact: 0.4375 };

/**
 * The moon crosses at one speed from two and a half sun radii on one side to two and a half
 * on the other. Both ends are clear of the sun, so the first frame and the frame after the
 * last show the same uneclipsed sky and the clip closes without a seam.
 */
export const MOON_REACH = 2.5;

const MAX_HEIGHT = Math.max(...LAYER_HEIGHTS);

/**
 * The canopy is laid out on a grid wider than the canvas by this margin on every side, so
 * that a hole just beyond the edge still throws its image in.
 */
export const CANOPY_MARGIN = MAX_HEIGHT + 4;
export const CANOPY_SIZE = LOGICAL_SIZE + 2 * CANOPY_MARGIN;

/**
 * The moon's centre relative to the sun's, in sun radii, as the sky is seen from the
 * ground: x along the canvas's rightward axis, y along its downward one. It moves along x
 * at one speed and is displaced by the eclipse's impact along y.
 */
export function moonAt(frameIndex) {
  const frame = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  return {
    x: -MOON_REACH + 2 * MOON_REACH * frame / TOTAL_FRAMES,
    y: ECLIPSE.impact,
    ratio: ECLIPSE.moonRatio
  };
}

/** The time of a frame, in seconds from the start of the clip. */
export function timeOf(frameIndex) {
  return (((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES) / PLAYBACK_FPS;
}

/**
 * Whether the moon hides the sky at u, where u is a direction scaled by the height of the
 * layer the light passes (so the sun is the disk of radius `height` about the origin).
 * The one test of the sky, used both by the light below and by the geometry the tests pin.
 */
export function skyIsBright(u, height, moon) {
  const sunReach = height * height;
  if (u.x * u.x + u.y * u.y >= sunReach) {
    return false;
  }
  const dx = u.x - height * moon.x;
  const dy = u.y - height * moon.y;
  const moonReach = height * moon.ratio;
  return dx * dx + dy * dy >= moonReach * moonReach;
}

/**
 * Along one row of the sky, at height dy above the sun's centre, the stretches of u.x where
 * the sky is bright: the sun's chord with the moon's chord taken out. At most two.
 */
export function brightChords(dy, height, moon) {
  if (Math.abs(dy) >= height) {
    return [];
  }
  const half = Math.sqrt(height * height - dy * dy);
  const moonRadius = height * moon.ratio;
  const moonDy = dy - height * moon.y;
  if (Math.abs(moonDy) >= moonRadius) {
    return [[-half, half]];
  }
  const moonHalf = Math.sqrt(moonRadius * moonRadius - moonDy * moonDy);
  const moonLeft = height * moon.x - moonHalf;
  const moonRight = height * moon.x + moonHalf;
  const chords = [];
  if (moonLeft > -half) {
    chords.push([-half, Math.min(half, moonLeft)]);
  }
  if (moonRight < half) {
    chords.push([Math.max(-half, moonRight), half]);
  }
  return chords.filter(([from, to]) => to > from);
}

/**
 * Running sums of a hole mask along its rows: `sums[row * (size + 1) + column]` is the open
 * area of the row to the left of `column`. With these, the open length of any stretch of a
 * row is two lookups, and a fractional end is exact because the mask is constant across a
 * cell.
 */
export function rowSums(mask, size) {
  const stride = size + 1;
  const sums = new Float32Array(size * stride);
  for (let row = 0; row < size; row += 1) {
    let total = 0;
    for (let column = 0; column < size; column += 1) {
      sums[row * stride + column] = total;
      total += mask[row * size + column];
    }
    sums[row * stride + size] = total;
  }
  return sums;
}

function openLengthBefore(sums, mask, size, row, position) {
  if (position <= 0) {
    return 0;
  }
  if (position >= size) {
    return sums[row * (size + 1) + size];
  }
  const column = Math.floor(position);
  return sums[row * (size + 1) + column] + (position - column) * mask[row * size + column];
}

/**
 * How many times each row of canopy cells is read across its height. A row read only at its
 * middle switches on or off whole as the sun's rim passes that middle, and the images come
 * out finely striped; read at several heights, the steps are small enough to vanish.
 */
export const SUB_ROWS = 4;

/**
 * The light one layer lets through to the ground point (x, y) of the canvas: the open area
 * the bright sky covers once it is laid on the canopy at (x, y), over the area of the sun.
 * Each row of cells is read at SUB_ROWS evenly spaced heights; each reading's stretch along
 * the row is exact.
 */
export function layerLight(layer, size, x, y, height, moon, subRows = SUB_ROWS) {
  const cx = x + CANOPY_MARGIN;
  const cy = y + CANOPY_MARGIN;
  const firstRow = Math.max(0, Math.floor(cy - height));
  const lastRow = Math.min(size - 1, Math.floor(cy + height));
  // The cells the sun's full width crosses, whole ones, when they are all on the grid.
  const first = Math.floor(cx - height);
  const last = Math.ceil(cx + height);
  const onGrid = first >= 0 && last <= size;
  let open = 0;
  let sun = 0;
  for (let row = firstRow; row <= lastRow; row += 1) {
    // When every one of them is open, the open length of a stretch is its length.
    const whole = onGrid && layer.sums[row * (size + 1) + last] - layer.sums[row * (size + 1) + first] >= last - first;
    for (let sub = 0; sub < subRows; sub += 1) {
      const dy = row + (sub + 0.5) / subRows - cy;
      if (Math.abs(dy) >= height) {
        continue;
      }
      sun += 2 * Math.sqrt(height * height - dy * dy);
      for (const [from, to] of brightChords(dy, height, moon)) {
        open += whole
          ? to - from
          : openLengthBefore(layer.sums, layer.mask, size, row, cx + to) - openLengthBefore(layer.sums, layer.mask, size, row, cx + from);
      }
    }
  }
  return sun > 0 ? open / sun : 0;
}

/** All three layers together: what reaches the ground point (x, y) at a frame, through a canopy laid for it. */
export function lightAt(canopy, x, y, frameIndex) {
  const moon = moonAt(frameIndex);
  let light = 0;
  canopy.layers.forEach((layer, index) => {
    light += layerLight(layer, canopy.size, x, y, LAYER_HEIGHTS[index], moon);
  });
  return light;
}

/**
 * The light the uneclipsed sun would put through a layer at the same point: the reference
 * the eclipse is measured against.
 */
export const CLEAR_SKY = { x: 0, y: 0, ratio: 0 };

/**
 * The crown. Its edge crosses the canvas: past it no leaf grows and the ground is in the
 * sun. Near the edge the sheet is all at the middle height, so the open ground past it,
 * wherever the wind has moved the edge, is lit by one sun.
 */
export const CROWN_LAYER = 1;

/**
 * The canopy: leaves laid at random over a sheet split into patches, each patch at one of
 * the three heights, with a few clearings where no leaf falls. The holes are whatever the
 * leaves happen to leave open; nothing cuts them to a shape.
 */
export const CANOPY_LAYOUT = {
  seed: 20260923,
  patches: 17,
  /** The mean number of leaves over any point, per layer; the open share is about e^-cover. */
  cover: [3.7, 4.1, 4.5],
  leafLength: [7, 12],
  leafWidth: [0.38, 0.6],
  clearings: 6,
  clearingRadius: [14, 30],
  /** The crown's outline, in canvas pixels: a lobed circle whose edge crosses the canvas. */
  crown: { x: -260, y: 260, radius: 760, lobes: [[3, 0.05, 1.0], [7, 0.03, 2.2], [13, 0.015, 0.4]] },
  /** How far inside the edge, in logical pixels, the sheet is all at the crown's layer. */
  rim: 30,
  /** How far beyond the grid, in logical pixels, leaves are laid for the wind to carry in. */
  pad: 32
};

/** The crown's edge, as the signed distance from it in canvas pixels: positive under the crown. */
export function crownDepth(crown, x, y) {
  const dx = x - crown.x;
  const dy = y - crown.y;
  const angle = Math.atan2(dy, dx);
  let radius = crown.radius;
  for (const [count, amount, phase] of crown.lobes) radius *= 1 + amount * Math.sin(count * angle + phase);
  return radius - Math.hypot(dx, dy);
}

function voronoiPatches(random, count, size) {
  const centres = [];
  for (let index = 0; index < count; index += 1) {
    centres.push({ x: random() * size, y: random() * size, layer: index % LAYER_HEIGHTS.length });
  }
  return centres;
}

function nearestPatch(centres, x, y) {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < centres.length; index += 1) {
    const dx = centres[index].x - x;
    const dy = centres[index].y - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return centres[best].layer;
}

/**
 * The leaves of the canopy, where they grow and how they lie before any wind: the patches
 * each at one of the three heights, the clearings, and every leaf that is kept. Built from
 * one seed, so the canopy is the same every time.
 */
export function buildLeaves(options = CANOPY_LAYOUT) {
  const random = mulberry32(options.seed);
  const size = CANOPY_SIZE;
  const layerOf = new Uint8Array(size * size);
  const centres = voronoiPatches(random, options.patches, size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const depth = crownDepth(options.crown, column + 0.5 - CANOPY_MARGIN, row + 0.5 - CANOPY_MARGIN);
      layerOf[row * size + column] = depth < options.rim ? CROWN_LAYER : nearestPatch(centres, column + 0.5, row + 0.5);
    }
  }

  const clearings = [];
  for (let index = 0; index < options.clearings; index += 1) {
    const [least, most] = options.clearingRadius;
    clearings.push({
      x: CANOPY_MARGIN + random() * LOGICAL_SIZE,
      y: CANOPY_MARGIN + random() * LOGICAL_SIZE,
      radius: least + random() * (most - least)
    });
  }
  const inClearing = (x, y) => clearings.some((clearing) =>
    (x - clearing.x) ** 2 + (y - clearing.y) ** 2 < clearing.radius ** 2);

  // Leaves fall uniformly; how thickly depends on the height of the patch they fall in.
  const [shortest, longest] = options.leafLength;
  const [narrowest, widest] = options.leafWidth;
  const meanArea = Math.PI * ((shortest + longest) / 2) ** 2 * ((narrowest + widest) / 2);
  const leafCount = Math.round(Math.max(...options.cover) * size * size / meanArea);
  const leaves = [];
  for (let index = 0; index < leafCount; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const layer = layerOf[Math.min(size - 1, Math.floor(y)) * size + Math.min(size - 1, Math.floor(x))];
    const keep = random() < options.cover[layer] / Math.max(...options.cover);
    const length = shortest + random() * (longest - shortest);
    const width = length * (narrowest + random() * (widest - narrowest));
    const angle = random() * Math.PI;
    if (!keep || inClearing(x, y)) {
      continue;
    }
    leaves.push({ x, y, length, width, angle, layer });
  }
  // Leaves beyond the grid, for the wind to carry in across its edge. They come from a
  // stream of their own, so the leaves on the grid are the same with them or without.
  const beyond = mulberry32(options.seed + 1);
  const outer = size + 2 * options.pad;
  const draws = Math.round(Math.max(...options.cover) * outer * outer / meanArea);
  for (let index = 0; index < draws; index += 1) {
    const x = -options.pad + beyond() * outer;
    const y = -options.pad + beyond() * outer;
    const cell = Math.min(size - 1, Math.max(0, Math.floor(y))) * size + Math.min(size - 1, Math.max(0, Math.floor(x)));
    const layer = layerOf[cell];
    const keep = beyond() < options.cover[layer] / Math.max(...options.cover);
    const length = shortest + beyond() * (longest - shortest);
    const width = length * (narrowest + beyond() * (widest - narrowest));
    const angle = beyond() * Math.PI;
    const onGrid = x >= 0 && x < size && y >= 0 && y < size;
    if (keep && !onGrid) {
      leaves.push({ x, y, length, width, angle, layer });
    }
  }
  // Past the crown's edge no leaf grows.
  const kept = leaves.filter((leaf) => crownDepth(options.crown, leaf.x - CANOPY_MARGIN, leaf.y - CANOPY_MARGIN) >= 0);
  return { size, layerOf, clearings, leaves: kept };
}

/**
 * The wind in the canopy, as a smooth random field, not a solved flow. Two kinds of wave run
 * through it. Long ones sway the branches: they carry every leaf within a few hundred pixels
 * the same way, by a few pixels, and turn over every two to twelve seconds. Short ones make
 * the leaves flutter: they turn a leaf about its own middle and tilt it so that it shows
 * less of its width, over a few tens of pixels, a few times a second. Every wave turns a
 * whole number of times in twelve seconds, so the wind, like the clip, closes on itself.
 * The swaying waves each turn a different number of times, one to six: waves of one period
 * add up, at any one leaf, to a single sine of that period, and a leaf would sway to it.
 * A leaf is moved by the field where it grows and by nothing of its own.
 */
function windWaves(seed, count, [shortest, longest], [fewest, most], distinct = false) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (unused, index) => {
    const angle = random() * 2 * Math.PI;
    const wavelength = shortest * Math.pow(longest / shortest, random());
    const drawn = fewest + Math.floor(random() * (most - fewest + 1));
    return {
      kx: Math.cos(angle) * 2 * Math.PI / wavelength,
      ky: Math.sin(angle) * 2 * Math.PI / wavelength,
      cycles: distinct ? fewest + index : drawn,
      phase: random() * 2 * Math.PI,
      // Which way the wave carries a leaf, for the swaying waves.
      heading: random() * 2 * Math.PI
    };
  });
}

export const SWAY_WAVES = windWaves(7061, 6, [180, 450], [1, 6], true);
export const FLUTTER_WAVES = windWaves(7062, 8, [24, 70], [8, 24]);
/** The largest sway, in logical pixels, if every wave pulled one way at once. */
export const SWAY_REACH = 16;
/** How far a leaf turns and how much of its width it can lose, at the flutter's height. */
export const FLUTTER_TURN = 0.3;
export const FLUTTER_TILT = 0.5;

function wave(waves, x, y, t) {
  let sum = 0;
  for (const { kx, ky, cycles, phase } of waves) {
    sum += Math.sin(kx * x + ky * y + 2 * Math.PI * cycles * t / DURATION_SECONDS + phase);
  }
  // Scaled by the square root of the count, so that the field's spread stays near one.
  return sum / Math.sqrt(waves.length);
}

/**
 * Gusts: a pattern of stronger and weaker wind that the mean wind carries across the crown
 * without changing it on the way (Taylor's frozen turbulence), again a smooth random field,
 * not a solved flow. The pattern is as long as the wind travels in one clip, so a gust
 * passes every point once a clip at the same moment of it. Its front is bent a little
 * across the wind. Where a gust is, the branches lean downwind and the leaves sway and
 * flutter harder; between gusts they are calmer.
 */
export const GUST = {
  /** The way the wind blows, in radians from the canvas's rightward axis. */
  heading: 0.35,
  /** How fast it carries the pattern, in logical pixels a second. */
  speed: 300,
  /** Where each gust sits along the pattern, as a share of its length, and how strong it is. */
  gusts: [[0.1, 1.0], [0.43, 0.7], [0.72, 0.85]],
  /** How narrow a gust is: its strength falls as the power of a raised cosine. */
  sharpness: 12,
  /** The front's bend: how far, in logical pixels, over what length across the wind, at what phase. */
  front: [120, 1100, 0.7],
  /** The sway and flutter between gusts and in a full one, as multiples of the field's own. */
  calm: 0.3,
  full: 1.3,
  /** How far a full gust leans the branches downwind, in logical pixels. */
  lean: 7
};

/** How strong the gust is at (x, y) at time t, from nought between gusts to one in a full one. */
export function gustAt(x, y, t) {
  const along = x * Math.cos(GUST.heading) + y * Math.sin(GUST.heading);
  const across = -x * Math.sin(GUST.heading) + y * Math.cos(GUST.heading);
  const [bend, bendLength, bendPhase] = GUST.front;
  const length = GUST.speed * DURATION_SECONDS;
  const place = (along + bend * Math.sin(2 * Math.PI * across / bendLength + bendPhase)) / length - t / DURATION_SECONDS;
  let strength = 0;
  for (const [at, amount] of GUST.gusts) {
    strength += amount * ((1 + Math.cos(2 * Math.PI * (place - at))) / 2) ** GUST.sharpness;
  }
  return Math.min(1, strength);
}

/** Where the wind has a leaf growing at (x, y) at time t, in seconds: moved, turned, and narrowed. */
export function windAt(x, y, t) {
  let dx = 0;
  let dy = 0;
  for (const { kx, ky, cycles, phase, heading } of SWAY_WAVES) {
    const push = Math.sin(kx * x + ky * y + 2 * Math.PI * cycles * t / DURATION_SECONDS + phase);
    dx += Math.cos(heading) * push;
    dy += Math.sin(heading) * push;
  }
  const flutter = wave(FLUTTER_WAVES, x, y, t);
  const tilt = wave(FLUTTER_WAVES, y, x, t + DURATION_SECONDS / 3);
  const strength = gustAt(x, y, t);
  const stir = GUST.calm + (GUST.full - GUST.calm) * strength;
  const lean = GUST.lean * strength;
  return {
    dx: stir * SWAY_REACH * dx / SWAY_WAVES.length + lean * Math.cos(GUST.heading),
    dy: stir * SWAY_REACH * dy / SWAY_WAVES.length + lean * Math.sin(GUST.heading),
    turn: FLUTTER_TURN * stir * flutter,
    width: Math.max(0.35, 1 - FLUTTER_TILT * stir * Math.abs(tilt))
  };
}

/**
 * How many numbers place one leaf: its centre, how far it reaches from the centre along each
 * axis, the cosine and sine of its angle, and the inverses of its half length and half width.
 */
export const PLACEMENT_STRIDE = 8;

/**
 * Every leaf where the wind has it at time t, in single precision: the numbers the graphics
 * card is given, and the numbers the module lays the leaves from, so the two agree. The
 * reach has half a cell to spare, so every fine point inside a leaf is inside its quad.
 */
export function leafPlacement(base, t) {
  const placement = new Float32Array(base.leaves.length * PLACEMENT_STRIDE);
  base.leaves.forEach((leaf, index) => {
    const wind = windAt(leaf.x, leaf.y, t);
    const angle = leaf.angle + wind.turn;
    const length = leaf.length;
    const width = leaf.width * wind.width;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const at = index * PLACEMENT_STRIDE;
    placement[at] = leaf.x + wind.dx;
    placement[at + 1] = leaf.y + wind.dy;
    placement[at + 2] = Math.sqrt((length * cos) ** 2 + (width * sin) ** 2) + 0.5;
    placement[at + 3] = Math.sqrt((length * sin) ** 2 + (width * cos) ** 2) + 0.5;
    placement[at + 4] = cos;
    placement[at + 5] = sin;
    placement[at + 6] = 1 / length;
    placement[at + 7] = 1 / width;
  });
  return placement;
}

/**
 * Whether the fine point (column, row) is under the leaf placed at `at`, decided in single
 * precision step by step as the card decides it. Far from the leaf's rim the double
 * precision answer is the same and is used; within a ten-thousandth of it, every step is
 * rounded as the card rounds it.
 */
function underLeaf(placement, at, column, row) {
  const x = (column + 0.5) / 2;
  const y = (row + 0.5) / 2;
  const cos = placement[at + 4];
  const sin = placement[at + 5];
  const dx = x - placement[at];
  const dy = y - placement[at + 1];
  const u = (dx * cos + dy * sin) * placement[at + 6];
  const v = (dy * cos - dx * sin) * placement[at + 7];
  const reach = u * u + v * v;
  if (reach < 1 - 1e-4) return true;
  if (reach > 1 + 1e-4) return false;
  const f = Math.fround;
  const sdx = f(x - placement[at]);
  const sdy = f(y - placement[at + 1]);
  const along = f(f(sdx * cos) + f(sdy * sin));
  const across = f(f(sdy * cos) - f(sdx * sin));
  const su = f(along * placement[at + 6]);
  const sv = f(across * placement[at + 7]);
  return f(f(su * su) + f(sv * sv)) <= 1;
}

/**
 * The canopy as the leaves lie in a placement: each leaf an ellipse on a grid twice as fine
 * as the cells, and each cell's open share taken from its four fine points. A cell belongs
 * to the layer of its patch, as a leaf's shadow falls on the patch below it whatever layer
 * the leaf grew in.
 */
export function rasterize(base, placement) {
  const size = base.size;
  const fine = 2 * size;
  const covered = new Uint8Array(fine * fine);
  for (let at = 0; at < placement.length; at += PLACEMENT_STRIDE) {
    const x = placement[at];
    const y = placement[at + 1];
    // The fine points whose centres, (index + 0.5) / 2, lie inside the leaf's quad.
    const firstColumn = Math.max(0, Math.ceil(2 * (x - placement[at + 2]) - 0.5));
    const lastColumn = Math.min(fine - 1, Math.floor(2 * (x + placement[at + 2]) - 0.5));
    const firstRow = Math.max(0, Math.ceil(2 * (y - placement[at + 3]) - 0.5));
    const lastRow = Math.min(fine - 1, Math.floor(2 * (y + placement[at + 3]) - 0.5));
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        if (!covered[row * fine + column] && underLeaf(placement, at, column, row)) {
          covered[row * fine + column] = 1;
        }
      }
    }
  }

  const layers = LAYER_HEIGHTS.map(() => new Float32Array(size * size));
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const top = 2 * row * fine + 2 * column;
      const open = 4 - covered[top] - covered[top + 1] - covered[top + fine] - covered[top + fine + 1];
      layers[base.layerOf[row * size + column]][row * size + column] = open / 4;
    }
  }
  return {
    size,
    leaves: base.leaves.length,
    clearings: base.clearings,
    layerOf: base.layerOf,
    layers: layers.map((mask) => ({ mask, sums: rowSums(mask, size) }))
  };
}

/** The canopy at a frame, its leaves where the wind has them. */
export function canopyAt(base, frameIndex) {
  return rasterize(base, leafPlacement(base, timeOf(frameIndex)));
}

/** The canopy as it is laid at a frame, from the one seed. */
export function buildCanopy(frameIndex = 0) {
  return canopyAt(buildLeaves(), frameIndex);
}

/**
 * The share of the sky, weighed as it lights the ground, that a point sees past the
 * crown's edge: for an edge at height H and the point s inside it, (1 − s/√(s² + H²))/2,
 * the sky beyond a straight edge. H is the height the crown's layer stands at: its sun's
 * radius over the sun's angular radius, 0.00465 radians.
 */
export const SUN_ANGULAR_RADIUS = 0.00465;
export function skyPastCrown(depth) {
  const H = LAYER_HEIGHTS[CROWN_LAYER] / SUN_ANGULAR_RADIUS;
  return (1 - depth / Math.hypot(depth, H)) / 2;
}

/** Sunlight, and the light in the shade, as linear colours, the sun's at full sun. */
export const SUN_COLOUR = [1.0, 0.84, 0.6];
export const SHADE_COLOUR = [0.5, 0.66, 0.58];
/** The ground's colour, an earth, by which its texture is multiplied. */
export const EARTH = [1.25, 1.0, 0.76];

/**
 * The ground's reflectance, a fine texture of earth: noise at a few scales about 0.3, the
 * same everywhere and every frame, from one seed. Held on a grid of logical pixels.
 */
export const GROUND_SIZE = LOGICAL_SIZE;
export function groundAlbedo() {
  const random = mulberry32(80923);
  const albedo = new Float32Array(GROUND_SIZE * GROUND_SIZE);
  const octaves = [[64, 0.06], [24, 0.06], [8, 0.07], [3, 0.06]];
  for (const [cell, amount] of octaves) {
    const n = Math.ceil(GROUND_SIZE / cell) + 2;
    const grid = Float32Array.from({ length: n * n }, () => random() * 2 - 1);
    for (let y = 0; y < GROUND_SIZE; y += 1) {
      const gy = y / cell;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < GROUND_SIZE; x += 1) {
        const gx = x / cell;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const a = grid[y0 * n + x0] + (grid[y0 * n + x0 + 1] - grid[y0 * n + x0]) * sx;
        const b = grid[(y0 + 1) * n + x0] + (grid[(y0 + 1) * n + x0 + 1] - grid[(y0 + 1) * n + x0]) * sx;
        albedo[y * GROUND_SIZE + x] += amount * (a + (b - a) * sy);
      }
    }
  }
  for (let k = 0; k < albedo.length; k += 1) albedo[k] += 0.3;
  return albedo;
}

/** The share of the sun the moon leaves showing: what lights the sky and the canopy's glow. */
export function sunShowing(moon) {
  // The overlap of two circles, the sun of radius one and the moon of radius moon.ratio.
  const d = Math.hypot(moon.x, moon.y);
  const r = moon.ratio;
  if (d >= 1 + r) return 1;
  if (d <= Math.abs(r - 1)) return r >= 1 ? 0 : 1 - r * r;
  const a = Math.acos((d * d + 1 - r * r) / (2 * d));
  const b = Math.acos((d * d + r * r - 1) / (2 * d * r));
  const overlap = a + r * r * b - 0.5 * Math.sqrt((-d + 1 + r) * (d + 1 - r) * (d - 1 + r) * (d + 1 + r));
  return 1 - overlap / Math.PI;
}

/**
 * The light in the shade, as shares of full sun: the canopy's own glow, sky and leaf-light
 * together, under the part of the sky the crown covers, and skylight past its edge. Both
 * values are chosen for the look, not derived.
 */
export const SHADE_LIGHT = 0.012;
export const SKY_LIGHT = 0.12;

/**
 * The light in the shade at a ground point while `showing` of the sun shows. Both parts are
 * lit by the sun, and dim with it in the eclipse.
 */
export function shadeLightAt(x, y, showing) {
  const sky = skyPastCrown(crownDepth(CANOPY_LAYOUT.crown, x, y));
  return (SHADE_LIGHT * (1 - sky) + SKY_LIGHT * sky) * showing;
}

/** How strongly the light is exposed, as on film. */
export const LIT_EXPOSURE = 9;

/**
 * The colour of a ground point: its albedo times the sun through the gaps and the shade's
 * light, exposed like film and encoded as sRGB, 0–255.
 */
export function litTone(light, shadeLight, albedo) {
  return SUN_COLOUR.map((sun, i) => {
    const linear = albedo * EARTH[i] * (sun * light + SHADE_COLOUR[i] * shadeLight);
    const exposed = 1 - Math.exp(-LIT_EXPOSURE * linear);
    const x = Math.min(1, Math.max(0, exposed));
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  });
}

/** The colour the module gives a ground point at a frame, through a canopy laid for that frame. */
export function toneAt(canopy, albedo, x, y, frameIndex) {
  const moon = moonAt(frameIndex);
  const light = lightAt(canopy, x, y, frameIndex);
  const ground = albedo[Math.floor(y) * GROUND_SIZE + Math.floor(x)];
  return litTone(light, shadeLightAt(x, y, sunShowing(moon)), ground);
}

/**
 * The holes of one layer, as connected pieces of open cells (sides touching): their number
 * and open areas. The picture's claim of "every gap an image" is counted against these.
 */
export function holePieces(mask, size) {
  const seen = new Uint8Array(size * size);
  const pieces = [];
  const stack = [];
  for (let start = 0; start < size * size; start += 1) {
    if (seen[start] || mask[start] <= 0) {
      continue;
    }
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    const indices = [];
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const index = stack.pop();
      const row = Math.floor(index / size);
      const column = index - row * size;
      area += mask[index];
      sumX += mask[index] * (column + 0.5);
      sumY += mask[index] * (row + 0.5);
      indices.push(index);
      const neighbours = [
        column > 0 ? index - 1 : -1,
        column < size - 1 ? index + 1 : -1,
        row > 0 ? index - size : -1,
        row < size - 1 ? index + size : -1
      ];
      for (const next of neighbours) {
        if (next >= 0 && !seen[next] && mask[next] > 0) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    pieces.push({ area, cells: indices.length, indices, x: sumX / area - CANOPY_MARGIN, y: sumY / area - CANOPY_MARGIN });
  }
  return pieces;
}
