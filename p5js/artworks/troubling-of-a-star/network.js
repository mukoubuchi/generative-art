export const BOB_COUNT = 5;
/** Simulation steps per second; the 30 fps clip samples every second step. */
export const STEPS_PER_SECOND = 60;
export const DT = 1 / STEPS_PER_SECOND;

/**
 * The network as a proper mechanical system: five unit masses on a pentagon ring of
 * springs, each staked to its own anchor, damped by a viscous drag on velocity — no
 * per-step velocity multiplier, no impulse shoves — and integrated with the same
 * fixed-step fourth-order stepper the Lorenz artwork uses. Every rest length equals
 * the distance the geometry opens with, so the pentagon at rest is a true
 * equilibrium: net force zero everywhere, total energy zero, nothing moving until
 * a hand arrives. What the hand injects is then the only energy in the system, and
 * the tests follow it around the ring and out through the damping.
 */
export const BOB_MASS = 1;
export const RING_STIFFNESS = 40;
export const ANCHOR_STIFFNESS = 24;
/**
 * Viscous drag, and the artwork's one tuned constant. Uniform damping drains every
 * mode of the system at the same rate, so the whole network's energy falls on a
 * single exponential — and this value is where that exponential leaves the ring
 * still answering for most of the clip, yet settled below the drawing's own rest
 * threshold with about half a second in hand, so the last frame is as dark as the
 * first.
 */
export const DAMPING = 0.85;
/** How near the pointer must come to a bob's centre for a press to take it. */
export const GRAB_RADIUS = 46;

const FULL_TURN = Math.PI * 2;
/** The pentagon opens with one vertex due up, which the drag scenario pulls upward. */
const FIRST_ANGLE = -Math.PI / 2;

/**
 * Anchors stand at three radii — far enough that no reasonable pull can carry a bob
 * to its own stake. A plain length-spring is at rest anywhere on a sphere around its
 * far end, so a bob dragged past its anchor can be trapped on the wrong side of that
 * sphere in a pocket the damping cannot drain; keeping the stakes out of reach keeps
 * the pentagon the system's only rest.
 */
export const STAKE_RADII = 3;

export function createNetwork({ centerX, centerY, radius }) {
  const anchors = [];
  const bobs = [];
  for (let index = 0; index < BOB_COUNT; index += 1) {
    const angle = FIRST_ANGLE + index * FULL_TURN / BOB_COUNT;
    anchors.push({
      x: centerX + STAKE_RADII * radius * Math.cos(angle),
      y: centerY + STAKE_RADII * radius * Math.sin(angle)
    });
    bobs.push({
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      velocityX: 0,
      velocityY: 0,
      dragging: false
    });
  }
  return {
    anchors,
    bobs,
    // Rest lengths are the opening geometry's own distances, so the start is rest.
    ringRest: 2 * radius * Math.sin(Math.PI / BOB_COUNT),
    anchorRest: (STAKE_RADII - 1) * radius
  };
}

/** Hooke's law along the line between two points, as the force on the first. */
function springForce(fromX, fromY, toX, toY, restLength, stiffness) {
  const offsetX = toX - fromX;
  const offsetY = toY - fromY;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return { x: 0, y: 0 };
  }
  const pull = stiffness * (distance - restLength) / distance;
  return { x: offsetX * pull, y: offsetY * pull };
}

/**
 * Net spring force on every bob at the given positions: the two ring neighbours and
 * the anchor stake. Positions default to the bobs' own, but the stepper hands in
 * mid-step positions of its own.
 */
export function springForces(network, positions) {
  const places = positions ?? network.bobs;
  return places.map((bob, index) => {
    const before = places[(index + BOB_COUNT - 1) % BOB_COUNT];
    const after = places[(index + 1) % BOB_COUNT];
    const anchor = network.anchors[index];
    const forces = [
      springForce(bob.x, bob.y, before.x, before.y, network.ringRest, RING_STIFFNESS),
      springForce(bob.x, bob.y, after.x, after.y, network.ringRest, RING_STIFFNESS),
      springForce(bob.x, bob.y, anchor.x, anchor.y, network.anchorRest, ANCHOR_STIFFNESS)
    ];
    return {
      x: forces.reduce((sum, force) => sum + force.x, 0),
      y: forces.reduce((sum, force) => sum + force.y, 0)
    };
  });
}

