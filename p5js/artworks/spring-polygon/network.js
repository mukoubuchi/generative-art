export const BOB_COUNT = 5;
/** Processing's default frame rate, which sets how quickly the network settles. */
export const STEPS_PER_SECOND = 60;

const DAMPING = 0.95;
const BOB_SPRING_STIFFNESS = 0.1;
const ANCHOR_SPRING_STIFFNESS = 0.4;
const FULL_TURN = Math.PI * 2;

export function createNetwork({ centerX, centerY, restLength, mass }) {
  const anchors = [];
  const bobs = [];
  for (let index = 0; index < BOB_COUNT; index += 1) {
    const angle = index * FULL_TURN / BOB_COUNT;
    anchors.push({
      x: centerX + 2 * restLength * Math.cos(angle),
      y: centerY + 2 * restLength * Math.sin(angle)
    });
    bobs.push({
      x: centerX + restLength * Math.cos(angle),
      y: centerY + restLength * Math.sin(angle),
      velocityX: 0,
      velocityY: 0,
      accelerationX: 0,
      accelerationY: 0,
      dragging: false
    });
  }
  return { anchors, bobs, restLength, mass };
}

/** Hooke's law: pull along the displacement, proportionally to the stretch. */
function applySpring(target, fromX, fromY, restLength, stiffness, mass) {
  const offsetX = target.x - fromX;
  const offsetY = target.y - fromY;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance === 0) {
    return;
  }
  const stretch = distance - restLength;
  const magnitude = -stiffness * stretch / mass;
  target.accelerationX += offsetX / distance * magnitude;
  target.accelerationY += offsetY / distance * magnitude;
}

function integrate(bob) {
  bob.velocityX = (bob.velocityX + bob.accelerationX) * DAMPING;
  bob.velocityY = (bob.velocityY + bob.accelerationY) * DAMPING;
  bob.x += bob.velocityX;
  bob.y += bob.velocityY;
  bob.accelerationX = 0;
  bob.accelerationY = 0;
}

/** Overlapping bobs shove each other apart by the depth of the overlap. */
function collide(first, second, mass) {
  const offsetX = second.x - first.x;
  const offsetY = second.y - first.y;
  const distance = Math.hypot(offsetX, offsetY);
  const gap = 2 * mass - distance;
  if (gap <= 0 || distance === 0) {
    return;
  }
  const pushX = offsetX / distance * gap;
  const pushY = offsetY / distance * gap;
  first.velocityX -= pushX;
  first.velocityY -= pushY;
  second.velocityX += pushX;
  second.velocityY += pushY;
}

/**
 * One step of the Processing sketch's order: anchor springs first, then each bob
 * integrates and immediately exchanges forces with the others. A dragged bob is placed
 * before it interacts, so its position is authoritative for the whole step. The original
 * ran the drag inside the inner loop, which placed it partway through its own
 * interactions and left the grab offset cleared by the integrator.
 */
export function step(network, pointer) {
  const { anchors, bobs, restLength, mass } = network;

  anchors.forEach((anchor, index) => {
    applySpring(bobs[index], anchor.x, anchor.y, restLength, ANCHOR_SPRING_STIFFNESS, mass);
  });

  for (const bob of bobs) {
    integrate(bob);
    if (bob.dragging && pointer) {
      bob.x = pointer.x + bob.grabOffsetX;
      bob.y = pointer.y + bob.grabOffsetY;
      bob.velocityX = 0;
      bob.velocityY = 0;
    }
    for (const other of bobs) {
      if (other === bob) {
        continue;
      }
      applySpring(other, bob.x, bob.y, restLength, BOB_SPRING_STIFFNESS, mass);
      collide(bob, other, mass);
    }
  }
}

/** Grab the first bob under the pointer, keeping the offset from its centre. */
export function grab(network, pointer) {
  for (const bob of network.bobs) {
    if (Math.hypot(pointer.x - bob.x, pointer.y - bob.y) < network.mass) {
      bob.dragging = true;
      bob.grabOffsetX = bob.x - pointer.x;
      bob.grabOffsetY = bob.y - pointer.y;
      return bob;
    }
  }
  return undefined;
}

export function release(network) {
  for (const bob of network.bobs) {
    bob.dragging = false;
  }
}

export function totalSpeed(network) {
  return network.bobs.reduce(
    (sum, bob) => sum + Math.hypot(bob.velocityX, bob.velocityY),
    0
  );
}
