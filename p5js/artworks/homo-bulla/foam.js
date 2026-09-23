import { mulberry32 } from "../shared/random.js";

/**
 * A dry two-dimensional foam on a torus, coarsening.
 *
 * The foam is a network of films. Every film is a circular arc between two vertices, and
 * every vertex joins exactly three films. All films have one tension, and a film between
 * two bubbles is bent by the difference of their pressures (Laplace). Gas does not
 * compress: each bubble's pressure is whatever holds it to the area its gas fills, found
 * afresh at every step. The vertices move until the three tensions pulling on each of them
 * balance, which puts the three films at a vertex at 120 degrees to one another (Plateau).
 *
 * Gas leaks through every film from the side at higher pressure to the side at lower, in
 * proportion to the difference and to the film's length. That is the only rule of growth
 * and shrinkage there is. Von Neumann's law, that a bubble grows or shrinks at a rate set
 * by its number of sides alone, is written nowhere here; it is what that rule comes to when
 * the films are arcs meeting at 120 degrees, and the tests measure it.
 *
 * When a film shrinks to nothing its two ends swap partners (a T1). When a bubble of three
 * sides, or two, shrinks to nothing it is taken out and its last gas goes to its neighbours
 * (a T2). Those are the only two ways the network changes, and neither makes or unmakes a
 * vertex of any degree but three.
 *
 * The network is a half-edge structure held in typed arrays: every film is two half-edges
 * running opposite ways, each with the bubble on its left. Positions live on the torus; a
 * half-edge runs from its origin to its end the short way round, which is sound while every
 * film is shorter than half the torus.
 */

export const BOX = 680;

export const DEFAULTS = {
  seed: 20260923,
  bubbles: 640,
  lloyd: 2,
  /** How far a vertex moves per unit of unbalanced tension, per step. */
  mobility: 0.3,
  /** Gas moved through unit length of film per unit of pressure difference, per step. */
  permeability: 0.6,
  /** A film shorter than this has its ends swapped. */
  swapLength: 0.9,
  /** The length of the new film a swap makes. */
  swapBirth: 1.6,
  /** A bubble of three sides or fewer smaller than this is taken out. */
  vanishArea: 2.5,
  /** The largest half-angle an arc may turn through, as its sine. */
  arcLimit: 0.8
};

export function wrap(value) {
  const wrapped = value % BOX;
  return wrapped < 0 ? wrapped + BOX : wrapped;
}

export function shortest(delta) {
  if (delta > BOX / 2) return delta - BOX;
  if (delta < -BOX / 2) return delta + BOX;
  return delta;
}

/**
 * The Voronoi diagram of points on the torus, as polygons: each point's cell is a square
 * cut down by the bisector of every nearby point, its nearest images included.
 */
export function periodicVoronoi(points, reach) {
  const cells = [];
  for (let i = 0; i < points.length; i += 1) {
    const px = points[i].x;
    const py = points[i].y;
    let polygon = [
      [px - reach, py - reach], [px + reach, py - reach], [px + reach, py + reach], [px - reach, py + reach]
    ];
    const others = [];
    for (let j = 0; j < points.length; j += 1) {
      if (j === i) continue;
      const dx = shortest(points[j].x - px);
      const dy = shortest(points[j].y - py);
      const squared = dx * dx + dy * dy;
      if (squared < 4 * reach * reach) others.push([squared, px + dx, py + dy]);
    }
    others.sort((first, second) => first[0] - second[0]);
    for (const [squared, qx, qy] of others) {
      let farthest = 0;
      for (const [x, y] of polygon) farthest = Math.max(farthest, (x - px) * (x - px) + (y - py) * (y - py));
      // A bisector further than the polygon's farthest corner cannot cut it, and nor can any after it.
      if (squared > 4 * farthest) break;
      polygon = clip(polygon, px, py, qx, qy);
    }
    for (const [x, y] of polygon) {
      if ((x - px) * (x - px) + (y - py) * (y - py) > reach * reach) {
        throw new Error("the Voronoi reach is too short for this many points");
      }
    }
    cells.push(polygon);
  }
  return cells;
}

