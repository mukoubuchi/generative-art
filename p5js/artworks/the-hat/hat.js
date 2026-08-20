/*
 * Hat outline and H/T/P/F substitution geometry adapted from hatviz:
 * https://github.com/isohedral/hatviz
 *
 * Copyright (c) 2023, Craig S. Kaplan.
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Rewritten as a deterministic, dependency-free module on 2026-08-20.
 * The complete license and attribution are in THIRD_PARTY_LICENSES.
 */

export const SQRT_THREE = Math.sqrt(3);
export const HALF_SQRT_THREE = SQRT_THREE / 2;
export const IDENTITY = [1, 0, 0, 0, 1, 0];

function point(x, y) {
  return { x, y };
}

function hexPoint(x, y) {
  return point(x + y / 2, HALF_SQRT_THREE * y);
}

export const HAT_OUTLINE = [
  hexPoint(0, 0),
  hexPoint(-1, -1),
  hexPoint(0, -2),
  hexPoint(2, -2),
  hexPoint(2, -1),
  hexPoint(4, -2),
  hexPoint(5, -1),
  hexPoint(4, 0),
  hexPoint(3, 0),
  hexPoint(2, 2),
  hexPoint(0, 3),
  hexPoint(0, 2),
  hexPoint(-1, 2)
];

export function multiply(first, second) {
  return [
    first[0] * second[0] + first[1] * second[3],
    first[0] * second[1] + first[1] * second[4],
    first[0] * second[2] + first[1] * second[5] + first[2],
    first[3] * second[0] + first[4] * second[3],
    first[3] * second[1] + first[4] * second[4],
    first[3] * second[2] + first[4] * second[5] + first[5]
  ];
}

export function transformPoint(matrix, source) {
  return point(
    matrix[0] * source.x + matrix[1] * source.y + matrix[2],
    matrix[3] * source.x + matrix[4] * source.y + matrix[5]
  );
}

export function determinant(matrix) {
  return matrix[0] * matrix[4] - matrix[1] * matrix[3];
}

function inverse(matrix) {
  const det = determinant(matrix);
  return [
    matrix[4] / det,
    -matrix[1] / det,
    (matrix[1] * matrix[5] - matrix[2] * matrix[4]) / det,
    -matrix[3] / det,
    matrix[0] / det,
    (matrix[2] * matrix[3] - matrix[0] * matrix[5]) / det
  ];
}

function translation(x, y) {
  return [1, 0, x, 0, 1, y];
}

function rotation(angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [cosine, -sine, 0, sine, cosine, 0];
}

function rotationAbout(centre, angle) {
  return multiply(
    translation(centre.x, centre.y),
    multiply(rotation(angle), translation(-centre.x, -centre.y))
  );
}

function matchSegment(from, to) {
  return [to.x - from.x, from.y - to.y, from.x,
    to.y - from.y, to.x - from.x, from.y];
}

function matchTwo(fromStart, fromEnd, toStart, toEnd) {
  return multiply(matchSegment(toStart, toEnd), inverse(matchSegment(fromStart, fromEnd)));
}

function add(first, second) {
  return point(first.x + second.x, first.y + second.y);
}

function subtract(first, second) {
  return point(first.x - second.x, first.y - second.y);
}

function lineIntersection(firstStart, firstEnd, secondStart, secondEnd) {
  const denominator = (secondEnd.y - secondStart.y) * (firstEnd.x - firstStart.x)
    - (secondEnd.x - secondStart.x) * (firstEnd.y - firstStart.y);
  const alongFirst = (
    (secondEnd.x - secondStart.x) * (firstStart.y - secondStart.y)
    - (secondEnd.y - secondStart.y) * (firstStart.x - secondStart.x)
  ) / denominator;
  return point(
    firstStart.x + alongFirst * (firstEnd.x - firstStart.x),
    firstStart.y + alongFirst * (firstEnd.y - firstStart.y)
  );
}

function hat(label) {
  return { type: "hat", label, shape: HAT_OUTLINE };
}

function metatile(shape, width = 2) {
  return { type: "metatile", shape, width, children: [] };
}

function addChild(parent, matrix, geometry) {
  parent.children.push({ matrix, geometry });
}

function evaluateChild(parent, childIndex, pointIndex) {
  const child = parent.children[childIndex];
  return transformPoint(child.matrix, child.geometry.shape[pointIndex]);
}

function recenter(parent) {
  const centre = parent.shape.reduce((sum, vertex) => add(sum, vertex), point(0, 0));
  centre.x /= parent.shape.length;
  centre.y /= parent.shape.length;
  const move = translation(-centre.x, -centre.y);
  parent.shape = parent.shape.map((vertex) => subtract(vertex, centre));
  parent.children = parent.children.map((child) => ({
    ...child,
    matrix: multiply(move, child.matrix)
  }));
  return parent;
}

