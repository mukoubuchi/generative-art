export const WIDTH = 900;
export const HEIGHT = 680;
export const CX = WIDTH / 2;
export const CY = HEIGHT / 2;
export const FPS = 30;
export const DURATION = 24;
export const FRAMES = FPS * DURATION;
export const CLEARANCE_RADIUS = 32;
export const OBSTACLE_STEPS = 24;
export const COORD_SCALE = 64;

const TAU = 2 * Math.PI;
const EPS = 1e-9;

/**
 * Four concentric rings of fixed obstacle arcs discretized at 24 segments per arc
 * on an exact 1/64-pixel dyadic rational grid (exact in IEEE-754 binary64).
 * Nothing in the obstacle layout changes over time or is rebuilt for the ending.
 */
const RING_SPECS = [
  { count: 6, rx: 152, ry: 128, span: 0.34, phase: 0.18, tilt: 0.05 },
  { count: 8, rx: 218, ry: 182, span: 0.30, phase: 0.57, tilt: -0.04 },
  { count: 10, rx: 288, ry: 238, span: 0.26, phase: 0.29, tilt: 0.03 },
  { count: 12, rx: 360, ry: 294, span: 0.22, phase: 0.04, tilt: -0.03 }
];

function snapCoord(value) {
  return Math.round(value * COORD_SCALE) / COORD_SCALE;
}

function buildObstacles() {
  const obstacles = [];
  const segments = [];
  let obstacleId = 0;
  let segmentId = 0;
  for (let ring = 0; ring < RING_SPECS.length; ring++) {
    const { count, rx, ry, span, phase, tilt } = RING_SPECS[ring];
    for (let i = 0; i < count; i++) {
      const centerAngle = phase + (TAU * i) / count + 0.06 * Math.sin(i * 1.7 + ring);
      const halfSpan = span * (0.92 + 0.14 * ((i + ring) % 3));
      const steps = OBSTACLE_STEPS;
      const points = [];
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const a = centerAngle - halfSpan + 2 * halfSpan * u;
        const rMod = 1 + tilt * (u - 0.5);
        const x = snapCoord(CX + rx * rMod * Math.cos(a));
        const y = snapCoord(CY + ry * rMod * Math.sin(a));
        points.push([x, y]);
      }
      const barrierSegments = [];
      for (let s = 0; s < steps; s++) {
        const seg = {
          id: segmentId++,
          obstacleId,
          ring,
          indexInObstacle: s,
          a: points[s],
          b: points[s + 1],
          isViewport: false
        };
        segments.push(seg);
        barrierSegments.push(seg);
      }
      obstacles.push({ id: obstacleId++, ring, points, segments: barrierSegments });
    }
  }
  return { obstacles, segments };
}

const BUILT = buildObstacles();
export const OBSTACLES = BUILT.obstacles;
export const OBSTACLE_SEGMENTS = BUILT.segments;

export const VIEWPORT_SEGMENTS = [
  { id: 1000, obstacleId: -1, ring: -1, a: [0, 0], b: [WIDTH, 0], isViewport: true },
  { id: 1001, obstacleId: -1, ring: -1, a: [WIDTH, 0], b: [WIDTH, HEIGHT], isViewport: true },
  { id: 1002, obstacleId: -1, ring: -1, a: [WIDTH, HEIGHT], b: [0, HEIGHT], isViewport: true },
  { id: 1003, obstacleId: -1, ring: -1, a: [0, HEIGHT], b: [0, 0], isViewport: true }
];

export const ALL_SEGMENTS = [...OBSTACLE_SEGMENTS, ...VIEWPORT_SEGMENTS];

/**
 * 34 fixed background field rings outside the central chamber (radii >= 112 px).
 * Each ring is fixed in world space and partitioned by the visibility field at each frame.
 */
export const FIELD_RINGS = Array.from({ length: 34 }, (_, idx) => {
  const t = idx / 33;
  const rx = 132 + t * 292;
  const ry = 112 + t * 238;
  return { index: idx, rx, ry };
});

