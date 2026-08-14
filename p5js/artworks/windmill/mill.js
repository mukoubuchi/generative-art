import { mulberry32 } from "../shared/random.js";

/**
 * The mill as a rotor with real torque on it. The wind pushes the sails with a thrust
 * quadratic in the relative wind — what the sails feel is the gale minus their own
 * motion — and the mill answers through its inertia, against a viscous loss and a dry
 * friction that will not let go until the wind is worth it. Nothing here commands the
 * wheel; holding K raises the wind, and everything the wheel does follows from the
 * torque balance, integrated with the same fourth-order stepper the Lorenz artwork
 * uses, at a fixed sixtieth-of-a-second step so the clip is reproducible to the bit.
 */

/** Simulation steps per second; the 30 fps clip samples every second step. */
export const STEPS_PER_SECOND = 60;
export const DT = 1 / STEPS_PER_SECOND;
/** The whole clip: ten seconds of wind and rest. */
export const TOTAL_STEPS = 600;

/**
 * The wind, while it blows, wanders between a lull and a gale: seeded targets every
 * hundred steps, joined by smoothstep, so the gusts are smooth, bounded by design,
 * and the same for the same seed everywhere.
 */
export const LULL_WIND = 4;
export const GALE_WIND = 9;
export const GUST_INTERVAL = 100;
/**
 * The clip's afternoon of wind. The seed is a design choice, like a palette: it was
 * searched so that the whole clip turns the mill by exactly three revolutions to
 * within a third of a milliradian — a tenth of a pixel at the sail tips — so the
 * loop closes on the sails' own quarter-turn symmetry with the mill at rest.
 */
export const GUST_SEED = 5027;

/** Torque balance: sail thrust against viscous loss and dry friction, over inertia. */
export const THRUST = 0.55;
export const VISCOUS = 1.85;
export const BREAKAWAY_TORQUE = 4.3;
export const TIP_RATIO = 0.95;
export const INERTIA = 6;
/** The wind below which thrust on a resting mill cannot beat the dry friction. */
export const BREAKAWAY_WIND = Math.sqrt(BREAKAWAY_TORQUE / THRUST);

export const SAIL_COUNT = 4;
const QUARTER_TURN = Math.PI / 2;

/**
 * A sail begins clear of the cap and ends at the mill's reach; the cloth stands to one
 * side of the stock that carries it, and the bars that hold the cloth cross it at even
 * intervals. Those three numbers are the whole difference between a mill's sail and the
 * pitched blade of the fan that stands beside it in this gallery: a sail is a frame with
 * air through it, and it is offset from its own axis rather than symmetric about it.
 */
export const SAIL_INNER_RATIO = 0.22;
export const SAIL_WIDTH_RATIO = 0.2;
export const SAIL_PANES = 6;

/**
 * The four sails, each as a list of bars — pairs of endpoints, in the rotor's own
 * coordinates with the windshaft at the origin.
 *
 * Every sail is the one before it turned a quarter, so the rotor carries the four-fold
 * symmetry the clip's loop closes on: the mill comes to rest three whole revolutions
 * from where it started, and a quarter turn would already have sufficed.
 */
export function sailBars(outerRadius) {
  const inner = outerRadius * SAIL_INNER_RATIO;
  const width = outerRadius * SAIL_WIDTH_RATIO;
  const paneLength = (outerRadius - inner) / SAIL_PANES;
  const local = [
    // The frame: the stock the cloth hangs from, the cloth's outer edge, and the two ends.
    { kind: "frame", from: [inner, 0], to: [outerRadius, 0] },
    { kind: "frame", from: [inner, width], to: [outerRadius, width] },
    { kind: "frame", from: [inner, 0], to: [inner, width] },
    { kind: "frame", from: [outerRadius, 0], to: [outerRadius, width] },
    // The bar that runs the length of the cloth, halfway across it.
    { kind: "bar", from: [inner, width / 2], to: [outerRadius, width / 2] }
  ];
  for (let pane = 1; pane < SAIL_PANES; pane += 1) {
    const along = inner + pane * paneLength;
    local.push({ kind: "bar", from: [along, 0], to: [along, width] });
  }
  const place = (cosine, sine) => ([along, across]) => ({
    x: along * cosine - across * sine,
    y: along * sine + across * cosine
  });
  return Array.from({ length: SAIL_COUNT }, (unused, index) => {
    const angle = index * QUARTER_TURN;
    const at = place(Math.cos(angle), Math.sin(angle));
    return local.map(({ kind, from, to }) => ({ kind, from: at(from), to: at(to) }));
  });
}