function initialMetatiles() {
  const base = {
    H1: hat("H1"),
    H: hat("H"),
    T: hat("T"),
    P: hat("P"),
    F: hat("F")
  };

  const HOutline = [
    point(0, 0), point(4, 0), point(4.5, HALF_SQRT_THREE),
    point(2.5, 5 * HALF_SQRT_THREE), point(1.5, 5 * HALF_SQRT_THREE),
    point(-0.5, HALF_SQRT_THREE)
  ];
  const H = metatile(HOutline);
  addChild(H, matchTwo(HAT_OUTLINE[5], HAT_OUTLINE[7], HOutline[5], HOutline[0]), base.H);
  addChild(H, matchTwo(HAT_OUTLINE[9], HAT_OUTLINE[11], HOutline[1], HOutline[2]), base.H);
  addChild(H, matchTwo(HAT_OUTLINE[5], HAT_OUTLINE[7], HOutline[3], HOutline[4]), base.H);
  addChild(H, multiply(
    translation(2.5, HALF_SQRT_THREE),
    multiply(
      [-0.5, -HALF_SQRT_THREE, 0, HALF_SQRT_THREE, -0.5, 0],
      [0.5, 0, 0, 0, -0.5, 0]
    )
  ), base.H1);

  const TOutline = [point(0, 0), point(3, 0), point(1.5, 3 * HALF_SQRT_THREE)];
  const T = metatile(TOutline);
  addChild(T, [0.5, 0, 0.5, 0, 0.5, HALF_SQRT_THREE], base.T);

  const POutline = [
    point(0, 0), point(4, 0), point(3, 2 * HALF_SQRT_THREE),
    point(-1, 2 * HALF_SQRT_THREE)
  ];
  const P = metatile(POutline);
  addChild(P, [0.5, 0, 1.5, 0, 0.5, HALF_SQRT_THREE], base.P);
  addChild(P, multiply(
    translation(0, 2 * HALF_SQRT_THREE),
    multiply(
      [0.5, HALF_SQRT_THREE, 0, -HALF_SQRT_THREE, 0.5, 0],
      [0.5, 0, 0, 0, 0.5, 0]
    )
  ), base.P);

  const FOutline = [
    point(0, 0), point(3, 0), point(3.5, HALF_SQRT_THREE),
    point(3, 2 * HALF_SQRT_THREE), point(-1, 2 * HALF_SQRT_THREE)
  ];
  const F = metatile(FOutline);
  addChild(F, [0.5, 0, 1.5, 0, 0.5, HALF_SQRT_THREE], base.F);
  addChild(F, multiply(
    translation(0, 2 * HALF_SQRT_THREE),
    multiply(
      [0.5, HALF_SQRT_THREE, 0, -HALF_SQRT_THREE, 0.5, 0],
      [0.5, 0, 0, 0, 0.5, 0]
    )
  ), base.F);

  return { H, T, P, F };
}

const PATCH_RULES = [
  ["H"],
  [0, 0, "P", 2],
  [1, 0, "H", 2],
  [2, 0, "P", 2],
  [3, 0, "H", 2],
  [4, 4, "P", 2],
  [0, 4, "F", 3],
  [2, 4, "F", 3],
  [4, 1, 3, 2, "F", 0],
  [8, 3, "H", 0],
  [9, 2, "P", 0],
  [10, 2, "H", 0],
  [11, 4, "P", 2],
  [12, 0, "H", 2],
  [13, 0, "F", 3],
  [14, 2, "F", 1],
  [15, 3, "H", 4],
  [8, 2, "F", 1],
  [17, 3, "H", 0],
  [18, 2, "P", 0],
  [19, 2, "H", 2],
  [20, 4, "F", 3],
  [20, 0, "P", 2],
  [22, 0, "H", 2],
  [23, 4, "F", 3],
  [23, 0, "F", 3],
  [16, 0, "P", 2],
  [9, 4, 0, 2, "T", 2],
  [4, 0, "F", 3]
];