/** Keep the part of a convex polygon nearer (px, py) than (qx, qy). */
function clip(polygon, px, py, qx, qy) {
  const nx = qx - px;
  const ny = qy - py;
  const limit = (nx * (px + qx) + ny * (py + qy)) / 2;
  const inside = ([x, y]) => nx * x + ny * y <= limit;
  const out = [];
  for (let k = 0; k < polygon.length; k += 1) {
    const current = polygon[k];
    const next = polygon[(k + 1) % polygon.length];
    const currentIn = inside(current);
    const nextIn = inside(next);
    if (currentIn) out.push(current);
    if (currentIn !== nextIn) {
      const a = nx * current[0] + ny * current[1] - limit;
      const b = nx * next[0] + ny * next[1] - limit;
      const t = a / (a - b);
      out.push([current[0] + t * (next[0] - current[0]), current[1] + t * (next[1] - current[1])]);
    }
  }
  return out;
}

function polygonCentroid(polygon) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < polygon.length; k += 1) {
    const [x0, y0] = polygon[k];
    const [x1, y1] = polygon[(k + 1) % polygon.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  return { x: cx / (3 * area), y: cy / (3 * area) };
}

/** Random points, made a little more even by Lloyd's relaxation so the start is not all slivers. */
export function seedPoints(count, seed, lloyd, reach) {
  const random = mulberry32(seed);
  let points = Array.from({ length: count }, () => ({ x: random() * BOX, y: random() * BOX }));
  for (let round = 0; round < lloyd; round += 1) {
    points = periodicVoronoi(points, reach).map((polygon) => {
      const centre = polygonCentroid(polygon);
      return { x: wrap(centre.x), y: wrap(centre.y) };
    });
  }
  return points;
}

/**
 * The foam as a half-edge structure, from polygons whose shared corners are the same
 * points. Corners are matched on the torus to within a millionth of a pixel.
 */
export function foamFromCells(cells, options = DEFAULTS) {
  const positions = [];
  const lookup = new Map();
  const bucket = 1e-3;
  const across = Math.round(BOX / bucket);
  function vertexAt(x, y) {
    const wx = wrap(x);
    const wy = wrap(y);
    const gx = Math.floor(wx / bucket);
    const gy = Math.floor(wy / bucket);
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const found = lookup.get(((gx + ox + across) % across) * across + ((gy + oy + across) % across));
        if (!found) continue;
        for (const index of found) {
          const dx = shortest(positions[index][0] - wx);
          const dy = shortest(positions[index][1] - wy);
          if (dx * dx + dy * dy < 1e-12) return index;
        }
      }
    }
    const index = positions.length;
    positions.push([wx, wy]);
    const slot = gx * across + gy;
    if (!lookup.has(slot)) lookup.set(slot, []);
    lookup.get(slot).push(index);
    return index;
  }
  const faceLists = cells.map((polygon) => polygon.map(([x, y]) => vertexAt(x, y)));
  const halfCount = faceLists.reduce((sum, list) => sum + list.length, 0);
  const foam = allocate(positions.length, halfCount, faceLists.length, options);
  positions.forEach(([x, y], v) => {
    foam.x[v] = x;
    foam.y[v] = y;
    foam.vertexAlive[v] = 1;
  });
  const byEnds = new Map();
  let h = 0;
  faceLists.forEach((ids, f) => {
    foam.faceAlive[f] = 1;
    foam.faceHalf[f] = h;
    const first = h;
    for (let k = 0; k < ids.length; k += 1) {
      foam.origin[h] = ids[k];
      foam.next[h] = first + (k + 1) % ids.length;
      foam.prev[h] = first + (k - 1 + ids.length) % ids.length;
      foam.face[h] = f;
      foam.halfAlive[h] = 1;
      foam.out[ids[k]] = h;
      byEnds.set(ids[k] * positions.length + ids[(k + 1) % ids.length], h);
      h += 1;
    }
  });
  for (const [ends, index] of byEnds) {
    const from = Math.floor(ends / positions.length);
    const to = ends % positions.length;
    const twin = byEnds.get(to * positions.length + from);
    if (twin === undefined) throw new Error("a film with a bubble on one side only");
    foam.twin[index] = twin;
  }
  foam.topologyChanged = true;
  geometry(foam);
  bulges(foam);
  for (let f = 0; f < foam.faceAlive.length; f += 1) {
    if (foam.faceAlive[f]) foam.gas[f] = foam.area[f];
  }
  return foam;
}

