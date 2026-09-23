import { mulberry32 } from "../shared/random.js";

/**
 * Soap bubbles, each thinning from the day it is blown until it bursts.
 *
 * A bubble's film drains: water runs down it, so it is thinnest at the top and thickest at
 * the bottom, and the whole of it grows thinner with time, the top fastest, since the water
 * that leaves the top runs on down past the rest. Here that is a description, not a
 * solution: the thickness at a point is a formula of the point's height on the bubble and
 * the bubble's age, with a slowly turning pattern laid over it for the swirling a real film
 * shows. No fluid is solved.
 *
 *   h(ψ, age) = h₀ · (1 + β·w) · exp(−(1 − κ·w) · age / τ) · exp(σ · w · N(q)),
 *
 *   w = (1 − cos ψ) / 2,
 *
 * where ψ is the angle down from the top, τ the time the top takes to thin by a factor e,
 * κ how much of that pace the bottom is spared, and N a smooth pattern between −1 and 1
 * read at the point turned about the vertical by an angle that grows with age. Two things
 * are true of this by construction, and the tests hold both:
 *
 *   - the top is the thinnest point at every age, because w is nought there and the pattern
 *     is weighted by w, β > e^σ − 1 keeps (1 + β·w)·e^(−σ·w) above one everywhere else,
 *     and the slower thinning below the top only adds to that;
 *   - every point grows thinner with every moment, because the pattern turns slowly enough
 *     that its change never outruns the slowest drainage, the bottom's: σ·Σ a·ω·Ω < (1 − κ)/τ.
 *
 * A real film does not thin into black gradually: once it is thin enough, a black film,
 * only a few molecules thick, opens in it at once, with a sharp edge. Here a film that thins
 * to BLACK_ONSET drops to BLACK_FILM. The drop is taken over a sliver of the thinning,
 * BLACK_EDGE of it, so that the black's edge falls across a pixel or two instead of being
 * stepped; the thickness only falls through it, so every point still thins without a pause.
 *
 * So the first place to go black is the top, and the black spreads down from it. A bubble
 * bursts when its black cap reaches BURST_ANGLE down from the top: that rule is a choice of
 * this model, not a law.
 */

export const LOGICAL_SIZE = 680;
export const PLAYBACK_FPS = 30;
export const DURATION_SECONDS = 12;
export const TOTAL_FRAMES = PLAYBACK_FPS * DURATION_SECONDS;

/** Thickness, in nanometres, at the top of a bubble just blown. */
export const START_THICKNESS = 270;
/** A film that thins to this, in nanometres, opens into black. */
export const BLACK_ONSET = 50;
/** The black film's thickness: it reflects almost nothing. */
export const BLACK_FILM = 6;
/** The share of BLACK_ONSET over which the drop to black is spread, for its edge. */
export const BLACK_EDGE = 0.005;
/** How much thicker the bottom of a bubble just blown is than its top: β. */
export const DRAINAGE = 2;
/** How much of the top's pace of thinning the bottom is spared: κ. */
export const HOLD = 0.66;
/** How strongly the swirling pattern thickens and thins the film, at its full weight. */
export const SWIRL = 0.6;
/**
 * How far the eye looks down on the bubbles, in radians. A little from above, a bubble's
 * top, where the black comes, turns towards the eye from its outline, and the bands of
 * equal thickness, level rings round it, curve as rings do.
 */
export const TILT = 10 * Math.PI / 180;

/** The black cap's reach down from the top, in radians, when the bubble bursts. */
export const BURST_ANGLE = 50 * Math.PI / 180;

/**
 * The swirling pattern: a few waves across the sphere, their amplitudes adding to one so
 * that the pattern stays between −1 and 1. Its steepest possible slope is Σ a·ω.
 */
export const WAVES = [
  { amplitude: 0.34, frequency: 3.1, direction: [0.62, 0.21, 0.76], phase: 0.4 },
  { amplitude: 0.26, frequency: 4.7, direction: [-0.35, 0.58, 0.73], phase: 2.1 },
  { amplitude: 0.22, frequency: 6.3, direction: [0.81, -0.44, 0.39], phase: 4.0 },
  { amplitude: 0.18, frequency: 8.9, direction: [-0.12, -0.67, 0.73], phase: 5.3 }
].map((wave) => {
  const [x, y, z] = wave.direction;
  const length = Math.sqrt(x * x + y * y + z * z);
  return { ...wave, direction: [x / length, y / length, z / length] };
});
export const WAVE_SLOPE = WAVES.reduce((sum, wave) => sum + wave.amplitude * wave.frequency, 0);