function constructPatch(tiles) {
  const patch = metatile([], tiles.H.width);
  for (const rule of PATCH_RULES) {
    if (rule.length === 1) {
      addChild(patch, IDENTITY, tiles[rule[0]]);
      continue;
    }
    if (rule.length === 4) {
      const [parentIndex, parentEdge, name, childEdge] = rule;
      const parent = patch.children[parentIndex];
      const parentShape = parent.geometry.shape;
      const start = transformPoint(
        parent.matrix,
        parentShape[(parentEdge + 1) % parentShape.length]
      );
      const end = transformPoint(parent.matrix, parentShape[parentEdge]);
      const child = tiles[name];
      addChild(
        patch,
        matchTwo(
          child.shape[childEdge],
          child.shape[(childEdge + 1) % child.shape.length],
          start,
          end
        ),
        child
      );
      continue;
    }

    const [firstIndex, firstPoint, secondIndex, secondPoint, name, childEdge] = rule;
    const first = patch.children[firstIndex];
    const second = patch.children[secondIndex];
    const start = transformPoint(second.matrix, second.geometry.shape[secondPoint]);
    const end = transformPoint(first.matrix, first.geometry.shape[firstPoint]);
    const child = tiles[name];
    addChild(
      patch,
      matchTwo(
        child.shape[childEdge],
        child.shape[(childEdge + 1) % child.shape.length],
        start,
        end
      ),
      child
    );
  }
  return patch;
}

function nextMetatiles(patch) {
  const bps1 = evaluateChild(patch, 8, 2);
  const bps2 = evaluateChild(patch, 21, 2);
  const rotatedBps = transformPoint(rotationAbout(bps1, -2 * Math.PI / 3), bps2);
  const p72 = evaluateChild(patch, 7, 2);
  const p252 = evaluateChild(patch, 25, 2);
  const lowerLeft = lineIntersection(
    bps1,
    rotatedBps,
    evaluateChild(patch, 6, 2),
    p72
  );

  let vector = subtract(evaluateChild(patch, 6, 2), lowerLeft);
  const HOutline = [lowerLeft, bps1];
  vector = transformPoint(rotation(-Math.PI / 3), vector);
  HOutline.push(add(HOutline[1], vector));
  HOutline.push(evaluateChild(patch, 14, 2));
  vector = transformPoint(rotation(-Math.PI / 3), vector);
  HOutline.push(subtract(HOutline[3], vector));
  HOutline.push(evaluateChild(patch, 6, 2));
  const H = metatile(HOutline, patch.width * 2);
  for (const childIndex of [0, 9, 16, 27, 26, 6, 1, 8, 10, 15]) {
    addChild(H, patch.children[childIndex].matrix, patch.children[childIndex].geometry);
  }

  const POutline = [p72, add(p72, subtract(bps1, lowerLeft)), bps1, lowerLeft];
  const P = metatile(POutline, patch.width * 2);
  for (const childIndex of [7, 2, 3, 4, 28]) {
    addChild(P, patch.children[childIndex].matrix, patch.children[childIndex].geometry);
  }

  const FOutline = [
    bps2,
    evaluateChild(patch, 24, 2),
    evaluateChild(patch, 25, 0),
    p252,
    add(p252, subtract(lowerLeft, bps1))
  ];
  const F = metatile(FOutline, patch.width * 2);
  for (const childIndex of [21, 20, 22, 23, 24, 25]) {
    addChild(F, patch.children[childIndex].matrix, patch.children[childIndex].geometry);
  }

  const aaa = HOutline[2];
  const bbb = add(HOutline[1], subtract(HOutline[4], HOutline[5]));
  const ccc = transformPoint(rotationAbout(bbb, -Math.PI / 3), aaa);
  const T = metatile([bbb, ccc, aaa], patch.width * 2);
  addChild(T, patch.children[11].matrix, patch.children[11].geometry);

  return {
    H: recenter(H),
    T: recenter(T),
    P: recenter(P),
    F: recenter(F)
  };
}

function collectHats(geometry, parentMatrix, result) {
  if (geometry.type === "hat") {
    result.push({
      label: geometry.label,
      matrix: parentMatrix,
      reflected: determinant(parentMatrix) < 0
    });
    return;
  }
  for (const child of geometry.children) {
    collectHats(child.geometry, multiply(parentMatrix, child.matrix), result);
  }
}

export function createHatPatch(rounds = 2) {
  if (!Number.isInteger(rounds) || rounds < 0) {
    throw new Error("The substitution round count must be a non-negative integer");
  }
  let tiles = initialMetatiles();
  for (let round = 0; round < rounds; round += 1) {
    tiles = nextMetatiles(constructPatch(tiles));
  }
  const result = [];
  collectHats(tiles.H, IDENTITY, result);
  return result;
}

export function transformedOutline(tile) {
  return HAT_OUTLINE.map((vertex) => transformPoint(tile.matrix, vertex));
}

export function polygonArea(vertices) {
  let doubled = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    doubled += current.x * next.y - current.y * next.x;
  }
  return doubled / 2;
}

export function boundsOf(tiles) {
  const points = tiles.flatMap(transformedOutline);
  return {
    minX: Math.min(...points.map((vertex) => vertex.x)),
    maxX: Math.max(...points.map((vertex) => vertex.x)),
    minY: Math.min(...points.map((vertex) => vertex.y)),
    maxY: Math.max(...points.map((vertex) => vertex.y))
  };
}