/**
 * Smooth C^infinity-periodic closed trajectory E(t) in the central chamber.
 * Every term is a 2*pi-periodic harmonic of theta = 2*pi*frame/FRAMES that vanishes at theta = 0,
 * so E(0) = E(FRAMES) = (CX, CY) with matching non-zero velocity across the loop seam.
 */
export function eyeAt(frame) {
  const wrapped = ((frame % FRAMES) + FRAMES) % FRAMES;
  const theta = (TAU * wrapped) / FRAMES;
  const env = 0.5 * (1 - Math.cos(theta));
  const x = CX + 14 * Math.sin(theta) + env * (64 * Math.sin(theta) - 12 * Math.sin(3 * theta));
  const y = CY - 12 * Math.sin(theta) + env * (52 * Math.sin(2 * theta - 0.55) + 10 * Math.cos(theta));
  return [x, y];
}

export function eyeVelocityAt(frame) {
  const wrapped = ((frame % FRAMES) + FRAMES) % FRAMES;
  const theta = (TAU * wrapped) / FRAMES;
  const dTheta = TAU / FRAMES;
  const env = 0.5 * (1 - Math.cos(theta));
  const dEnv = 0.5 * Math.sin(theta);
  const gx = 64 * Math.sin(theta) - 12 * Math.sin(3 * theta);
  const dGx = 64 * Math.cos(theta) - 36 * Math.cos(3 * theta);
  const gy = 52 * Math.sin(2 * theta - 0.55) + 10 * Math.cos(theta);
  const dGy = 104 * Math.cos(2 * theta - 0.55) - 10 * Math.sin(theta);
  const vx = (14 * Math.cos(theta) + dEnv * gx + env * dGx) * dTheta;
  const vy = (-12 * Math.cos(theta) + dEnv * gy + env * dGy) * dTheta;
  return [vx, vy];
}

export const frameAt = (seconds) => Math.floor(Math.max(0, seconds) * FPS) % FRAMES;

function toScaledBigInt(coord) {
  const scaled = coord * COORD_SCALE;
  if (!Number.isInteger(scaled)) {
    throw new Error(`Expected exact 1/${COORD_SCALE} dyadic rational coordinate, got ${coord}`);
  }
  return BigInt(scaled);
}

/**
 * Exact BigInt collinearity and ray-segment intersection helpers on the 1/64-px lattice.
 */
export function exactCross2D([ax, ay], [bx, by], [cx, cy]) {
  const axI = toScaledBigInt(ax), ayI = toScaledBigInt(ay);
  const bxI = toScaledBigInt(bx), byI = toScaledBigInt(by);
  const cxI = toScaledBigInt(cx), cyI = toScaledBigInt(cy);
  return (bxI - axI) * (cyI - ayI) - (byI - ayI) * (cxI - axI);
}

export function exactRayHitRational(eyePt, throughPt, segAPt, segBPt) {
  const [ex, ey] = eyePt.map(toScaledBigInt);
  const [vx, vy] = throughPt.map(toScaledBigInt);
  const [ax, ay] = segAPt.map(toScaledBigInt);
  const [bx, by] = segBPt.map(toScaledBigInt);
  const dx = vx - ex, dy = vy - ey;
  const sx = bx - ax, sy = by - ay;
  const denom = dx * sy - dy * sx;
  if (denom === 0n) return null;
  const rx = ax - ex, ry = ay - ey;
  const tNum = rx * sy - ry * sx;
  const uNum = rx * dy - ry * dx;
  if (denom > 0n) {
    if (tNum <= 0n || uNum < 0n || uNum > denom) return null;
    return [ex * denom + tNum * dx, ey * denom + tNum * dy, denom];
  }
  if (tNum >= 0n || uNum > 0n || uNum < denom) return null;
  return [ex * (-denom) + (-tNum) * dx, ey * (-denom) + (-tNum) * dy, -denom];
}