export function pattern(qx, qy, qz) {
  let value = 0;
  for (const { amplitude, frequency, direction, phase } of WAVES) {
    value += amplitude * Math.sin(frequency * (direction[0] * qx + direction[1] * qy + direction[2] * qz) + phase);
  }
  return value;
}

/**
 * A bubble's thickness, in nanometres, at the point (px, py, pz) of its unit sphere — x to
 * the right, y down the screen, z towards the viewer — at an age in seconds. `timeScale` is
 * the bubble's τ, `turn` its rate of turning, `offset` where its pattern starts.
 */
export function thicknessAt(bubble, px, py, pz, age) {
  // Down from the top: the top is y = −1 on a unit sphere whose y runs down the screen.
  const w = (1 + py) / 2;
  const drained = START_THICKNESS * (1 + DRAINAGE * w) * Math.exp(-(1 - HOLD * w) * age / bubble.timeScale);
  const angle = bubble.offset + bubble.turn * age;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // The point turned about the vertical: the pattern swirls round the bubble as it ages.
  const qx = c * px + s * pz;
  const qz = -s * px + c * pz;
  return blackened(drained * Math.exp(SWIRL * w * pattern(qx, py, qz)));
}

/**
 * A film's thickness once the black has had its way: as it was above BLACK_ONSET, BLACK_FILM
 * below the sliver under it, and between the two across the sliver, rising with the film
 * so that a film that thins keeps thinning.
 */
export function blackened(film) {
  const low = BLACK_ONSET * (1 - BLACK_EDGE);
  const t = Math.min(1, Math.max(0, (film - low) / (BLACK_ONSET - low)));
  return BLACK_FILM + t * t * (3 - 2 * t) * (film - BLACK_FILM);
}

/**
 * The point that the eye sees at (u, v, z) of a bubble's unit sphere — u to the right, v
 * down the screen, z towards the eye — in the bubble's upright frame, the one thicknessAt
 * takes: the same point, turned about the horizontal by the eye's tilt.
 */
export function upright(u, v, z) {
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  return [u, c * v - s * z, s * v + c * z];
}

/** The thickness at the point the eye sees at (u, v, z) of a bubble's unit sphere. */
export function thicknessSeen(bubble, u, v, z, age) {
  const [px, py, pz] = upright(u, v, z);
  return thicknessAt(bubble, px, py, pz, age);
}

/**
 * The age at which the black cap reaches BURST_ANGLE: the bubble's lifetime. The cap's
 * edge is taken where the drained film, the film without its pattern, is BLACK_ONSET thick.
 */
export function lifetimeOf(timeScale) {
  const w = (1 - Math.cos(BURST_ANGLE)) / 2;
  return timeScale * Math.log(START_THICKNESS * (1 + DRAINAGE * w) / BLACK_ONSET) / (1 - HOLD * w);
}

/** The age at which the top itself opens into black. */
export function blackeningOf(timeScale) {
  return timeScale * Math.log(START_THICKNESS / BLACK_ONSET);
}

/**
 * The clip's bubbles: sixty over the loop, of radius 24 to 48 logical pixels, each living
 * 2.4 to 3.6 seconds, so that some fifteen are in the air at once and the loop, twelve
 * seconds, holds four of their lives end to end. Laid out from one seed.
 */
export const BUBBLE_COUNT = 60;
export const RADII = [24, 48];
export const LIFETIMES = [2.4, 3.6];
export const SEED = 20260923;

/**
 * The air the bubbles float in: a slow, smooth flow with no sources and no sinks, the curl
 * of a stream function made of four long waves, each longer than the canvas is wide. A
 * wave's speed is its `speed` in logical pixels a second, across its `direction`; each
 * drifts along once or twice in twelve seconds, so the air, like the clip, comes back to
 * itself when the loop does. Bubbles near one another ride the same air and move alike.
 */
export const AIR_WAVES = [
  { speed: 30, wavelength: 1400, direction: [0.94, 0.34], cycles: 1, phase: 0.7 },
  { speed: 22, wavelength: 1000, direction: [-0.52, 0.85], cycles: 1, phase: 2.3 },
  { speed: 16, wavelength: 800, direction: [0.21, -0.98], cycles: 2, phase: 4.1 },
  { speed: 12, wavelength: 1200, direction: [-0.87, -0.49], cycles: 2, phase: 5.6 }
].map((wave) => {
  const [x, y] = wave.direction;
  const length = Math.hypot(x, y);
  return { ...wave, direction: [x / length, y / length] };
});

