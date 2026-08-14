const PHI = (1 + Math.sqrt(5)) / 2;
const QUARTER_TURN = Math.PI / 2;

export { PHI };

/**
 * The clip's plan, in frames at thirty a second: the mark travels the whole spiral, the
 * finished figure is held, and then it is let go of, so the loop returns to the night it
 * opened in. The mark rests at the centre through the hold — the end of its journey is
 * the eye of the spiral, and it stays there — and fades with everything else.
 */
export const LAY_FRAMES = 210;
export const HOLD_FRAMES = 60;
export const DISSOLVE_FRAMES = 30;
export const TOTAL_FRAMES = LAY_FRAMES + HOLD_FRAMES + DISSOLVE_FRAMES;

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
 * Where a section's square is cut off from the rest of it: the line from one long side
 * to the other, a short side's distance along. Fourteen of these are the whole drawing
 * of the tiling — the regions are shown by what divides them rather than by being
 * filled — and the last section, which is a square already, has nothing to divide.
 */
export function sectionCut(section) {
  if (section.width === section.height) {
    return null;
  }
  const cosine = Math.cos(section.rotation);
  const sine = Math.sin(section.rotation);
  const place = (localX, localY) => ({
    x: section.x + localX * cosine - localY * sine,
    y: section.y + localX * sine + localY * cosine
  });
  return { from: place(section.height, 0), to: place(section.height, section.height) };
}

/**
 * A point of a section's quarter arc, `along` of the way round it from start to end.
 * The arc is inscribed in the square half, so it runs from one corner of that square to
 * the next and hands the following section's arc a start exactly where it stops.
 */
export function arcPoint(section, along) {
  const angle = Math.PI + QUARTER_TURN * Math.min(Math.max(along, 0), 1);
  const localX = section.height * (1 + Math.cos(angle));
  const localY = section.height * (1 + Math.sin(angle));
  const cosine = Math.cos(section.rotation);
  const sine = Math.sin(section.rotation);
  return {
    x: section.x + localX * cosine - localY * sine,
    y: section.y + localX * sine + localY * cosine
  };
}

/** How long each quarter arc is, in the units the tiling is built in. */
export function arcLengths() {
  return buildSections().map((section) => QUARTER_TURN * section.height);
}

/**
 * Where a mark travelling the whole spiral at one steady speed stands, `share` of the
 * way along it.
 *
 * Steady along the curve, rather than a quarter turn to every beat. The quarter-turn
 * pacing is the one that makes the motion self-similar — scale the picture and shift the
 * clock and it is the same motion again — but that similarity can only be seen by a
 * camera that scales with it, and this one does not move. What a reader would see instead
 * is the mark stopping: five of the fifteen arcs are under five pixels across, and at a
 * quarter turn a beat they would take a fifth of the clip, spent on a mark that appears
 * to be standing still at the centre. At a steady speed they take a twentieth of a second
 * between them, and the self-similarity is carried by the mark's own size instead — it is
 * drawn in proportion to the arc it is on, so the mark and its arc make the same picture
 * at every one of the fifteen scales.
 */
export function travelAt(share) {
  const sections = buildSections();
  const lengths = sections.map((section) => QUARTER_TURN * section.height);
  const whole = lengths.reduce((total, length) => total + length, 0);
  let left = Math.min(Math.max(share, 0), 1) * whole;
  for (let index = 0; index < sections.length; index += 1) {
    if (left < lengths[index] || index === sections.length - 1) {
      const along = Math.min(left / lengths[index], 1);
      return {
        index,
        along,
        radius: sections[index].height,
        point: arcPoint(sections[index], along)
      };
    }
    left -= lengths[index];
  }
  return null;
}