function allocate(vertices, halves, faces, options) {
  return {
    options,
    x: new Float64Array(vertices),
    y: new Float64Array(vertices),
    out: new Int32Array(vertices).fill(-1),
    vertexAlive: new Uint8Array(vertices),
    origin: new Int32Array(halves),
    twin: new Int32Array(halves),
    next: new Int32Array(halves),
    prev: new Int32Array(halves),
    face: new Int32Array(halves),
    halfAlive: new Uint8Array(halves),
    faceHalf: new Int32Array(faces),
    faceAlive: new Uint8Array(faces),
    gas: new Float64Array(faces),
    pressure: new Float64Array(faces),
    area: new Float64Array(faces),
    polygon: new Float64Array(faces),
    // One entry per film: the half-edge with the smaller index of the two.
    films: new Int32Array(0),
    filmCount: 0,
    dx: new Float64Array(halves),
    dy: new Float64Array(halves),
    chord: new Float64Array(halves),
    sine: new Float64Array(halves),
    segment: new Float64Array(halves),
    length: new Float64Array(halves),
    forceX: new Float64Array(vertices),
    forceY: new Float64Array(vertices),
    flux: new Float64Array(faces),
    residual: new Float64Array(faces),
    direction: new Float64Array(faces),
    product: new Float64Array(faces),
    correction: new Float64Array(faces),
    weight: new Float64Array(halves),
    swaps: 0,
    vanished: { 2: 0, 3: 0 },
    topologyChanged: true,
    lastResidual: 0
  };
}

export function createFoam(overrides = {}) {
  const options = { ...DEFAULTS, ...overrides };
  const spacing = BOX / Math.sqrt(options.bubbles);
  const reach = 3.5 * spacing;
  const points = seedPoints(options.bubbles, options.seed, options.lloyd, reach);
  return foamFromCells(periodicVoronoi(points, reach), options);
}

function refreshFilms(foam) {
  if (!foam.topologyChanged) return;
  const list = [];
  for (let h = 0; h < foam.halfAlive.length; h += 1) {
    if (foam.halfAlive[h] && foam.twin[h] > h) list.push(h);
  }
  foam.films = Int32Array.from(list);
  foam.filmCount = list.length;
  foam.topologyChanged = false;
}

/**
 * Chords of every film and the polygon area of every bubble, from where the vertices stand.
 * A bubble's polygon is walked from one of its own corners, so a bubble lying across the
 * torus's seam is measured whole.
 */
export function geometry(foam) {
  refreshFilms(foam);
  const { films, filmCount, origin, twin, face, faceHalf, x, y, dx, dy, chord, polygon } = foam;
  polygon.fill(0);
  for (let k = 0; k < filmCount; k += 1) {
    const h = films[k];
    const t = twin[h];
    const a = origin[h];
    const b = origin[t];
    const ex = shortest(x[b] - x[a]);
    const ey = shortest(y[b] - y[a]);
    const c = Math.sqrt(ex * ex + ey * ey);
    dx[h] = ex;
    dy[h] = ey;
    chord[h] = c;
    dx[t] = -ex;
    dy[t] = -ey;
    chord[t] = c;
    for (const [half, sx, sy, from] of [[h, ex, ey, a], [t, -ex, -ey, b]]) {
      const f = face[half];
      const reference = origin[faceHalf[f]];
      const rx = shortest(x[from] - x[reference]);
      const ry = shortest(y[from] - y[reference]);
      polygon[f] += (rx * sy - sx * ry) / 2;
    }
  }
}

