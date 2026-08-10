const CHILD_COUNT = 3;
const ANGLE_STEP = Math.PI * 2 / CHILD_COUNT;

function pointAround(center, distance, index) {
  const angle = index * ANGLE_STEP;
  return {
    x: center.x + distance * Math.cos(angle),
    y: center.y + distance * Math.sin(angle)
  };
}

/**
 * Builds the self-similar tree. Halving the radius on every generation guarantees
 * termination at minimumRadius, and placing each child one child-radius away from the
 * parent centre makes the child's outward vertex land exactly on the parent's vertex.
 */
export function buildGasket(center, radius, minimumRadius) {
  const childRadius = radius / 2;
  const children = radius > minimumRadius
    ? Array.from(
      { length: CHILD_COUNT },
      (unused, index) => buildGasket(
        pointAround(center, childRadius, index),
        childRadius,
        minimumRadius
      )
    )
    : [];
  return { center, radius, children };
}

function triangleOf(node) {
  return Array.from(
    { length: CHILD_COUNT },
    (unused, index) => pointAround(node.center, node.radius, index)
  );
}

/**
 * Walks the finished tree iteratively and returns one vertex triple per node, in the
 * pre-order the Processing sketch draws them.
 */
export function flattenTriangles(gasket) {
  const triangles = [];
  const pending = [gasket];
  while (pending.length > 0) {
    const node = pending.pop();
    triangles.push(triangleOf(node));
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]);
    }
  }
  return triangles;
}

export function countTriangles(gasket) {
  return flattenTriangles(gasket).length;
}

/**
 * Axis-aligned bounds of every triangle. The root is anchored on its circumcentre, which
 * sits a quarter radius right of the bounding box centre, so callers need this to place
 * the figure rather than the anchor point.
 */
export function boundingBox(gasket) {
  const vertices = flattenTriangles(gasket).flat();
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  };
}

/** Generation count including the root, so a childless root has depth 1. */
export function gasketDepth(gasket) {
  let depth = 0;
  let node = gasket;
  while (node) {
    depth += 1;
    node = node.children[0];
  }
  return depth;
}