/** The air's velocity, in logical pixels a second, at (x, y) and time t: the curl of the waves. */
export function airAt(x, y, t) {
  let u = 0;
  let v = 0;
  for (const { speed, wavelength, direction, cycles, phase } of AIR_WAVES) {
    const [dx, dy] = direction;
    const c = Math.cos(2 * Math.PI * ((dx * x + dy * y) / wavelength + cycles * t / DURATION_SECONDS) + phase);
    // ψ = Σ speed·(wavelength/2π)·sin(θ): u = ∂ψ/∂y and v = −∂ψ/∂x.
    u += speed * dy * c;
    v -= speed * dx * c;
  }
  return [u, v];
}

/**
 * A bubble leaves the blowing at BLOW pixels a second, up to BLOW_ANGLE either side of
 * straight up, and the drag of the air slows it into the breeze over LAG seconds. The warm
 * breath in it lifts it at first, WARM pixels a second, fading over WARM_TIME seconds into
 * a slow sink of SINK pixels a second as it cools and its film's weight tells.
 */
export const BLOW = [60, 110];
export const BLOW_ANGLE = 40 * Math.PI / 180;
export const WARM = 12;
export const WARM_TIME = 1.5;
export const SINK = [4, 9];
export const LAG = 0.5;
/** The step the paths are worked out in, in seconds. */
export const PATH_STEP = 1 / 240;

/**
 * Where a bubble blown at (x, y) at time `born` goes: its centre at every PATH_STEP of its
 * life, as x0, y0, x1, y1, …. Its velocity closes on the air's plus its drift by the fraction
 * 1 − e^(−step/LAG) each step, and it moves by the mean of its velocities either side.
 */
export function pathOf(bubble, x, y) {
  const steps = Math.ceil(bubble.lifetime / PATH_STEP) + 1;
  const path = new Float64Array(2 * steps);
  const keep = Math.exp(-PATH_STEP / LAG);
  const driftAt = (age) => {
    const fade = Math.exp(-age / WARM_TIME);
    return -WARM * fade + bubble.sink * (1 - fade);
  };
  // Launched by the blowing, not by the air.
  let u = bubble.blow * Math.sin(bubble.blowAngle);
  let v = -bubble.blow * Math.cos(bubble.blowAngle);
  for (let k = 0; k < steps; k += 1) {
    path[2 * k] = x;
    path[2 * k + 1] = y;
    const age = k * PATH_STEP;
    const [au, av] = airAt(x, y, bubble.born + age);
    const nextU = au + (u - au) * keep;
    const target = av + driftAt(age);
    const nextV = target + (v - target) * keep;
    x += PATH_STEP * (u + nextU) / 2;
    y += PATH_STEP * (v + nextV) / 2;
    u = nextU;
    v = nextV;
  }
  return path;
}

/** A bubble's centre at an age, between the two steps of its path either side. */
export function centreAt(bubble, age) {
  const at = Math.min(age / PATH_STEP, bubble.path.length / 2 - 1);
  const k = Math.min(Math.floor(at), bubble.path.length / 2 - 2);
  const f = at - k;
  const p = bubble.path;
  return [p[2 * k] + f * (p[2 * k + 2] - p[2 * k]), p[2 * k + 1] + f * (p[2 * k + 3] - p[2 * k + 1])];
}
/** A bubble grows to its size over its first BLOWING seconds, as if blown, easing in. */
export const BLOWING = 0.25;

/**
 * The bubbles of the clip. Each is blown at a moment of the loop and lives out a lifetime
 * shorter than the loop; everything about it after that is a function of its age alone, so
 * the loop closes: a bubble alive across the seam is the same bubble on both sides of it.
 */