/**
 * asin, from nothing but arithmetic and the square root. Engines are free to round their
 * own asin differently, and a foam is chaotic enough that one last bit becomes a different
 * bubble later on; the square root is rounded correctly everywhere, so this is the same
 * number in every browser and in the tests. The argument is halved three times by
 * asin(s) = 2·asin(s / √(2 + 2√(1 − s²))), after which a short series is exact.
 */
export function arcsine(s) {
  let t = s;
  for (let k = 0; k < 3; k += 1) t = t / Math.sqrt(2 + 2 * Math.sqrt(1 - t * t));
  const t2 = t * t;
  let term = t;
  let sum = t;
  for (let n = 1; n <= 9; n += 1) {
    term *= t2 * (2 * n - 1) * (2 * n - 1) / ((2 * n) * (2 * n + 1));
    sum += term;
  }
  return 8 * sum;
}

const SERIES_BELOW = 0.05;

/** asin(x) − x·√(1 − x²), without the cancellation near nought. */
function segmentCore(s) {
  if (Math.abs(s) < SERIES_BELOW) {
    const s2 = s * s;
    return s * s2 * (2 / 3 + s2 * (1 / 5 + s2 * (3 / 28 + s2 * (5 / 72))));
  }
  return arcsine(s) - s * Math.sqrt(1 - s * s);
}

/** asin(x) / x, the ratio of an arc to its chord, without the division near nought. */
function arcOverChord(s) {
  if (Math.abs(s) < SERIES_BELOW) {
    const s2 = s * s;
    return 1 + s2 * (1 / 6 + s2 * (3 / 40 + s2 * (5 / 112)));
  }
  return arcsine(s) / s;
}

/**
 * The arcs, from the chords and the pressures: the sine of each film's half-angle
 * (positive when it bulges to its half-edge's right, into the bubble at lower pressure),
 * the area that adds to the bubble on the left, and the film's length. Then every bubble's
 * area, its polygon and its bulges together.
 */
export function bulges(foam) {
  const { films, filmCount, twin, face, pressure, chord, sine, segment, length, polygon, area, faceAlive } = foam;
  const limit = foam.options.arcLimit;
  area.set(polygon);
  for (let k = 0; k < filmCount; k += 1) {
    const h = films[k];
    const t = twin[h];
    const c = chord[h];
    let s = (pressure[face[h]] - pressure[face[t]]) * c / 2;
    if (s > limit) s = limit;
    if (s < -limit) s = -limit;
    const bulge = s === 0 ? 0 : c * c / (4 * s * s) * segmentCore(s);
    const l = c * arcOverChord(s);
    sine[h] = s;
    sine[t] = -s;
    segment[h] = bulge;
    segment[t] = -bulge;
    length[h] = l;
    length[t] = l;
    area[face[h]] += bulge;
    area[face[t]] -= bulge;
  }
  for (let f = 0; f < faceAlive.length; f += 1) if (!faceAlive[f]) area[f] = 0;
}

/**
 * The pressures that hold every bubble to the area its gas fills, for the vertices where
 * they stand. The areas answer to the pressures through the bulge of the films, so each
 * correction is solved on the graph of bubbles by conjugate gradients, the response of a
 * film's bulge to the pressure across it being its weight. Only differences of pressure
 * act, so the mean is held at nought.
 */
