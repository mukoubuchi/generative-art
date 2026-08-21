/**
 * Turning it, when a reader asks.
 *
 * The saying the work is named for is an instruction, so the page takes it: a click sets
 * the rings going. What it must not do is tell a lie about the drawing while they go, and
 * the drawing's claim is about arc lengths -- which a rotation cannot touch. Every ring
 * still shows the same three lengths in the same order all the way round, however far it
 * has been turned; what a turn moves is where the walls between the arcs happen to line
 * up. They break apart as the rings come out of step, and re-form as the rings seat.
 *
 * Each ring is given a whole number of turns, so wherever it stops is where it started.
 * The rings do not start together and they do not stop together: the machine takes hold
 * from the middle outward, and lets go from the middle outward too, an outer ring being
 * both later to start and longer about it. Nothing here is drawn from chance -- speed,
 * bearing, and the moment of letting go are all read off the ring's own index.
 *
 * None of it touches a renderer, which is why it is here rather than in the sketch: what
 * the page has to promise is that the picture it comes back to is the picture it left,
 * and that is arithmetic, so it can be held to arithmetic.
 */
export const FULL_TURN = Math.PI * 2;

/** How much later each ring outward takes hold, and how much longer it is about it. */
export const TURN_STAGGER = 0.06;
export const TURN_BASE_SECONDS = 6;
export const TURN_GROWTH = 0.12;
/** The catch as a ring seats, in radians: about a fifth of a degree, and gone by the end. */
export const SEAT_AMPLITUDE = 0.006;
export const SEAT_CYCLES = 2;

/**
 * One plan per ring, read off the ring's own index and nothing else.
 *
 * The turns cycle through one, two and three so that neighbours travel different
 * distances in overlapping times, and the directions alternate because meshed wheels
 * have to run opposite ways.
 */
export function turnPlans(count) {
  return Array.from({ length: count }, (unused, index) => ({
    turns: 1 + (index % 3),
    direction: index % 2 === 0 ? 1 : -1,
    from: TURN_STAGGER * index,
    to: TURN_STAGGER * index + TURN_BASE_SECONDS + TURN_GROWTH * index
  }));
}

/** When the last ring lets go, which is when the whole machine is home. */
export const turnSeconds = (plans) => Math.max(...plans.map((plan) => plan.to));

/**
 * Slow into it and slow out of it: no part of a mechanism arrives at speed.
 *
 * The quintic smoothstep, and it is used here for the end rather than the middle: it
 * reaches exactly one at one, so a ring asked for three turns gets three turns and not
 * three turns less a hair.
 */
export function ease(turned) {
  return turned * turned * turned * (turned * (6 * turned - 15) + 10);
}

/**
 * The catch as a ring seats. It is largest just before the end and exactly nothing at it,
 * because the last factor is (1 - turned) -- so the ring cannot be left a hair off home by
 * the very thing that is supposed to settle it.
 */
export function seat(turned) {
  return Math.sin(SEAT_CYCLES * FULL_TURN * turned) * turned ** 6 * (1 - turned);
}

/**
 * Where a ring stands at a moment of the turning, in radians from home.
 *
 * Nought before it starts and nought once it has stopped -- the second nought written out
 * rather than left to arithmetic, because a whole number of turns comes back to a bearing
 * whose sine is not quite zero in floating point. Not that the picture can tell: rotating a
 * finished ring by its whole number of turns was measured against not rotating it at all
 * and gives a byte-identical canvas. Written out so that the return is exact where it is
 * claimed to be exact, and so that nothing rests on the error staying small.
 */
export function angleAt(plan, seconds) {
  if (seconds <= plan.from || seconds >= plan.to) {
    return 0;
  }
  const turned = (seconds - plan.from) / (plan.to - plan.from);
  return plan.direction * (FULL_TURN * plan.turns * ease(turned) + SEAT_AMPLITUDE * seat(turned));
}