export function exactCollinearWithRay(eyePt, throughPt, homogeneousHit) {
  const [ex, ey] = eyePt.map(toScaledBigInt);
  const [vx, vy] = throughPt.map(toScaledBigInt);
  const [qx, qy, qw] = homogeneousHit;
  return (vx - ex) * (qy - qw * ey) - (vy - ey) * (qx - qw * ex);
}

/**
 * Ray-segment intersection along direction (dx, dy) from eye.
 * Returns { dist, u, point } or null if no hit in front of the ray.
 */
export function intersectRaySegment(eye, dx, dy, seg) {
  const [ax, ay] = seg.a;
  const [bx, by] = seg.b;
  const sx = bx - ax;
  const sy = by - ay;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const rx = ax - eye[0];
  const ry = ay - eye[1];
  const dist = (rx * sy - ry * sx) / denom;
  const u = (rx * dy - ry * dx) / denom;
  if (dist <= 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  const uClamped = Math.max(0, Math.min(1, u));
  return {
    dist,
    u: uClamped,
    point: [ax + uClamped * sx, ay + uClamped * sy]
  };
}

/**
 * Strictly interior segment-segment intersection test (excluding shared endpoints).
 */
export function segmentIntersectsObstacle(p1, p2, ignoreSegIds = new Set()) {
  const minX = Math.min(p1[0], p2[0]) - 1e-6;
  const maxX = Math.max(p1[0], p2[0]) + 1e-6;
  const minY = Math.min(p1[1], p2[1]) - 1e-6;
  const maxY = Math.max(p1[1], p2[1]) + 1e-6;
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  for (const seg of OBSTACLE_SEGMENTS) {
    if (ignoreSegIds.has(seg.id)) continue;
    const [ax, ay] = seg.a;
    const [bx, by] = seg.b;
    if ((ax < minX && bx < minX) || (ax > maxX && bx > maxX)) continue;
    if ((ay < minY && by < minY) || (ay > maxY && by > maxY)) continue;
    const sx = bx - ax;
    const sy = by - ay;
    const denom = dx * sy - dy * sx;
    if (Math.abs(denom) < 1e-11) continue;
    const rx = ax - p1[0];
    const ry = ay - p1[1];
    const t = (rx * sy - ry * sx) / denom;
    const u = (rx * dy - ry * dx) / denom;
    if (t > 1e-7 && t < 1 - 1e-7 && u > -1e-7 && u < 1 + 1e-7) {
      return true;
    }
  }
  return false;
}

/**
 * Exact angular-sweep visibility decomposition from eye.
 * Evaluates the winning segment at the midpoint of each critical-angle sector
 * and intersects that winning segment with the sector's exact boundary rays.
 */
export function visibilityAt(eye) {
  const rawAngles = [-Math.PI, Math.PI];
  for (const obs of OBSTACLES) {
    for (const pt of obs.points) {
      rawAngles.push(Math.atan2(pt[1] - eye[1], pt[0] - eye[0]));
    }
  }
  for (const seg of VIEWPORT_SEGMENTS) {
    rawAngles.push(Math.atan2(seg.a[1] - eye[1], seg.a[0] - eye[0]));
  }
  rawAngles.sort((a, b) => a - b);
  const angles = [];
  for (const a of rawAngles) {
    if (!angles.length || a - angles[angles.length - 1] > 1e-9) {
      angles.push(a);
    }
  }

  // Precompute each segment's exact angular span around eye to prune non-overlapping segments.
  // For a segment crossing the ±π branch cut (wraps === true), the subtended angles are
  // [-π, lo] ∪ [hi, π] and the excluded gap is (lo, hi), so conservative padding shrinks (lo, hi).
  const pad = 1e-6;
  const segBounds = ALL_SEGMENTS.map((seg) => {
    const a0 = Math.atan2(seg.a[1] - eye[1], seg.a[0] - eye[0]);
    const a1 = Math.atan2(seg.b[1] - eye[1], seg.b[0] - eye[0]);
    const lo = Math.min(a0, a1);
    const hi = Math.max(a0, a1);
    const wraps = hi - lo > Math.PI;
    return {
      seg,
      lo: wraps ? lo + pad : lo - pad,
      hi: wraps ? hi - pad : hi + pad,
      wraps
    };
  });

  const sectors = [];
  for (let i = 0; i < angles.length - 1; i++) {
    const a0 = angles[i];
    const a1 = angles[i + 1];
    if (a1 - a0 <= 1e-9) continue;
    const mid = 0.5 * (a0 + a1);
    const mdx = Math.cos(mid);
    const mdy = Math.sin(mid);
    let bestSeg = null;
    let bestDist = Infinity;
    for (let s = 0; s < segBounds.length; s++) {
      const b = segBounds[s];
      if (b.wraps ? (mid > b.lo && mid < b.hi) : (mid < b.lo || mid > b.hi)) continue;
      const hit = intersectRaySegment(eye, mdx, mdy, b.seg);
      if (hit && hit.dist < bestDist) {
        bestDist = hit.dist;
        bestSeg = b.seg;
      }
    }
    if (!bestSeg) continue;
    const hit0 = intersectRaySegment(eye, Math.cos(a0), Math.sin(a0), bestSeg);
    const hit1 = intersectRaySegment(eye, Math.cos(a1), Math.sin(a1), bestSeg);
    if (!hit0 || !hit1) continue;
    sectors.push({
      a0,
      a1,
      segment: bestSeg,
      p0: hit0.point,
      p1: hit1.point,
      d0: hit0.dist,
      d1: hit1.dist,
      u0: hit0.u,
      u1: hit1.u
    });
  }

  // Extract true occlusion boundary segments (radial jumps at critical angles).
  const occlusionBoundaries = [];
  for (let i = 0; i < sectors.length; i++) {
    const prev = sectors[(i - 1 + sectors.length) % sectors.length];
    const curr = sectors[i];
    if (prev.segment.id === curr.segment.id) continue;
    if (prev.segment.obstacleId >= 0 && prev.segment.obstacleId === curr.segment.obstacleId) continue;
    const jump = Math.abs(prev.d1 - curr.d0);
    if (jump <= 1.5) continue;
    const prevIsNear = prev.d1 < curr.d0;
    const nearSeg = prevIsNear ? prev.segment : curr.segment;
    const farSeg = prevIsNear ? curr.segment : prev.segment;
    const nearPt = prevIsNear ? prev.p1 : curr.p0;
    const farPt = prevIsNear ? curr.p0 : prev.p1;
    const nearDist = prevIsNear ? prev.d1 : curr.d0;
    const farDist = prevIsNear ? curr.d0 : prev.d1;
    occlusionBoundaries.push({
      angle: curr.a0,
      nearPoint: nearPt,
      farPoint: farPt,
      nearDist,
      farDist,
      nearSegmentId: nearSeg.id,
      farSegmentId: farSeg.id,
      nearRing: nearSeg.ring,
      farIsViewport: farSeg.isViewport
    });
  }

  // Partition each obstacle segment into exact visible (lit) and occluded sub-intervals.
  const bySeg = new Map();
  for (const sec of sectors) {
    if (sec.segment.isViewport) continue;
    const uMin = Math.min(sec.u0, sec.u1);
    const uMax = Math.max(sec.u0, sec.u1);
    if (uMax - uMin <= 1e-7) continue;
    let list = bySeg.get(sec.segment.id);
    if (!list) {
      list = [];
      bySeg.set(sec.segment.id, list);
    }
    list.push([uMin, uMax]);
  }

  const litSegments = [];
  const occludedSegments = [];
  for (const seg of OBSTACLE_SEGMENTS) {
    const raw = (bySeg.get(seg.id) ?? []).sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [u0, u1] of raw) {
      if (!merged.length || u0 > merged[merged.length - 1][1] + 1e-6) {
        merged.push([u0, u1]);
      } else {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], u1);
      }
    }
    const pointAtU = (u) => [
      seg.a[0] + u * (seg.b[0] - seg.a[0]),
      seg.a[1] + u * (seg.b[1] - seg.a[1])
    ];
    let cursor = 0;
    for (let idx = 0; idx < merged.length; idx++) {
      const [u0, u1] = merged[idx];
      const startU = u0 - cursor > 1e-5 ? u0 : cursor;
      const endU = idx === merged.length - 1 && 1 - u1 <= 1e-5 ? 1 : u1;
      if (startU > cursor) {
        occludedSegments.push({
          segmentId: seg.id,
          obstacleId: seg.obstacleId,
          ring: seg.ring,
          u0: cursor,
          u1: startU,
          a: pointAtU(cursor),
          b: pointAtU(startU)
        });
      }
      litSegments.push({
        segmentId: seg.id,
        obstacleId: seg.obstacleId,
        ring: seg.ring,
        u0: startU,
        u1: endU,
        a: pointAtU(startU),
        b: pointAtU(endU)
      });
      cursor = endU;
    }
    if (cursor < 1) {
      occludedSegments.push({
        segmentId: seg.id,
        obstacleId: seg.obstacleId,
        ring: seg.ring,
        u0: cursor,
        u1: 1,
        a: pointAtU(cursor),
        b: pointAtU(1)
      });
    }
  }

  return { eye, sectors, occlusionBoundaries, litSegments, occludedSegments };
}