export function settlePressures(foam, rounds = 1, iterations = 40) {
  const { films, filmCount, twin, face, faceAlive, gas, area, pressure, chord, sine, weight,
    residual, direction, product, correction } = foam;
  const faces = faceAlive.length;
  for (let round = 0; round < rounds; round += 1) {
    bulges(foam);
    let count = 0;
    let mean = 0;
    for (let f = 0; f < faces; f += 1) {
      if (!faceAlive[f]) { residual[f] = 0; continue; }
      residual[f] = gas[f] - area[f];
      mean += residual[f];
      count += 1;
    }
    mean /= count;
    let rr = 0;
    for (let f = 0; f < faces; f += 1) {
      if (!faceAlive[f]) continue;
      residual[f] -= mean;
      rr += residual[f] * residual[f];
    }
    foam.lastResidual = Math.sqrt(rr / count);
    for (let k = 0; k < filmCount; k += 1) {
      const h = films[k];
      const c = chord[h];
      const s = sine[h];
      weight[k] = c * c * c * (1 / 12 + 3 * s * s / 40);
    }
    correction.fill(0);
    direction.set(residual);
    const start = rr;
    for (let iteration = 0; iteration < iterations && rr > 1e-20 * Math.max(1, start) && rr > 1e-24; iteration += 1) {
      product.fill(0);
      for (let k = 0; k < filmCount; k += 1) {
        const h = films[k];
        const f = face[h];
        const g = face[twin[h]];
        const difference = weight[k] * (direction[f] - direction[g]);
        product[f] += difference;
        product[g] -= difference;
      }
      let pAp = 0;
      for (let f = 0; f < faces; f += 1) pAp += direction[f] * product[f];
      if (pAp <= 0) break;
      const alpha = rr / pAp;
      let next = 0;
      for (let f = 0; f < faces; f += 1) {
        correction[f] += alpha * direction[f];
        residual[f] -= alpha * product[f];
        next += residual[f] * residual[f];
      }
      const beta = next / rr;
      rr = next;
      for (let f = 0; f < faces; f += 1) direction[f] = residual[f] + beta * direction[f];
    }
    let shift = 0;
    for (let f = 0; f < faces; f += 1) if (faceAlive[f]) shift += correction[f];
    shift /= count;
    for (let f = 0; f < faces; f += 1) if (faceAlive[f]) pressure[f] += correction[f] - shift;
  }
  bulges(foam);
}

/** One step: pressures to hold the areas, the vertices moved towards balance, gas let through, then whatever changes the network needs. */
export function step(foam) {
  const { options, films, twin, origin, face, x, y, dx, dy, chord, sine, length, pressure,
    forceX, forceY, flux, gas, vertexAlive, faceAlive } = foam;
  geometry(foam);
  settlePressures(foam);
  forceX.fill(0);
  forceY.fill(0);
  flux.fill(0);
  for (let k = 0; k < foam.filmCount; k += 1) {
    const h = foam.films[k];
    const c = chord[h];
    if (c === 0) continue;
    const ux = dx[h] / c;
    const uy = dy[h] / c;
    const s = sine[h];
    const cosine = Math.sqrt(1 - s * s);
    // The tangents leaving each end, tilted towards the right-hand normal (uy, −ux) by the arc.
    const a = origin[h];
    const b = origin[twin[h]];
    forceX[a] += cosine * ux + s * uy;
    forceY[a] += cosine * uy - s * ux;
    forceX[b] += -cosine * ux + s * uy;
    forceY[b] += -cosine * uy - s * ux;
    const left = face[h];
    const right = face[twin[h]];
    const moved = options.permeability * (pressure[left] - pressure[right]) * length[h];
    flux[left] -= moved;
    flux[right] += moved;
  }
  for (let v = 0; v < vertexAlive.length; v += 1) {
    if (!vertexAlive[v]) continue;
    x[v] = wrap(x[v] + options.mobility * forceX[v]);
    y[v] = wrap(y[v] + options.mobility * forceY[v]);
  }
  for (let f = 0; f < faceAlive.length; f += 1) if (faceAlive[f]) gas[f] += flux[f];
  events(foam);
}

/** The half-edges of a bubble, in order round it. */
export function around(foam, f) {
  const start = foam.faceHalf[f];
  const list = [];
  let h = start;
  do {
    list.push(h);
    h = foam.next[h];
    if (list.length > 10000) throw new Error("a bubble whose boundary does not close");
  } while (h !== start);
  return list;
}

