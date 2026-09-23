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

/** How far, in logical pixels, the wind carries each layer of the canopy, and how often. */
export const SWAY_AMPLITUDE = 1.5;
export const SWAY_TURNS = [2, 3, 1];

const MAX_HEIGHT = Math.max(...LAYER_HEIGHTS);

/**
 * The canopy is laid out on a grid wider than the canvas by this margin on every side, so
 * that a hole just beyond the edge still throws its image in, and the wind has room.
 */
export const CANOPY_MARGIN = MAX_HEIGHT + Math.ceil(SWAY_AMPLITUDE) + 2;
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

/** Where the wind has carried a layer's holes, in logical pixels. It closes every clip. */
export function swayAt(frameIndex, layerIndex) {
  const phase = 2 * Math.PI * SWAY_TURNS[layerIndex] * frameIndex / TOTAL_FRAMES + 1.7 * layerIndex;
  return {
    x: SWAY_AMPLITUDE * Math.sin(phase),
    y: 0.6 * SWAY_AMPLITUDE * Math.sin(2 * phase + 0.9)
  };
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
export function layerLight(layer, size, x, y, height, moon, sway, subRows = SUB_ROWS) {
  const cx = x + CANOPY_MARGIN - sway.x;
  const cy = y + CANOPY_MARGIN - sway.y;
  const firstRow = Math.max(0, Math.floor(cy - height));
  const lastRow = Math.min(size - 1, Math.floor(cy + height));
  let open = 0;
  let sun = 0;
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let sub = 0; sub < subRows; sub += 1) {
      const dy = row + (sub + 0.5) / subRows - cy;
      if (Math.abs(dy) >= height) {
        continue;
      }
      sun += 2 * Math.sqrt(height * height - dy * dy);
      for (const [from, to] of brightChords(dy, height, moon)) {
        open += openLengthBefore(layer.sums, layer.mask, size, row, cx + to)
          - openLengthBefore(layer.sums, layer.mask, size, row, cx + from);
      }
    }
  }
  return sun > 0 ? open / sun : 0;
}

/** All three layers together: what reaches the ground point (x, y) at a frame. */
export function lightAt(canopy, x, y, frameIndex) {
  const moon = moonAt(frameIndex);
  let light = 0;
  canopy.layers.forEach((layer, index) => {
    light += layerLight(layer, canopy.size, x, y, LAYER_HEIGHTS[index], moon, swayAt(frameIndex, index));
  });
  return light;
}

/**
 * The light the uneclipsed sun would put through a layer at the same point: the reference
 * the eclipse is measured against.
 */
export const CLEAR_SKY = { x: 0, y: 0, ratio: 0 };

/**
 * The canopy: leaves laid at random over a sheet split into patches, each patch at one of
 * the three heights, with a few clearings where no leaf falls. The holes are whatever the
 * leaves happen to leave open; nothing cuts them to a shape.
 *
 * Coverage is taken on a grid twice as fine as the mask and averaged, so a cell half under
 * a leaf is half open.
 */
export const CANOPY_LAYOUT = {
  seed: 20260923,
  patches: 17,
  /** The mean number of leaves over any point, per layer; the open share is about e^-cover. */
  cover: [4.2, 4.6, 5.0],
  leafLength: [7, 12],
  leafWidth: [0.38, 0.6],
  clearings: 6,
  clearingRadius: [14, 30]
};

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

export function buildCanopy() {
  const options = CANOPY_LAYOUT;
  const random = mulberry32(options.seed);
  const size = CANOPY_SIZE;
  const fine = 2 * size;
  const layerOf = new Uint8Array(size * size);
  const centres = voronoiPatches(random, options.patches, size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      layerOf[row * size + column] = nearestPatch(centres, column + 0.5, row + 0.5);
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
  const covered = new Uint8Array(fine * fine);
  const leafCount = Math.round(Math.max(...options.cover) * size * size / meanArea);
  let leaves = 0;
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
    leaves += 1;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const reach = Math.ceil(2 * length) + 1;
    const fx = 2 * x;
    const fy = 2 * y;
    for (let fineRow = Math.max(0, Math.floor(fy - reach)); fineRow <= Math.min(fine - 1, Math.ceil(fy + reach)); fineRow += 1) {
      for (let fineColumn = Math.max(0, Math.floor(fx - reach)); fineColumn <= Math.min(fine - 1, Math.ceil(fx + reach)); fineColumn += 1) {
        const px = (fineColumn + 0.5) / 2 - x;
        const py = (fineRow + 0.5) / 2 - y;
        const along = px * cos + py * sin;
        const across = -px * sin + py * cos;
        if ((along / length) ** 2 + (across / width) ** 2 <= 1) {
          covered[fineRow * fine + fineColumn] = 1;
        }
      }
    }
  }

  const layers = LAYER_HEIGHTS.map(() => new Float32Array(size * size));
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const top = 2 * row * fine + 2 * column;
      const open = 4 - covered[top] - covered[top + 1] - covered[top + fine] - covered[top + fine + 1];
      layers[layerOf[row * size + column]][row * size + column] = open / 4;
    }
  }
  return {
    size,
    leaves,
    clearings,
    layerOf,
    layers: layers.map((mask) => ({ mask, sums: rowSums(mask, size) }))
  };
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

/** How strongly light is exposed: the share of full sun that shows as half brightness is ln 2 over this. */
export const EXPOSURE = 30;

/** Shade, the warm middle, and the hot white of full sun, as the light rises. */
export const PALETTE = {
  shade: [22, 18, 14],
  warm: [168, 96, 34],
  hot: [255, 236, 196]
};

/** The colour of a light level: exposed like film, then read along the palette. */
export function toneOf(light) {
  const exposed = 1 - Math.exp(-EXPOSURE * light);
  const [from, to, along] = exposed < 0.5
    ? [PALETTE.shade, PALETTE.warm, exposed / 0.5]
    : [PALETTE.warm, PALETTE.hot, (exposed - 0.5) / 0.5];
  return from.map((channel, index) => channel + (to[index] - channel) * along);
}
