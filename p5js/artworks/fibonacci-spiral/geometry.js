const PHI = (1 + Math.sqrt(5)) / 2;
const QUARTER_TURN = Math.PI / 2;
const HUE_STEP = 60;
const HUE_CYCLE = 360;

export { PHI };

/**
 * Largest exact golden rectangle that fits the available area. The Processing sketch
 * approximated phi with the literal 1.618 and let the canvas itself be the root
 * rectangle; keeping the ratio in floating-point composition instead of in the integer
 * canvas is what makes every later subdivision land exactly on the previous edge.
 */
export function goldenRectangle(availableWidth, availableHeight) {
  const width = Math.min(availableWidth, PHI * availableHeight);
  return { width, height: width / PHI };
}

/**
 * Places one golden rectangle per quarter turn. Each section starts where the previous
 * one ended, rotated a further 90 degrees, so its short side becomes the next long side.
 */
export function buildSections(origin, rootWidth, rootHeight, minimumSide) {
  const sections = [];
  let x = origin.x;
  let y = origin.y;
  let rotation = 0;
  let width = rootWidth;
  let height = rootHeight;

  while (height >= minimumSide) {
    sections.push({
      x,
      y,
      rotation,
      width,
      height,
      hue: sections.length * HUE_STEP % HUE_CYCLE
    });
    x += width * Math.cos(rotation);
    y += width * Math.sin(rotation);
    rotation += QUARTER_TURN;
    width = height;
    height /= PHI;
  }
  return sections;
}

/** The four corners of a section, in canvas coordinates. */
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