/** The half-edges leaving a vertex, in turn. */
export function leaving(foam, v) {
  const start = foam.out[v];
  const list = [];
  let h = start;
  do {
    list.push(h);
    h = foam.next[foam.twin[h]];
    if (list.length > 100) throw new Error("a vertex whose films do not close");
  } while (h !== start);
  return list;
}

export function sidesOf(foam, f) {
  let count = 0;
  const start = foam.faceHalf[f];
  let h = start;
  do {
    count += 1;
    h = foam.next[h];
    if (count > 10000) throw new Error("a bubble whose boundary does not close");
  } while (h !== start);
  return count;
}

function events(foam) {
  const { options, faceAlive, halfAlive, twin } = foam;
  geometry(foam);
  bulges(foam);
  // Bubbles of two and three sides that have all but gone.
  for (let f = 0; f < faceAlive.length; f += 1) {
    if (!faceAlive[f]) continue;
    if (foam.area[f] >= options.vanishArea) continue;
    const sides = sidesOf(foam, f);
    if (sides === 3) vanishTriangle(foam, f);
    else if (sides === 2) vanishLens(foam, f);
  }
  // Films that have all but gone.
  for (let h = 0; h < halfAlive.length; h += 1) {
    if (!halfAlive[h] || twin[h] < h) continue;
    const a = foam.origin[h];
    const b = foam.origin[twin[h]];
    const ex = shortest(foam.x[b] - foam.x[a]);
    const ey = shortest(foam.y[b] - foam.y[a]);
    if (ex * ex + ey * ey < options.swapLength * options.swapLength) swap(foam, h);
  }
}

/**
 * A T1. The film h, from a to b with bubble L on its left and R on its right, is turned a
 * quarter turn: afterwards it separates the two bubbles U and D that met it only at its
 * ends, and L and R no longer touch. L and R lose a side each; U and D gain one each.
 */
export function swap(foam, h) {
  const { twin, next, prev, face, origin, faceHalf, out, x, y } = foam;
  const t = twin[h];
  const L = face[h];
  const R = face[t];
  const p1 = prev[h];
  const n1 = next[h];
  const p2 = prev[t];
  const n2 = next[t];
  const U = face[twin[p1]];
  const D = face[twin[n1]];
  if (L === R || U === D || U === L || U === R || D === L || D === R) return false;
  if (sidesOf(foam, L) <= 3 || sidesOf(foam, R) <= 3) return false;
  const a = origin[h];
  const b = origin[t];
  const ex = shortest(x[b] - x[a]);
  const ey = shortest(y[b] - y[a]);
  const c = Math.sqrt(ex * ex + ey * ey) || 1;
  const mx = x[a] + ex / 2;
  const my = y[a] + ey / 2;
  // Towards L, the left of a→b.
  const lx = -ey / c;
  const ly = ex / c;
  const reach = foam.options.swapBirth / 2;
  // L: p1 now runs straight on to n1, which leaves from a.
  next[p1] = n1;
  prev[n1] = p1;
  origin[n1] = a;
  // R: p2 now runs straight on to n2, which leaves from b.
  next[p2] = n2;
  prev[n2] = p2;
  origin[n2] = b;
  // D takes h, from a (on L's side) to b (on R's side).
  const tn1 = twin[n1];
  const tp2 = twin[p2];
  next[tn1] = h;
  prev[h] = tn1;
  next[h] = tp2;
  prev[tp2] = h;
  face[h] = D;
  // U takes t, from b back to a.
  const tn2 = twin[n2];
  const tp1 = twin[p1];
  next[tn2] = t;
  prev[t] = tn2;
  next[t] = tp1;
  prev[tp1] = t;
  face[t] = U;
  if (faceHalf[L] === h) faceHalf[L] = p1;
  if (faceHalf[R] === t) faceHalf[R] = p2;
  out[a] = h;
  out[b] = t;
  x[a] = wrap(mx + lx * reach);
  y[a] = wrap(my + ly * reach);
  x[b] = wrap(mx - lx * reach);
  y[b] = wrap(my - ly * reach);
  foam.swaps += 1;
  foam.topologyChanged = true;
  return true;
}

