/**
 * The colour of a soap film, from its thickness.
 *
 * A film of soapy water in air reflects light from its outer face and from its inner face,
 * and the two reflections interfere. At the outer face light goes from air into water and
 * its reflection is turned over (a phase of π); at the inner face it goes from water into
 * air and is not. So a film far thinner than the light's wavelength sends back two
 * reflections that cancel, whatever the wavelength: it reflects nothing and looks black.
 * Thicker, the two reflections fall in and out of step differently for each wavelength,
 * and the film takes on the interference colours, in their order.
 *
 * The reflectance here is the full Airy sum of all the reflections back and forth inside
 * the film, for light polarised in each of the two planes, averaged: unpolarised light. The
 * film is lossless water of index 1.33. The light is white from every direction alike, so
 * the film reflects no scene, only colour. The spectrum reflected is weighed by the CIE
 * 1931 colour matching functions, in the analytic fit of Wyman, Sloan and Shirley (Journal
 * of Computer Graphics Techniques 2, no. 2, 2013), under an illuminant of equal energy at
 * every wavelength, and turned into sRGB balanced so that a perfect mirror is white.
 */

export const AIR = 1;
export const WATER = 1.33;

/** Wavelengths summed over, in nanometres. */
export const WAVELENGTHS = Array.from({ length: 81 }, (unused, k) => 380 + 5 * k);

/**
 * The amplitude of a reflection at a face between two media, for each polarisation, from
 * the cosines of the angles either side (Fresnel).
 */
export function fresnel(indexFrom, cosFrom, indexTo, cosTo) {
  return {
    s: (indexFrom * cosFrom - indexTo * cosTo) / (indexFrom * cosFrom + indexTo * cosTo),
    p: (indexTo * cosFrom - indexFrom * cosTo) / (indexTo * cosFrom + indexFrom * cosTo)
  };
}

/** The cosine of the angle inside the film, for light arriving at cosine `cosAir` (Snell). */
export function cosInside(cosAir) {
  const sinAir2 = 1 - cosAir * cosAir;
  return Math.sqrt(1 - sinAir2 / (WATER * WATER));
}

/**
 * Reflectance and transmittance of the film for one polarisation, from the amplitudes at
 * its outer face (air to water) and inner face (water to air) and the phase δ the light
 * gathers crossing the film and back (Airy).
 */
export function airy(outer, inner, phase) {
  const c = Math.cos(phase);
  const product = outer * inner;
  const denominator = 1 + product * product + 2 * product * c;
  const reflectance = (outer * outer + inner * inner + 2 * product * c) / denominator;
  const transmittance = (1 - outer * outer) * (1 - inner * inner) / denominator;
  return { reflectance, transmittance };
}

/**
 * The film at one wavelength: reflectance and transmittance for unpolarised light, at a
 * thickness in nanometres, seen at cosine `cosAir` from its normal.
 */
export function film(thickness, wavelength, cosAir) {
  const cosWater = cosInside(cosAir);
  const outer = fresnel(AIR, cosAir, WATER, cosWater);
  // The inner face is the outer face run backwards: the same numbers, turned over.
  const inner = fresnel(WATER, cosWater, AIR, cosAir);
  const phase = 4 * Math.PI * WATER * thickness * cosWater / wavelength;
  const s = airy(outer.s, inner.s, phase);
  const p = airy(outer.p, inner.p, phase);
  return {
    reflectance: (s.reflectance + p.reflectance) / 2,
    transmittance: (s.transmittance + p.transmittance) / 2
  };
}

/** The optical path difference of the two reflections, in nanometres: 2·n·d·cos θ inside. */
export function pathDifference(thickness, cosAir) {
  return 2 * WATER * thickness * cosInside(cosAir);
}

function lobe(wavelength, alpha, beta, gamma, delta) {
  const t = (wavelength - beta) * (wavelength < beta ? gamma : delta);
  return alpha * Math.exp(-0.5 * t * t);
}