export function createBubbles() {
  const random = mulberry32(SEED);
  // Each bubble takes a cell of a grid over the canvas. The cells are dealt out so that each
  // new bubble takes the free cell farthest from those of the bubbles blown just before it,
  // which are the ones it will share the picture with: the bubbles alive at any moment are
  // spread over it rather than bunched in a corner.
  const columns = Math.ceil(Math.sqrt(BUBBLE_COUNT));
  const rows = Math.ceil(BUBBLE_COUNT / columns);
  const free = Array.from({ length: columns * rows }, (unused, k) => k);
  const cells = [free.splice(Math.floor(random() * free.length), 1)[0]];
  // The bubbles in the air with a new one are about as many as a lifetime holds.
  const company = Math.max(1, Math.round(BUBBLE_COUNT * (LIFETIMES[0] + LIFETIMES[1]) / 2 / DURATION_SECONDS));
  while (cells.length < BUBBLE_COUNT) {
    let best = 0;
    let bestDistance = -1;
    free.forEach((cell, index) => {
      let nearest = Infinity;
      for (const other of cells.slice(-company)) {
        const dx = (cell % columns) - (other % columns);
        const dy = Math.floor(cell / columns) - Math.floor(other / columns);
        nearest = Math.min(nearest, dx * dx + dy * dy);
      }
      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = index;
      }
    });
    cells.push(free.splice(best, 1)[0]);
  }
  const bubbles = [];
  for (let k = 0; k < BUBBLE_COUNT; k += 1) {
    const [least, most] = RADII;
    const radius = least + random() * (most - least);
    // The lifetime drawn from LIFETIMES: lifetimeOf is in proportion to τ.
    const timeScale = (LIFETIMES[0] + (LIFETIMES[1] - LIFETIMES[0]) * random()) / lifetimeOf(1);
    const lifetime = lifetimeOf(timeScale);
    // The turn is held under the bound that keeps every point thinning, with room to spare.
    const turn = (0.35 + 0.35 * random()) * (1 - HOLD) / (SWIRL * WAVE_SLOPE * timeScale) * (random() < 0.5 ? -1 : 1);
    const blow = BLOW[0] + (BLOW[1] - BLOW[0]) * random();
    const blowAngle = (2 * random() - 1) * BLOW_ANGLE;
    const cell = cells[k];
    const cellX = ((cell % columns) + 0.25 + 0.5 * random()) / columns * LOGICAL_SIZE;
    const cellY = (Math.floor(cell / columns) + 0.25 + 0.5 * random()) / rows * LOGICAL_SIZE;
    const bubble = {
      radius,
      timeScale,
      lifetime,
      turn,
      offset: random() * 2 * Math.PI,
      born: (k + 0.5 * random()) * DURATION_SECONDS / BUBBLE_COUNT,
      blow,
      blowAngle,
      sink: SINK[0] + (SINK[1] - SINK[0]) * random(),
      depth: random()
    };
    // Blown in its cell, then moved as a whole, path and all, until the whole of its path
    // keeps it on the canvas. Moving it changes the air it meets, so the path is worked out
    // again each time.
    let x = cellX;
    let y = cellY;
    let path = pathOf(bubble, x, y);
    for (let tries = 0; tries < 16; tries += 1) {
      let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity];
      for (let i = 0; i < path.length; i += 2) {
        left = Math.min(left, path[i]);
        right = Math.max(right, path[i]);
        top = Math.min(top, path[i + 1]);
        bottom = Math.max(bottom, path[i + 1]);
      }
      const shiftX = Math.max(0, radius - left) - Math.max(0, right + radius - LOGICAL_SIZE);
      const shiftY = Math.max(0, radius - top) - Math.max(0, bottom + radius - LOGICAL_SIZE);
      if (shiftX === 0 && shiftY === 0) break;
      // A little past the edge, so that the path worked out again does not fall back over it.
      x += shiftX + Math.sign(shiftX) * 2;
      y += shiftY + Math.sign(shiftY) * 2;
      path = pathOf(bubble, x, y);
    }
    bubbles.push({ ...bubble, x, y, path });
  }
  return bubbles;
}

/** The bubbles alive at a frame, each with its age and where it stands, back to front. */
export function sceneAt(bubbles, frameIndex) {
  const time = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES / PLAYBACK_FPS;
  const alive = [];
  for (const bubble of bubbles) {
    const age = ((time - bubble.born) % DURATION_SECONDS + DURATION_SECONDS) % DURATION_SECONDS;
    if (age >= bubble.lifetime) continue;
    const blown = Math.min(1, age / BLOWING);
    const [cx, cy] = centreAt(bubble, age);
    alive.push({
      ...bubble,
      age,
      radius: bubble.radius * (1 - (1 - blown) * (1 - blown)),
      cx,
      cy
    });
  }
  return alive.sort((first, second) => first.depth - second.depth);
}

/**
 * The ground behind the bubbles, as light: none. The bubbles are lit from all round and
 * seen against black, so all a bubble shows is what its films reflect, and what one bubble
 * reflects is seen through the films of another in front of it.
 */