/**
 * A T2 of a three-sided bubble: its three vertices become one, at their centroid, joined
 * to the three films that led away from it. Each neighbour loses a side and takes a third
 * of the gas that was left.
 */
export function vanishTriangle(foam, f) {
  const { twin, next, prev, face, origin, faceHalf, out, x, y, gas } = foam;
  const sides = around(foam, f);
  if (sides.length !== 3) return false;
  const outer = sides.map((h) => twin[h]);
  const neighbours = outer.map((a) => face[a]);
  if (new Set(neighbours).size !== 3 || neighbours.includes(f)) return false;
  const corners = sides.map((h) => origin[h]);
  const into = outer.map((a) => prev[a]);
  const away = outer.map((a) => next[a]);
  const d0x = shortest(x[corners[1]] - x[corners[0]]);
  const d0y = shortest(y[corners[1]] - y[corners[0]]);
  const d1x = shortest(x[corners[2]] - x[corners[0]]);
  const d1y = shortest(y[corners[2]] - y[corners[0]]);
  const cx = x[corners[0]] + (d0x + d1x) / 3;
  const cy = y[corners[0]] + (d0y + d1y) / 3;
  for (let k = 0; k < 3; k += 1) {
    next[into[k]] = away[k];
    prev[away[k]] = into[k];
    origin[away[k]] = corners[0];
    if (outer.includes(faceHalf[neighbours[k]])) faceHalf[neighbours[k]] = away[k];
  }
  const share = gas[f] / 3;
  for (const neighbour of neighbours) gas[neighbour] += share;
  x[corners[0]] = wrap(cx);
  y[corners[0]] = wrap(cy);
  out[corners[0]] = away[0];
  foam.vertexAlive[corners[1]] = 0;
  foam.vertexAlive[corners[2]] = 0;
  for (const h of [...sides, ...outer]) foam.halfAlive[h] = 0;
  foam.faceAlive[f] = 0;
  gas[f] = 0;
  foam.pressure[f] = 0;
  foam.vanished[3] += 1;
  foam.topologyChanged = true;
  return true;
}

/**
 * A T2 of a two-sided bubble, a lens between N0 and N1: the lens and its two vertices go,
 * and the two films that led away from its ends become one film between N0 and N1. Each
 * neighbour loses two sides and takes half the gas.
 */
export function vanishLens(foam, f) {
  const { twin, next, prev, face, origin, faceHalf, out, gas } = foam;
  const sides = around(foam, f);
  if (sides.length !== 2) return false;
  const [h0, h1] = sides;
  const a0 = twin[h0];
  const a1 = twin[h1];
  const N0 = face[a0];
  const N1 = face[a1];
  if (N0 === N1 || N0 === f || N1 === f) return false;
  const o0 = next[a0];
  const o1 = next[a1];
  const i0 = twin[o0];
  const i1 = twin[o1];
  const w0 = origin[i0];
  const w1 = origin[i1];
  if (w0 === w1) return false;
  const q0 = prev[i1];
  const r1 = next[o1];
  // o0 now runs from w1 to w0 in N0, and its twin i0 from w0 to w1 in N1.
  origin[o0] = w1;
  next[q0] = o0;
  prev[o0] = q0;
  next[i0] = r1;
  prev[r1] = i0;
  if (out[w1] === i1) out[w1] = o0;
  if (faceHalf[N0] === i1 || faceHalf[N0] === a0) faceHalf[N0] = o0;
  if (faceHalf[N1] === a1 || faceHalf[N1] === o1) faceHalf[N1] = i0;
  const share = gas[f] / 2;
  gas[N0] += share;
  gas[N1] += share;
  foam.vertexAlive[origin[h0]] = 0;
  foam.vertexAlive[origin[h1]] = 0;
  for (const h of [h0, h1, a0, a1, o1, i1]) foam.halfAlive[h] = 0;
  foam.faceAlive[f] = 0;
  gas[f] = 0;
  foam.pressure[f] = 0;
  foam.vanished[2] += 1;
  foam.topologyChanged = true;
  return true;
}