/** CIE 1931 x̄, ȳ, z̄, as fitted by Wyman, Sloan and Shirley (2013), their Table 1. */
export function matching(wavelength) {
  return [
    lobe(wavelength, 0.362, 442.0, 0.0624, 0.0374)
      + lobe(wavelength, 1.056, 599.8, 0.0264, 0.0323)
      + lobe(wavelength, -0.065, 501.1, 0.0490, 0.0382),
    lobe(wavelength, 0.821, 568.8, 0.0213, 0.0247) + lobe(wavelength, 0.286, 530.9, 0.0613, 0.0322),
    lobe(wavelength, 1.217, 437.0, 0.0845, 0.0278) + lobe(wavelength, 0.681, 459.0, 0.0385, 0.0725)
  ];
}

/** XYZ to linear sRGB (IEC 61966-2-1). */
function toLinearRgb([X, Y, Z]) {
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z
  ];
}

const MATCHING = WAVELENGTHS.map(matching);
const WHITE = toLinearRgb(MATCHING.reduce((sum, m) => sum.map((value, i) => value + m[i]), [0, 0, 0]));

/**
 * The colour of a spectrum of reflectances, as linear sRGB with a perfect mirror at (1, 1, 1):
 * the illuminant is equal at every wavelength, and each channel is divided by what it
 * would give for a mirror.
 */
export function colourOf(reflectances) {
  const xyz = [0, 0, 0];
  reflectances.forEach((r, k) => {
    for (let i = 0; i < 3; i += 1) xyz[i] += r * MATCHING[k][i];
  });
  const rgb = toLinearRgb(xyz);
  return rgb.map((value, i) => value / WHITE[i]);
}

/** The film's colour, integrated directly, at a thickness and a viewing cosine. */
export function filmColour(thickness, cosAir) {
  return colourOf(WAVELENGTHS.map((wavelength) => film(thickness, wavelength, cosAir).reflectance));
}

/**
 * The colours baked into a table, for the page to look up: rows of optical path difference
 * from 0 to OPD_LIMIT nanometres in steps of OPD_STEP, columns of viewing cosine from 0 to
 * 1 in COSINE_STEPS. The film's colour depends on its thickness and the viewing angle
 * through these two: the phase is set by the path difference, the Fresnel amplitudes by the
 * angle. The columns are even in the square root of the cosine, so they crowd towards
 * grazing, where the amplitudes change fastest: column k is at cosine (k / COSINE_STEPS)².
 */
export const OPD_LIMIT = 4000;
export const OPD_STEP = 4;
export const COSINE_STEPS = 32;

export function colourTable() {
  const rows = OPD_LIMIT / OPD_STEP + 1;
  const columns = COSINE_STEPS + 1;
  const table = new Float32Array(rows * columns * 3);
  for (let column = 0; column < columns; column += 1) {
    const root = column / COSINE_STEPS;
    const cosAir = Math.max(1e-3, root * root);
    const cosWater = cosInside(cosAir);
    for (let row = 0; row < rows; row += 1) {
      const thickness = (row * OPD_STEP) / (2 * WATER * cosWater);
      const rgb = filmColour(thickness, cosAir);
      table.set(rgb, (row * columns + column) * 3);
    }
  }
  return { table, rows, columns };
}

/** Look a colour up in the table, interpolating in both directions. */
export function lookUp({ table, rows, columns }, opd, cosAir) {
  const u = Math.min(rows - 1, Math.max(0, opd / OPD_STEP));
  const v = Math.min(columns - 1, Math.max(0, Math.sqrt(cosAir) * COSINE_STEPS));
  const r0 = Math.min(rows - 2, Math.floor(u));
  const c0 = Math.min(columns - 2, Math.floor(v));
  const fu = u - r0;
  const fv = v - c0;
  const at = (r, c, i) => table[(r * columns + c) * 3 + i];
  return [0, 1, 2].map((i) => (at(r0, c0, i) * (1 - fu) + at(r0 + 1, c0, i) * fu) * (1 - fv)
    + (at(r0, c0 + 1, i) * (1 - fu) + at(r0 + 1, c0 + 1, i) * fu) * fv);
}