/** The capture scenario: calm, the wind raised and held, released, and the rest. */
export const CALM_STEPS = 36;
export const ATTACK_STEPS = 60;
export const RELEASE_STEP = 336;
export const DECAY_STEPS = 84;

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * A gust track: value noise over time. Targets are drawn lazily from one seeded
 * stream, so the track extends as far as it is asked for and always the same way.
 * `speedAt` accepts fractional steps, which the stepper needs mid-step.
 */
export function gustTrack(seed) {
  const random = mulberry32(seed);
  const targets = [];
  const targetAt = (index) => {
    while (targets.length <= index) {
      targets.push(LULL_WIND + (GALE_WIND - LULL_WIND) * random());
    }
    return targets[index];
  };
  return {
    speedAt(step) {
      const index = Math.floor(step / GUST_INTERVAL);
      const blend = smoothstep(step / GUST_INTERVAL - index);
      return targetAt(index) + (targetAt(index + 1) - targetAt(index)) * blend;
    }
  };
}

/** How much of the gust track the scenario lets through: the held K, as weather. */
export function envelopeAt(step) {
  if (step <= CALM_STEPS) {
    return 0;
  }
  if (step < CALM_STEPS + ATTACK_STEPS) {
    return smoothstep((step - CALM_STEPS) / ATTACK_STEPS);
  }
  if (step <= RELEASE_STEP) {
    return 1;
  }
  if (step < RELEASE_STEP + DECAY_STEPS) {
    return 1 - smoothstep((step - RELEASE_STEP) / DECAY_STEPS);
  }
  return 0;
}

const CAPTURE_TRACK = gustTrack(GUST_SEED);

/** The clip's wind: the seeded gusts through the scenario's envelope. */
export function captureWindAt(step) {
  return envelopeAt(step) * CAPTURE_TRACK.speedAt(step);
}

/**
 * Angular acceleration at a given speed and wind. The sails feel the wind less their
 * own tip speed and push quadratically in that relative wind; the bearing loses
 * torque linearly in speed; the dry friction takes a constant bite. The speed is
 * clamped at zero inside because the wind of this model never drives a mill
 * backwards — the friction term would, and its sign belongs to the stiction rule.
 */
export function accelerationAt(speed, wind) {
  const spinning = Math.max(speed, 0);
  const relative = wind - TIP_RATIO * spinning;
  const thrust = THRUST * relative * Math.abs(relative);
  return (thrust - VISCOUS * spinning - BREAKAWAY_TORQUE) / INERTIA;
}

/** One generic RK4 step: four slope samples, weighted 1-2-2-1, over array state. */
export function integrateStep(state, dt, derivative) {
  const k1 = derivative(state, 0);
  const k2 = derivative(state.map((value, i) => value + (dt / 2) * k1[i]), 0.5);
  const k3 = derivative(state.map((value, i) => value + (dt / 2) * k2[i]), 0.5);
  const k4 = derivative(state.map((value, i) => value + dt * k3[i]), 1);
  return state.map((value, i) => value + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

export function createMill() {
  return { angle: 0, speed: 0, windTravel: 0 };
}

/**
 * One fixed step of the mill under `windAt`, which must answer fractional steps.
 * A resting mill first checks stiction: until the thrust of the moment's wind beats
 * the dry friction, it does not move at all — that is the breakaway, and it is why
 * the giant ignores a breeze. A turning mill integrates the torque balance; if the
 * step lands below zero the mill has stopped, exactly, and stays stopped.
 * `windTravel` accumulates the wind's own passage for anything that rides it.
 */
export function advanceMill(mill, windAt, step) {
  const windNow = windAt(step);
  mill.windTravel += ((windNow + windAt(step + 1)) / 2) * DT;
  if (mill.speed === 0 && accelerationAt(0, windNow) <= 0) {
    return mill;
  }
  const derivative = ([, speed], offset) => [
    Math.max(speed, 0),
    accelerationAt(speed, windAt(step + offset))
  ];
  const [angle, speed] = integrateStep([mill.angle, mill.speed], DT, derivative);
  mill.angle = angle;
  mill.speed = Math.max(speed, 0);
  return mill;
}

/** The whole capture is a fold over the scenario, so any frame can be rebuilt alone. */
export function millAfter(steps, windAt = captureWindAt) {
  const mill = createMill();
  for (let step = 0; step < steps; step += 1) {
    advanceMill(mill, windAt, step);
  }
  return mill;
}

/**
 * The speed at which thrust and loss agree for a steady wind, found by bisection:
 * above breakaway the balance has exactly one root, because thrust falls and loss
 * rises as the mill speeds up. The simulation is tested to settle onto this root
 * rather than the root being trusted to describe the simulation.
 */
export function equilibriumSpeed(wind) {
  if (accelerationAt(0, wind) <= 0) {
    return 0;
  }
  let low = 0;
  let high = wind / TIP_RATIO;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2;
    if (accelerationAt(middle, wind) > 0) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}