/** One generic RK4 step: four slope samples, weighted 1-2-2-1, over array state. */
export function integrateStep(state, dt, derivative) {
  const k1 = derivative(state);
  const k2 = derivative(state.map((value, i) => value + (dt / 2) * k1[i]));
  const k3 = derivative(state.map((value, i) => value + (dt / 2) * k2[i]));
  const k4 = derivative(state.map((value, i) => value + dt * k3[i]));
  return state.map((value, i) => value + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/** The network's equations of motion over flat [x, y, vx, vy] state, for the stepper. */
function networkDerivative(network) {
  return (state) => {
    const positions = [];
    for (let index = 0; index < BOB_COUNT; index += 1) {
      positions.push({ x: state[4 * index], y: state[4 * index + 1] });
    }
    const forces = springForces(network, positions);
    const slopes = [];
    for (let index = 0; index < BOB_COUNT; index += 1) {
      const velocityX = state[4 * index + 2];
      const velocityY = state[4 * index + 3];
      slopes.push(
        velocityX,
        velocityY,
        (forces[index].x - DAMPING * velocityX) / BOB_MASS,
        (forces[index].y - DAMPING * velocityY) / BOB_MASS
      );
    }
    return slopes;
  };
}

/**
 * One fixed step. The free system integrates as one 20-dimensional ODE; a dragged
 * bob is then placed on the pointer it is following, with no velocity of its own —
 * the hand is a constraint, not a force, and the energy it leaves behind is stored
 * in the springs it stretched.
 */
export function step(network, pointer) {
  const state = network.bobs.flatMap((bob) => [bob.x, bob.y, bob.velocityX, bob.velocityY]);
  const next = integrateStep(state, DT, networkDerivative(network));
  network.bobs.forEach((bob, index) => {
    bob.x = next[4 * index];
    bob.y = next[4 * index + 1];
    bob.velocityX = next[4 * index + 2];
    bob.velocityY = next[4 * index + 3];
    if (bob.dragging && pointer) {
      bob.x = pointer.x + bob.grabOffsetX;
      bob.y = pointer.y + bob.grabOffsetY;
      bob.velocityX = 0;
      bob.velocityY = 0;
    }
  });
}

/** Grab the nearest bob within reach of the pointer, keeping the offset it was held by. */
export function grab(network, pointer) {
  let nearest;
  let nearestDistance = GRAB_RADIUS;
  for (const bob of network.bobs) {
    const distance = Math.hypot(pointer.x - bob.x, pointer.y - bob.y);
    if (distance < nearestDistance) {
      nearest = bob;
      nearestDistance = distance;
    }
  }
  if (nearest) {
    nearest.dragging = true;
    nearest.grabOffsetX = nearest.x - pointer.x;
    nearest.grabOffsetY = nearest.y - pointer.y;
  }
  return nearest;
}

export function release(network) {
  for (const bob of network.bobs) {
    bob.dragging = false;
  }
}

function ringSpringEnergy(network, index) {
  const bob = network.bobs[index];
  const after = network.bobs[(index + 1) % BOB_COUNT];
  const stretch = Math.hypot(after.x - bob.x, after.y - bob.y) - network.ringRest;
  return 0.5 * RING_STIFFNESS * stretch * stretch;
}

function anchorSpringEnergy(network, index) {
  const bob = network.bobs[index];
  const anchor = network.anchors[index];
  const stretch = Math.hypot(anchor.x - bob.x, anchor.y - bob.y) - network.anchorRest;
  return 0.5 * ANCHOR_STIFFNESS * stretch * stretch;
}

/**
 * Each bob's share of the system's energy: its own motion, plus half of each ring
 * spring it ends and the whole of its anchor stake. The halves make the shares sum
 * exactly to the system total, which a test holds as bookkeeping rather than trusts.
 */
export function bobEnergies(network) {
  return network.bobs.map((bob, index) => {
    const kinetic = 0.5 * BOB_MASS * (bob.velocityX ** 2 + bob.velocityY ** 2);
    const potential =
      ringSpringEnergy(network, index) / 2 +
      ringSpringEnergy(network, (index + BOB_COUNT - 1) % BOB_COUNT) / 2 +
      anchorSpringEnergy(network, index);
    return { kinetic, potential, total: kinetic + potential };
  });
}

/** The system's whole energy: every motion, every spring, counted once. */
export function totalEnergy(network) {
  let energy = 0;
  for (let index = 0; index < BOB_COUNT; index += 1) {
    const bob = network.bobs[index];
    energy += 0.5 * BOB_MASS * (bob.velocityX ** 2 + bob.velocityY ** 2);
    energy += ringSpringEnergy(network, index);
    energy += anchorSpringEnergy(network, index);
  }
  return energy;
}
