const PENTAGRAM_VERTEX_COUNT = 5;
const PHI = (1 + Math.sqrt(5)) / 2;
const PENTAGRAM_POINT_ANGLE = Math.PI / PENTAGRAM_VERTEX_COUNT;
const HALF_POINT_ANGLE = PENTAGRAM_POINT_ANGLE / 2;
const STAR_EDGE_TURN_ANGLE = Math.PI * 2 * 3 / PENTAGRAM_VERTEX_COUNT;
const PENTAGON_INTERIOR_ANGLE = Math.PI * 3 / PENTAGRAM_VERTEX_COUNT;

function pointFrom(start, distance, angle) {
  return {
    x: start.x + distance * Math.cos(angle),
    y: start.y + distance * Math.sin(angle)
  };
}

function rotateAround(point, center, angle) {
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;
  return {
    x: center.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    y: center.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle)
  };
}

function buildSequentialStarSteps(edgeStart, edgeLength, edgeAngle, remainingEdges) {
  if (remainingEdges === 0) {
    return [];
  }

  const edgeEnd = pointFrom(edgeStart, edgeLength, edgeAngle);
  return [
    [{ start: edgeStart, end: edgeEnd }],
    ...buildSequentialStarSteps(
      edgeEnd,
      edgeLength,
      edgeAngle + STAR_EDGE_TURN_ANGLE,
      remainingEdges - 1
    )
  ];
}

function buildInwardSteps(starStart, edgeLength, edgeAngle, minimumEdgeLength) {
  if (edgeLength < minimumEdgeLength) {
    return [];
  }

  const currentSteps = buildSequentialStarSteps(
    starStart,
    edgeLength,
    edgeAngle,
    PENTAGRAM_VERTEX_COUNT
  );
  const nextEdgeLength = edgeLength / (PHI * PHI);
  const nextStart = pointFrom(starStart, nextEdgeLength, edgeAngle);
  return [
    ...currentSteps,
    ...buildInwardSteps(
      nextStart,
      nextEdgeLength,
      edgeAngle - PENTAGRAM_POINT_ANGLE,
      minimumEdgeLength
    )
  ];
}

function buildRotatedSegments(center, baseStart, edgeLength, baseAngle, branchIndex) {
  if (branchIndex === PENTAGRAM_VERTEX_COUNT) {
    return [];
  }

  const branchRotation = branchIndex * Math.PI * 2 / PENTAGRAM_VERTEX_COUNT;
  const segmentStart = rotateAround(baseStart, center, branchRotation);
  const segmentEnd = pointFrom(segmentStart, edgeLength, baseAngle + branchRotation);
  return [
    { start: segmentStart, end: segmentEnd },
    ...buildRotatedSegments(
      center,
      baseStart,
      edgeLength,
      baseAngle,
      branchIndex + 1
    )
  ];
}

function buildSynchronizedStarSteps(
  center,
  edgeStart,
  edgeLength,
  edgeAngle,
  remainingEdges
) {
  if (remainingEdges === 0) {
    return [];
  }

  const currentStep = buildRotatedSegments(
    center,
    edgeStart,
    edgeLength,
    edgeAngle,
    0
  );
  const edgeEnd = pointFrom(edgeStart, edgeLength, edgeAngle);
  return [
    currentStep,
    ...buildSynchronizedStarSteps(
      center,
      edgeEnd,
      edgeLength,
      edgeAngle + STAR_EDGE_TURN_ANGLE,
      remainingEdges - 1
    )
  ];
}

function buildOutwardSteps(
  center,
  branchStart,
  edgeLength,
  edgeAngle,
  branchAdvanceAngle,
  minimumEdgeLength
) {
  if (edgeLength < minimumEdgeLength) {
    return [];
  }

  const currentSteps = buildSynchronizedStarSteps(
    center,
    branchStart,
    edgeLength,
    edgeAngle,
    PENTAGRAM_VERTEX_COUNT
  );
  const nextEdgeLength = edgeLength / PHI;
  const nextStart = pointFrom(branchStart, nextEdgeLength, branchAdvanceAngle);
  return [
    ...currentSteps,
    ...buildOutwardSteps(
      center,
      nextStart,
      nextEdgeLength,
      edgeAngle,
      branchAdvanceAngle,
      minimumEdgeLength
    )
  ];
}

export function buildArtwork(center, rootRadius, minimumEdgeLength) {
  const pentagonChord = 2 * rootRadius * Math.sin(Math.PI / PENTAGRAM_VERTEX_COUNT);
  const inwardEdgeLength = pentagonChord * PHI;
  const inwardEdgeAngle = Math.PI + HALF_POINT_ANGLE;
  const inwardStart = pointFrom(center, rootRadius, 0);
  const inwardSteps = buildInwardSteps(
    inwardStart,
    inwardEdgeLength,
    inwardEdgeAngle,
    minimumEdgeLength
  );

  const inwardAdvance = inwardEdgeLength / (PHI * PHI);
  const outwardStart = pointFrom(inwardStart, inwardAdvance, inwardEdgeAngle);
  const outwardEdgeLength = inwardEdgeLength - 2 * inwardAdvance;
  const outwardEdgeAngle = inwardEdgeAngle - PENTAGON_INTERIOR_ANGLE;
  return [
    ...inwardSteps,
    ...buildOutwardSteps(
      center,
      outwardStart,
      outwardEdgeLength,
      outwardEdgeAngle,
      HALF_POINT_ANGLE,
      minimumEdgeLength
    )
  ];
}

export function countSegments(steps) {
  let segmentCount = 0;
  for (const segments of steps) {
    segmentCount += segments.length;
  }
  return segmentCount;
}
