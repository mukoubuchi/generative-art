const PHI = (1 + Math.sqrt(5)) / 2;
const QUARTER_TURN = Math.PI / 2;

export { PHI };

/** Fifteen sections: the rectangles 987x610 down to 1x1, every side a Fibonacci number. */
export const SECTION_COUNT = 15;

/** The Fibonacci numbers the tiling is made of, F(1) through F(SECTION_COUNT + 1). */
export function fibonacciNumbers() {
  const numbers = [1, 1];
  while (numbers.length < SECTION_COUNT + 1) {
    numbers.push(numbers.at(-1) + numbers.at(-2));
  }
  return numbers;
}

/**
 * The largest exact golden rectangle that fits the available area: the limit the
 * integer tiling converges to, kept as the artwork's skeleton. The tiling's own root
 * is 987 by 610, whose aspect misses phi by about one part in a million — closer than
 * any pixel — and the tests pin that closeness rather than letting it pass as
 * coincidence.
 */
export function goldenRectangle(availableWidth, availableHeight) {
  const width = Math.min(availableWidth, PHI * availableHeight);
  return { width, height: width / PHI };
}

/**
 * The integer spiral: one rectangle per quarter turn, F(n+1) by F(n) in units, each
 * section's square split off exactly — 987 by 610 is a 610-square beside a 610 by 377,
 * and so on down to 1 by 1, with no remainder anywhere, because that is what the
 * recurrence F(n+1) = F(n) + F(n-1) says in carpentry. Each section carries its own
 * convergent F(n+1)/F(n): the ratios walk toward phi, alternately above and below it,
 * the error shrinking by phi squared each step, and the colour upstairs is keyed to
 * how far a section's convergent still stands from the limit.
 *
 * Sections are in unit coordinates with the root's corner at the origin; the sketch
 * scales the whole tiling to the canvas in one transform.
 */
export function buildSections() {
  const fibonacci = fibonacciNumbers();
  const sections = [];
  let x = 0;
  let y = 0;
  let rotation = 0;
  for (let section = 0; section < SECTION_COUNT; section += 1) {
    const longSide = fibonacci[SECTION_COUNT - section];
    const shortSide = fibonacci[SECTION_COUNT - section - 1];
    sections.push({
      x,
      y,
      rotation,
      width: longSide,
      height: shortSide,
      numerator: longSide,
      denominator: shortSide,
      ratio: longSide / shortSide
    });
    x += longSide * Math.cos(rotation);
    y += longSide * Math.sin(rotation);
    rotation += QUARTER_TURN;
  }
  return sections;
}

/** The four corners of a section, in the tiling's unit coordinates. */
export function sectionCorners(section) {
  const cosine = Math.cos(section.rotation);
  const sine = Math.sin(section.rotation);
  return [
    [0, 0],
    [section.width, 0],
    [section.width, section.height],
    [0, section.height]
  ].map(([localX, localY]) => ({
    x: section.x + localX * cosine - localY * sine,
    y: section.y + localX * sine + localY * cosine
  }));
}

/**
 * How far a section's convergent stands from phi, as a share of the journey: zero for
 * the roughest ratio the tiling holds (one over one), one at the limit. Logarithmic,
 * because the error falls geometrically and a linear scale would spend the whole
 * palette on the first two sections.
 */
export function convergence(section) {
  const fibonacci = fibonacciNumbers();
  const worst = Math.abs(1 - PHI);
  const finest = Math.abs(fibonacci.at(-1) / fibonacci.at(-2) - PHI);
  const error = Math.abs(section.ratio - PHI);
  if (error <= finest) {
    return 1;
  }
  return Math.max(Math.min(Math.log(worst / error) / Math.log(worst / finest), 1), 0);
}