/**
 * Fast visibility query for any world point [x, y] using the sorted angular sectors.
 */
export function isPointVisible(point, visibility) {
  const { eye, sectors } = visibility;
  const dx = point[0] - eye[0];
  const dy = point[1] - eye[1];
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-9) return true;
  const angle = Math.atan2(dy, dx);
  let lo = 0;
  let hi = sectors.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sectors[mid].a1 < angle) lo = mid + 1;
    else hi = mid;
  }
  const sec = sectors[lo];
  const hit = intersectRaySegment(eye, dx / dist, dy / dist, sec.segment);
  if (!hit) return false;
  return dist <= hit.dist + 1e-5;
}

/**
 * Partition the fixed background field rings into lit and shadowed polyline arcs
 * by angular sampling along each ellipse and 10-step bisection at visibility transitions.
 */
export function partitionFieldRings(visibility, sampleCount = 360) {
  const { eye, sectors } = visibility;
  const litArcs = [];
  const shadowArcs = [];

  function visibleAtPoint(pt) {
    const dx = pt[0] - eye[0];
    const dy = pt[1] - eye[1];
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    let lo = 0;
    let hi = sectors.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sectors[mid].a1 < angle) lo = mid + 1;
      else hi = mid;
    }
    const sec = sectors[lo];
    const hit = intersectRaySegment(eye, dx / dist, dy / dist, sec.segment);
    return hit ? dist <= hit.dist - 1e-4 : false;
  }

  for (const ring of FIELD_RINGS) {
    const ptOnRing = (u) => [
      CX + ring.rx * Math.cos(u),
      CY + ring.ry * Math.sin(u)
    ];
    let currentPts = [];
    let currentVisible = null;
    for (let i = 0; i <= sampleCount; i++) {
      const u = (TAU * i) / sampleCount;
      const pt = ptOnRing(u);
      const vis = visibleAtPoint(pt);
      if (currentVisible === null) {
        currentVisible = vis;
        currentPts.push(pt);
      } else if (vis === currentVisible) {
        currentPts.push(pt);
      } else {
        let uLo = (TAU * (i - 1)) / sampleCount;
        let uHi = u;
        for (let iter = 0; iter < 10; iter++) {
          const uMid = 0.5 * (uLo + uHi);
          if (visibleAtPoint(ptOnRing(uMid)) === currentVisible) uLo = uMid;
          else uHi = uMid;
        }
        const boundaryPt = ptOnRing(0.5 * (uLo + uHi));
        currentPts.push(boundaryPt);
        if (currentPts.length >= 2) {
          (currentVisible ? litArcs : shadowArcs).push({
            ringIndex: ring.index,
            points: currentPts
          });
        }
        currentVisible = vis;
        currentPts = [boundaryPt, pt];
      }
    }
    if (currentPts.length >= 2) {
      (currentVisible ? litArcs : shadowArcs).push({
        ringIndex: ring.index,
        points: currentPts
      });
    }
  }
  return { litArcs, shadowArcs };
}

