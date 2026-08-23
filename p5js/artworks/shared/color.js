/**
 * Hue in degrees, saturation and brightness in per cent, to RGB bytes.
 *
 * The Processing sketches that need this set colorMode(HSB, 360, 100, 100) and wrote
 * packed colours straight into the pixel buffer. p5's pixel buffer is RGBA bytes, so ports
 * that paint per pixel convert here instead.
 */
export function hsbToRgb(hue, saturation, brightness) {
  const chroma = (brightness / 100) * (saturation / 100);
  const sector = ((hue % 360) + 360) % 360 / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = brightness / 100 - chroma;
  // Chosen rather than tabled. The six rows are constants of the sector, and building the
  // table meant seven arrays for every pixel converted -- on a per-pixel artwork at export
  // size that is thirteen million allocations a frame, and it made the conversion nearly
  // six times its cost. Nothing about the arithmetic changes: the same three values reach
  // the same three roundings.
  let red = 0;
  let green = 0;
  let blue = 0;
  switch (Math.floor(sector) % 6) {
    case 0: red = chroma; green = second; break;
    case 1: red = second; green = chroma; break;
    case 2: green = chroma; blue = second; break;
    case 3: green = second; blue = chroma; break;
    case 4: red = second; blue = chroma; break;
    default: red = chroma; blue = second; break;
  }
  return [
    Math.round((red + offset) * 255),
    Math.round((green + offset) * 255),
    Math.round((blue + offset) * 255)
  ];
}
