/**
 * A held arrow key, timed here rather than by the operating system.
 *
 * p5 reports a key going down once and then not again while it stays down, so a reader
 * leaning on the arrow got a single section and then nothing. Letting the browser's own
 * auto-repeat through would not have been the answer either: its delay and its rate are
 * the reader's system settings, so the spiral would build at a speed the artwork never
 * chose and cannot know.
 *
 * So a hold carries the moment it began, and the steps it has earned are a pure function
 * of how long it has been down. A tap earns exactly one, as it always did; past the delay
 * the sections come on the artwork's own beat, and stop when the key comes up or when the
 * spiral runs out of sections to give.
 */

/** How long a key has to be down before it starts repeating, so that a tap stays a tap. */
export const REPEAT_DELAY_MS = 250;
/**
 * The beat it repeats at, once it starts. Building all fifteen sections from the first
 * rectangle takes the delay and twelve of these, a little under one and three quarter
 * seconds: slow enough to watch each rectangle arrive, quick enough not to be a chore.
 */
export const REPEAT_PERIOD_MS = 120;

/** Nothing is down. */
export const NOTHING_HELD = Object.freeze({ key: null, direction: 0, since: 0, taken: 0 });

/**
 * How many steps a key that has been down for `heldMilliseconds` has earned: the press
 * itself, a second one the moment the delay is up, and one more on every beat after that.
 */
export function stepsDue(heldMilliseconds) {
  if (heldMilliseconds < REPEAT_DELAY_MS) {
    return 1;
  }
  return 2 + Math.floor((heldMilliseconds - REPEAT_DELAY_MS) / REPEAT_PERIOD_MS);
}

/**
 * A key going down. One that is already held is left exactly as it was -- a browser that
 * does deliver its own auto-repeat must not be able to restart the clock -- and the other
 * arrow takes the hold over, which is what a reader rolling from one to the other means.
 */
export function keyDown(hold, key, direction, now) {
  if (hold.key === key) {
    return hold;
  }
  return { key, direction, since: now, taken: 0 };
}

/** A key coming up. Only the key that actually holds the spiral lets go of it. */
export function keyUp(hold, key) {
  return hold.key === key ? NOTHING_HELD : hold;
}

/**
 * Where a hold leaves the spiral at `now`: the steps it has earned and not yet taken,
 * walked one at a time, stopping at whichever comes first -- the steps running out, or
 * the spiral reaching one of its ends.
 *
 * Reaching an end switches the repeat off while leaving the key held, so a key left
 * leaning on a finished spiral asks for nothing more, and is still the key that has to
 * come up before a press of it counts again.
 */
export function applyHold(hold, now, count, sectionCount) {
  const owed = hold.direction === 0 ? 0 : stepsDue(now - hold.since) - hold.taken;
  let visible = count;
  let taken = hold.taken;
  for (let step = 0; step < owed; step += 1) {
    const moved = Math.min(sectionCount, Math.max(1, visible + hold.direction));
    taken += 1;
    if (moved === visible) {
      return { hold: { ...hold, direction: 0, taken }, count: visible };
    }
    visible = moved;
  }
  return { hold: taken === hold.taken ? hold : { ...hold, taken }, count: visible };
}