/**
 * Reconstruct the unmarked viewpoint from drawn occlusion boundary segments alone
 * via the 2x2 normal system sum(n_j n_j^T) E = sum((n_j . V_j) n_j).
 */
export function reconstructEyeFromBoundaries(boundaries) {
  let a00 = 0;
  let a01 = 0;
  let a11 = 0;
  let b0 = 0;
  let b1 = 0;
  let count = 0;

  for (const b of boundaries) {
    const dx = b.farPoint[0] - b.nearPoint[0];
    const dy = b.farPoint[1] - b.nearPoint[1];
    const len = Math.hypot(dx, dy);
    if (len <= EPS) continue;
    const nx = -dy / len;
    const ny = dx / len;
    const rhs = nx * b.nearPoint[0] + ny * b.nearPoint[1];
    a00 += nx * nx;
    a01 += nx * ny;
    a11 += ny * ny;
    b0 += rhs * nx;
    b1 += rhs * ny;
    count++;
  }

  const trace = a00 + a11;
  const det = a00 * a11 - a01 * a01;
  const disc = Math.sqrt(Math.max(0, 0.25 * trace * trace - det));
  const minEigenvalue = 0.5 * trace - disc;
  const maxEigenvalue = 0.5 * trace + disc;

  if (count < 2 || minEigenvalue <= 1e-7 || Math.abs(det) <= 1e-12) {
    return {
      ok: false,
      count,
      minEigenvalue,
      maxEigenvalue,
      point: null,
      maxLineResidual: Infinity
    };
  }

  const ex = (a11 * b0 - a01 * b1) / det;
  const ey = (a00 * b1 - a01 * b0) / det;

  let maxLineResidual = 0;
  for (const b of boundaries) {
    const dx = b.farPoint[0] - b.nearPoint[0];
    const dy = b.farPoint[1] - b.nearPoint[1];
    const len = Math.hypot(dx, dy);
    if (len <= EPS) continue;
    const dist = Math.abs((ex - b.nearPoint[0]) * dy - (ey - b.nearPoint[1]) * dx) / len;
    if (dist > maxLineResidual) maxLineResidual = dist;
  }

  return {
    ok: true,
    count,
    minEigenvalue,
    maxEigenvalue,
    point: [ex, ey],
    maxLineResidual
  };
}

export function stateAt(frame, precomputedVisibility = null) {
  const wrapped = ((frame % FRAMES) + FRAMES) % FRAMES;
  const time = wrapped / FPS;
  const eye = precomputedVisibility ? precomputedVisibility.eye : eyeAt(wrapped);
  const visibility = precomputedVisibility ?? visibilityAt(eye);
  const recovered = reconstructEyeFromBoundaries(visibility.occlusionBoundaries);
  const reconstructionError = recovered.point
    ? Math.hypot(recovered.point[0] - eye[0], recovered.point[1] - eye[1])
    : Infinity;
  return {
    frame: wrapped,
    time,
    eye,
    boundaryCount: visibility.occlusionBoundaries.length,
    litSegmentCount: visibility.litSegments.length,
    occludedSegmentCount: visibility.occludedSegments.length,
    minEigenvalue: recovered.minEigenvalue,
    reconstructionError
  };
}
