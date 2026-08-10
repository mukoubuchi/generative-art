const LOGICAL_WIDTH = 680;
const LOGICAL_HEIGHT = 680;
const PARAMETERS = new URLSearchParams(window.location.search);
const CAPTURE_MODE = PARAMETERS.get("capture") === "1";
const RENDER_SCALE = CAPTURE_MODE
  ? Math.max(1, Number.parseInt(PARAMETERS.get("renderScale") ?? "1", 10))
  : 1;
const OUTPUT_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
const OUTPUT_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
const BASE_DIMENSION = Math.min(LOGICAL_WIDTH, LOGICAL_HEIGHT);
const SQUARE_SIZE = BASE_DIMENSION * 0.875;
const MARGIN = SQUARE_SIZE * 0.0625;
const STROKE_WEIGHT = BASE_DIMENSION * 0.00175;
const GENERATIONS = 5;
const PEAK_ANGLE = 85 * Math.PI / 180;

function point(x, y) {
  return { x, y };
}

function subdivide(segment) {
  const offsetX = segment.end.x - segment.start.x;
  const offsetY = segment.end.y - segment.start.y;
  const length = Math.hypot(offsetX, offsetY);
  const segmentLength = length / (2 * (1 + Math.cos(PEAK_ANGLE)));
  const unitX = offsetX / length;
  const unitY = offsetY / length;
  const shortX = unitX * segmentLength;
  const shortY = unitY * segmentLength;
  const rotatedX = shortX * Math.cos(PEAK_ANGLE) - shortY * Math.sin(PEAK_ANGLE);
  const rotatedY = shortX * Math.sin(PEAK_ANGLE) + shortY * Math.cos(PEAK_ANGLE);

  const a = segment.start;
  const b = point(a.x + shortX, a.y + shortY);
  const c = point(b.x + rotatedX, b.y + rotatedY);
  const d = point(segment.end.x - shortX, segment.end.y - shortY);
  const e = segment.end;

  return [
    { start: a, end: b },
    { start: b, end: c },
    { start: c, end: d },
    { start: d, end: e }
  ];
}

function refine(segments, remainingGenerations) {
  if (remainingGenerations === 0) {
    return segments;
  }
  return refine(segments.flatMap(subdivide), remainingGenerations - 1);
}

function buildSegments() {
  const left = (LOGICAL_WIDTH - SQUARE_SIZE) / 2 + MARGIN;
  const top = (LOGICAL_HEIGHT - SQUARE_SIZE) / 2 + MARGIN;
  const right = (LOGICAL_WIDTH + SQUARE_SIZE) / 2 - MARGIN;
  const bottom = (LOGICAL_HEIGHT + SQUARE_SIZE) / 2 - MARGIN;
  const initialSquare = [
    { start: point(left, top), end: point(right, top) },
    { start: point(right, top), end: point(right, bottom) },
    { start: point(right, bottom), end: point(left, bottom) },
    { start: point(left, bottom), end: point(left, top) }
  ];
  return refine(initialSquare, GENERATIONS);
}

const segments = buildSegments();
const P5 = window.p5;

new P5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT).parent("artwork");
    p.noLoop();
  };

  p.draw = () => {
    p.background(255);
    p.scale(RENDER_SCALE);
    p.stroke(18);
    p.strokeWeight(STROKE_WEIGHT);
    for (const segment of segments) {
      p.line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
    }
    window.__ARTWORK_STATE__ = {
      kind: "image",
      segmentCount: segments.length,
      logicalSize: { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT },
      outputSize: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
    };
    window.__ARTWORK_READY__ = true;
  };
});