/** The counts the tests hold: vertices, films, bubbles, each vertex's degree and each bubble's sides. */
export function census(foam) {
  let vertices = 0;
  let halves = 0;
  let bubbles = 0;
  let trivalent = 0;
  let sidesTotal = 0;
  const sides = new Map();
  for (let v = 0; v < foam.vertexAlive.length; v += 1) {
    if (!foam.vertexAlive[v]) continue;
    vertices += 1;
    if (leaving(foam, v).length === 3) trivalent += 1;
  }
  for (let h = 0; h < foam.halfAlive.length; h += 1) halves += foam.halfAlive[h];
  for (let f = 0; f < foam.faceAlive.length; f += 1) {
    if (!foam.faceAlive[f]) continue;
    bubbles += 1;
    const n = sidesOf(foam, f);
    sidesTotal += n;
    sides.set(n, (sides.get(n) ?? 0) + 1);
  }
  return { vertices, films: halves / 2, bubbles, trivalent, sidesTotal, sides };
}

/**
 * What a frame needs to be drawn and measured: every film as its origin, its run and the
 * sine of its half-angle, the two bubbles either side, and every bubble's sides in order.
 */
export function snapshot(foam) {
  geometry(foam);
  bulges(foam);
  const { films, filmCount, origin, twin, face, x, y, dx, dy, sine, faceAlive, faceHalf, next, area, gas } = foam;
  const filmData = new Float32Array(filmCount * 5);
  const filmFaces = new Int32Array(filmCount * 2);
  const indexOf = new Map();
  for (let k = 0; k < filmCount; k += 1) {
    const h = films[k];
    const a = origin[h];
    filmData.set([x[a], y[a], dx[h], dy[h], sine[h]], k * 5);
    filmFaces[k * 2] = face[h];
    filmFaces[k * 2 + 1] = face[twin[h]];
    indexOf.set(h, k + 1);
    indexOf.set(twin[h], -(k + 1));
  }
  const bubbles = [];
  const rings = [];
  for (let f = 0; f < faceAlive.length; f += 1) {
    if (!faceAlive[f]) continue;
    const start = faceHalf[f];
    const ring = [];
    let h = start;
    do {
      ring.push(indexOf.get(h));
      h = next[h];
    } while (h !== start);
    bubbles.push(f, ring.length);
    rings.push(...ring);
  }
  let sidesTotal = 0;
  for (let k = 1; k < bubbles.length; k += 2) sidesTotal += bubbles[k];
  // Every vertex with the three directions its films leave it in, for drawing what gathers
  // where films meet. Each direction is the arc's tangent, tilted from the chord by the bulge.
  const { vertexAlive, out, chord } = foam;
  const corners = [];
  for (let v = 0; v < vertexAlive.length; v += 1) {
    if (!vertexAlive[v]) continue;
    corners.push(x[v], y[v]);
    let h = out[v];
    for (let k = 0; k < 3; k += 1) {
      const c = chord[h];
      const ux = dx[h] / c;
      const uy = dy[h] / c;
      const s = sine[h];
      const q = Math.sqrt(1 - s * s);
      corners.push(q * ux + s * uy, q * uy - s * ux);
      h = next[twin[h]];
    }
  }
  return {
    corners: Float32Array.from(corners),
    films: filmData,
    filmFaces,
    bubbles: Int32Array.from(bubbles),
    rings: Int32Array.from(rings),
    count: bubbles.length / 2,
    sidesTotal,
    swaps: foam.swaps,
    vanished: foam.vanished[2] + foam.vanished[3]
  };
}
