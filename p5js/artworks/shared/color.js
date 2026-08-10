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
  const table = [
    [chroma, second, 0], [second, chroma, 0], [0, chroma, second],
    [0, second, chroma], [second, 0, chroma], [chroma, 0, second]
  ];
  const [red, green, blue] = table[Math.floor(sector) % 6];
  return [
    Math.round((red + offset) * 255),
    Math.round((green + offset) * 255),
    Math.round((blue + offset) * 255)
  ];
}
