/**
 * The captured clip's scenario: the spiral taken down by the left arrow and put back up by
 * the right one.
 *
 * It opens on the finished spiral and holds it, because the first frame is what X shows on
 * the timeline as the clip's still — a run that started from one rectangle would hang its
 * weakest picture on the door. Then the left arrow strips the sections off down to the
 * first rectangle, a beat of rest, the right arrow builds them back, and the finished
 * spiral holds to the end. Both keys of the page's legend are seen doing their work, and
 * the clip closes on the picture it opened with.
 *
 * The presses run at two speeds, because the sections do not contribute equally to the
 * picture: the innermost rectangles are specks, and at one press per beat the clip's
 * opening seconds would show a blinking key and no visible consequence. So the small
 * sections go quickly — the key stays lit through them, which is what a held arrow key
 * looks like — and the presses slow to a readable beat for the sections large enough to
 * be seen arriving and leaving.
 *
 * Everything here is a pure function of the frame index, so any frame can be rebuilt on
 * its own and the clip is the same on every render.
 */
export const HOLD_OPEN_FRAMES = 45;
export const PAUSE_AT_ONE_FRAMES = 15;
export const HOLD_CLOSE_FRAMES = 86;

/** How many sections are large enough for their own arrival or departure to be seen. */
export const VISIBLE_SECTIONS = 8;
export const FAST_PRESS_FRAMES = 3;
export const SLOW_PRESS_FRAMES = 8;

/** How long a pressed key stays lit. It equals the fast spacing, so a fast run reads held. */
export const KEY_LIT_FRAMES = 3;

function pressCounts(sectionCount) {
  const fast = Math.max(0, sectionCount - VISIBLE_SECTIONS);
  return { fast, slow: sectionCount - 1 - fast };
}

function phaseFrames(sectionCount) {
  const { fast, slow } = pressCounts(sectionCount);
  return fast * FAST_PRESS_FRAMES + slow * SLOW_PRESS_FRAMES;
}

export function captureFrameCount(sectionCount) {
  return HOLD_OPEN_FRAMES + 2 * phaseFrames(sectionCount) + PAUSE_AT_ONE_FRAMES + HOLD_CLOSE_FRAMES;
}

/**
 * How many presses have landed by `sincePhase` frames into a phase, and whether the key is
 * lit there. `order` says which speed comes first: the take-down meets the small sections
 * first (fast, then slow), the rebuild meets them last.
 */
function pressesSoFar(sincePhase, sectionCount, order) {
  const { fast, slow } = pressCounts(sectionCount);
  const [firstCount, firstSpacing, secondSpacing] = order === "fast-first"
    ? [fast, FAST_PRESS_FRAMES, SLOW_PRESS_FRAMES]
    : [slow, SLOW_PRESS_FRAMES, FAST_PRESS_FRAMES];
  const firstSpan = firstCount * firstSpacing;

  if (sincePhase < firstSpan) {
    return {
      presses: Math.floor(sincePhase / firstSpacing) + 1,
      lit: sincePhase % firstSpacing < KEY_LIT_FRAMES
    };
  }
  const beyond = sincePhase - firstSpan;
  return {
    presses: firstCount + Math.floor(beyond / secondSpacing) + 1,
    lit: beyond % secondSpacing < KEY_LIT_FRAMES
  };
}

export function captureState(frameIndex, sectionCount) {
  const unbuildStart = HOLD_OPEN_FRAMES;
  const pauseStart = unbuildStart + phaseFrames(sectionCount);
  const rebuildStart = pauseStart + PAUSE_AT_ONE_FRAMES;
  const holdStart = rebuildStart + phaseFrames(sectionCount);

  if (frameIndex < unbuildStart) {
    return { visibleSections: sectionCount, leftActive: false, rightActive: false };
  }
  if (frameIndex < pauseStart) {
    const { presses, lit } = pressesSoFar(frameIndex - unbuildStart, sectionCount, "fast-first");
    return { visibleSections: sectionCount - presses, leftActive: lit, rightActive: false };
  }
  if (frameIndex < rebuildStart) {
    return { visibleSections: 1, leftActive: false, rightActive: false };
  }
  if (frameIndex < holdStart) {
    const { presses, lit } = pressesSoFar(frameIndex - rebuildStart, sectionCount, "slow-first");
    return { visibleSections: 1 + presses, leftActive: false, rightActive: lit };
  }
  return { visibleSections: sectionCount, leftActive: false, rightActive: false };
}
