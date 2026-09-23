/**
 * The soap bubbles' first draft, kept as a specimen of two faults it had.
 *
 * Its film was far too thick below the top: 320 nm at the top of a bubble just blown and
 * twenty-one times that at the bottom, so most of a young bubble lay beyond the end of the
 * colour table, where the look-up holds the last row's colour, and read as a grey veil.
 * And it printed light on 1 − e^(−1.5·L), with no toe, so that its black film, thinning
 * smoothly to 20 nm, printed as a dark grey with no edge.
 *
 * The thickness field and the print are the draft's, with its constants; the swirling
 * pattern is the same as the artwork's.
 */

export const START_THICKNESS = 320;
export const BLACK_THICKNESS = 20;
export const DRAINAGE = 20;
export const SWIRL = 0.6;
export const EXPOSURE = 1.5;

const WAVES = [
  { amplitude: 0.34, frequency: 3.1, direction: [0.62, 0.21, 0.76], phase: 0.4 },
  { amplitude: 0.26, frequency: 4.7, direction: [-0.35, 0.58, 0.73], phase: 2.1 },
  { amplitude: 0.22, frequency: 6.3, direction: [0.81, -0.44, 0.39], phase: 4.0 },
  { amplitude: 0.18, frequency: 8.9, direction: [-0.12, -0.67, 0.73], phase: 5.3 }
].map((wave) => {
  const [x, y, z] = wave.direction;
  const length = Math.sqrt(x * x + y * y + z * z);
  return { ...wave, direction: [x / length, y / length, z / length] };
});

function pattern(qx, qy, qz) {
  let value = 0;
  for (const { amplitude, frequency, direction, phase } of WAVES) {
    value += amplitude * Math.sin(frequency * (direction[0] * qx + direction[1] * qy + direction[2] * qz) + phase);
  }
  return value;
}

export function thicknessAt(bubble, px, py, pz, age) {
  const w = (1 + py) / 2;
  const top = START_THICKNESS * Math.exp(-age / bubble.timeScale);
  const angle = bubble.offset + bubble.turn * age;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const qx = c * px + s * pz;
  const qz = -s * px + c * pz;
  return top * (1 + DRAINAGE * w) * Math.exp(SWIRL * w * pattern(qx, py, qz));
}

export function printLight(light) {
  return light.map((value) => {
    const x = Math.min(1, Math.max(0, 1 - Math.exp(-EXPOSURE * value)));
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  });
}