export const GROUND = [0, 0, 0];
/**
 * How the light is printed: 1 − e^(−(E·L)^t), a photograph's curve. Soap reflects a few per
 * cent of the light, so it is exposed up, by E. The rims, where the reflection climbs
 * towards all of the light at grazing angles, shoulder into white instead of clipping. And
 * the curve has a toe, t above one: the faintest reflections, a black film's per cent or
 * so, sink to the ground's black rather than print as grey, while a film's colours hold.
 * That is a choice of how the picture is printed, not of what the film does.
 */
export const EXPOSURE = 2.6;
export const TONE = 2;

/** How far the colours are kept from grey: 1 is the film's own colour. */
export const SATURATION = 0.6;

/**
 * A bubble's appearance at a point of its disk (u, v from −1 to 1, v down the screen): the
 * light it reflects from its near film and, seen through that, its far film, and the share
 * of what is behind it that comes through both. Linear light; a mirror reflects (1, 1, 1).
 */
export function bubbleLight(bubble, u, v, colourAt) {
  const r2 = u * u + v * v;
  if (r2 >= 1) return null;
  const z = Math.sqrt(1 - r2);
  const near = colourAt(bubble, u, v, z);
  const far = colourAt(bubble, u, v, -z);
  // A lossless film lets through, at each wavelength, what it does not reflect; and the
  // colour of what is let through is white less the colour reflected, channel by channel.
  const reflected = near.map((value, i) => value + (1 - value) * far[i]);
  const through = near.map((value, i) => (1 - value) * (1 - far[i]));
  return { reflected, through };
}

/** Colour held towards grey by SATURATION, around its own luminance. */
export function saturate(rgb, amount = SATURATION) {
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return rgb.map((value) => luminance + amount * (value - luminance));
}

export function encode(linear) {
  return linear.map((value) => {
    const x = Math.min(1, Math.max(0, value));
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  });
}

/** Where in an output pixel the film is read: a quarter of the pixel in from each corner. */
export const QUARTERS = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];

/**
 * The light at a point of the canvas, before it is printed: the ground, then each bubble
 * over it from the back, its reflection added and what is behind it dimmed by what it lets
 * through. A bubble's edge is spread over one pixel of the output, `scale` pixels to the
 * logical one, so that its outline is not stepped.
 */
export function lightAt(scene, x, y, colourAt, scale = 1, amount = SATURATION) {
  let light = [...GROUND];
  for (const bubble of scene) {
    const u = (x - bubble.cx) / bubble.radius;
    const v = (y - bubble.cy) / bubble.radius;
    const distance = Math.sqrt(u * u + v * v);
    const cover = Math.min(1, Math.max(0, (1 - distance) * bubble.radius * scale + 0.5));
    if (cover <= 0) continue;
    // Inside the edge the sphere is taken just short of its rim, where it is still a sphere.
    const inward = Math.min(1, 1 - 0.5 / (bubble.radius * scale) + 1e-9);
    // The film is read at four points of the pixel and averaged, so that where it changes
    // at once, at a black film's edge, the pixel takes its share of each side.
    const seen = { reflected: [0, 0, 0], through: [0, 0, 0] };
    for (const [dx, dy] of QUARTERS) {
      const su = (x + dx / scale - bubble.cx) / bubble.radius;
      const sv = (y + dy / scale - bubble.cy) / bubble.radius;
      const reach = Math.sqrt(su * su + sv * sv);
      const shrink = reach > inward ? inward / reach : 1;
      const point = bubbleLight(bubble, su * shrink, sv * shrink, colourAt);
      for (let i = 0; i < 3; i += 1) {
        seen.reflected[i] += point.reflected[i] / 4;
        seen.through[i] += point.through[i] / 4;
      }
    }
    const shown = saturate(seen.reflected, amount);
    light = light.map((value, i) => {
      const over = shown[i] + seen.through[i] * value;
      return value + cover * (over - value);
    });
  }
  return light;
}

/** Light printed on the curve 1 − e^(−(E·L)^t), as 0–255 sRGB. */
export function printLight(light) {
  return encode(light.map((value) => 1 - Math.exp(-Math.pow(Math.max(0, EXPOSURE * value), TONE))));
}

/** The picture at a point of the canvas, as 0–255 sRGB. */
export function pixelAt(scene, x, y, colourAt, scale = 1) {
  return printLight(lightAt(scene, x, y, colourAt, scale));
}
